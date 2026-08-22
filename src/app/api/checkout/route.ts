import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sql, getBook, logEvent } from "@/lib/db";
import { computeTotals } from "@/lib/money";
import { createRazorpayOrder } from "@/lib/razorpay";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const book = await getBook(slug);
  if (!book || !book.active) {
    return NextResponse.json({ error: "That book is not available." }, { status: 404 });
  }

  // Price comes from the DB, never from the client.
  const { subtotal, tax, total } = computeTotals([book.price_inr]);
  const items = [{ slug: book.slug, title: book.title, price: book.price_inr }];

  const orderId = crypto.randomBytes(12).toString("base64url");

  try {
    const rzp = await createRazorpayOrder(total, orderId);

    await sql`
      insert into orders (id, email, phone, items, subtotal, tax, total, status, razorpay_order_id)
      values (${orderId}, ${email}, ${phone}, ${JSON.stringify(items)}::jsonb,
              ${subtotal}, ${tax}, ${total}, 'created', ${rzp.id})
    `;
    await logEvent(orderId, "order.created", { slug, email, total });

    return NextResponse.json({
      orderId,
      razorpayOrderId: rzp.id,
      amount: total,
    });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json(
      { error: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
