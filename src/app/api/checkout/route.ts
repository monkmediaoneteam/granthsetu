import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sql, getBook, logEvent } from "@/lib/db";
import { computeTotals } from "@/lib/money";
import { createPaymentLink } from "@/lib/razorpay";
import { fulfilOrder } from "@/lib/fulfil";
import { env } from "@/lib/env";
import { validateEmail, validatePhone, validateName } from "@/lib/validate";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ORDERS_PER_HOUR = 10;

/**
 * True when there are no Razorpay keys and we are not in production: the order
 * is marked paid immediately so the whole flow can be clicked through locally.
 * Both conditions are required a production deploy that forgets its keys must
 * fail, not start giving books away.
 */
const noPaymentMode = () =>
  process.env.NODE_ENV !== "production" && !env("RAZORPAY_KEY_ID");

export async function POST(req: Request) {
  let body: { slug?: string; name?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const nameCheck = validateName(body.name || "");
  if (!nameCheck.ok) return NextResponse.json({ error: nameCheck.error, field: "name" }, { status: 400 });

  const emailCheck = validateEmail(body.email || "");
  if (!emailCheck.ok) return NextResponse.json({ error: emailCheck.error, field: "email" }, { status: 400 });

  const phoneCheck = validatePhone(body.phone || "");
  if (!phoneCheck.ok) return NextResponse.json({ error: phoneCheck.error, field: "phone" }, { status: 400 });

  const name = nameCheck.value;
  const email = emailCheck.value;
  const phone = phoneCheck.value;
  const slug = (body.slug || "").trim();

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
    const site = env("NEXT_PUBLIC_SITE_URL") || new URL(req.url).origin;

    let linkId: string | null = null;
    let paymentUrl: string | null = null;

    if (!fake) {
      const link = await createPaymentLink({
        amountPaise: total,
        orderId,
        name,
        email,
        phone,
        description: book.title,
        callbackUrl: `${site}/order/${orderId}`,
      });
      linkId = link.id;
      paymentUrl = link.short_url;
    }

    await sql`
      insert into orders (id, name, email, phone, items, subtotal, tax, total, status,
                          razorpay_order_id, razorpay_link_id)
      values (${orderId}, ${name}, ${email}, ${phone}, ${JSON.stringify(items)}::jsonb,
              ${subtotal}, ${tax}, ${total}, 'created',
              ${fake ? `nopay_${orderId}` : linkId}, ${linkId})
    `;
    await logEvent(orderId, "order.created", { slug, name, email, total, fake });

    if (fake) {
      await fulfilOrder(`nopay_${orderId}`, null);
      return NextResponse.json({ orderId, noPayment: true });
    }

    return NextResponse.json({ orderId, paymentUrl });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json(
      { error: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
