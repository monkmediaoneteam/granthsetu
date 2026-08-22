import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyWebhook } from "@/lib/razorpay";
import { fulfilOrder } from "@/lib/fulfil";

export const runtime = "nodejs";

/**
 * The only place a real payment becomes `paid`. The browser redirect is never
 * trusted — a buyer can close the tab, and a hostile one can forge the callback.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifyWebhook(raw, req.headers.get("x-razorpay-signature"))) {
    console.warn("[webhook] bad signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(raw);
  const payment = event?.payload?.payment?.entity;
  if (!payment) return NextResponse.json({ ok: true });

  if (event.event === "payment.failed") {
    await sql`
      update orders set status = 'payment_failed'
      where razorpay_order_id = ${payment.order_id} and status = 'created'
    `;
    return NextResponse.json({ ok: true });
  }

  if (event.event !== "payment.captured") return NextResponse.json({ ok: true });

  const fresh = await fulfilOrder(payment.order_id, payment.id);
  return NextResponse.json({ ok: true, duplicate: !fresh });
}
