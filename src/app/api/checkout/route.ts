import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sql, getBook, logEvent } from "@/lib/db";
import { computeTotals } from "@/lib/money";
import { createRazorpayOrder } from "@/lib/razorpay";
import { fulfilOrder } from "@/lib/fulfil";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ORDERS_PER_HOUR = 10;

/**
 * True when there are no Razorpay keys and we are not in production: the order
 * is marked paid immediately so the whole flow can be clicked through locally.
 * Both conditions are required — a production deploy that forgets its keys must
 * fail, not start giving books away.
 */
const noPaymentMode = () =>
  process.env.NODE_ENV !== "production" && !process.env.RAZORPAY_KEY_ID;

export async function POST(req: Request) {
  let body: { slug?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const slug = (body.slug || "").trim();
  const phone = (body.phone || "").trim() || null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // ponytail: per-email hourly cap. Does not stop someone rotating addresses;
  // add an IP column and a second count if that ever actually happens.
  const [recent] = (await sql`
    select count(*)::int as n from orders
    where email = ${email} and created_at > now() - interval '1 hour'
  `) as { n: number }[];

  if (recent.n >= MAX_ORDERS_PER_HOUR) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const book = await getBook(slug);
  if (!book || !book.active) {
    return NextResponse.json({ error: "That book is not available." }, { status: 404 });
  }

  // Price comes from the DB, never from the client.
  const { subtotal, tax, total } = computeTotals([book.price_inr]);
  const items = [{ slug: book.slug, title: book.title, price: book.price_inr }];
  const orderId = crypto.randomBytes(12).toString("base64url");

  try {
    const fake = noPaymentMode();
    const rzpOrderId = fake
      ? `nopay_${orderId}`
      : (await createRazorpayOrder(total, orderId)).id;

    await sql`
      insert into orders (id, email, phone, items, subtotal, tax, total, status, razorpay_order_id)
      values (${orderId}, ${email}, ${phone}, ${JSON.stringify(items)}::jsonb,
              ${subtotal}, ${tax}, ${total}, 'created', ${rzpOrderId})
    `;
    await logEvent(orderId, "order.created", { slug, email, total, fake });

    if (fake) {
      await fulfilOrder(rzpOrderId, null);
      return NextResponse.json({ orderId, noPayment: true });
    }

    return NextResponse.json({ orderId, razorpayOrderId: rzpOrderId, amount: total });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json(
      { error: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
