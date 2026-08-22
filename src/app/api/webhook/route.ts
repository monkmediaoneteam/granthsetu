import { NextResponse } from "next/server";
import { sql, getOrder, logEvent } from "@/lib/db";
import { verifyWebhook } from "@/lib/razorpay";
import { orderConfirmation } from "@/lib/email";

export const runtime = "nodejs";

/**
 * The only place an order becomes `paid`. The browser redirect is never trusted —
 * a buyer can close the tab, and a hostile one can forge the callback.
 *
 * Idempotent: replays are absorbed by the `where status = 'created'` guard plus
 * the unique index on razorpay_payment_id.
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

  const rzpOrderId = payment.order_id as string;
  const paymentId = payment.id as string;

  if (event.event === "payment.failed") {
    await sql`
      update orders set status = 'payment_failed'
      where razorpay_order_id = ${rzpOrderId} and status = 'created'
    `;
    return NextResponse.json({ ok: true });
  }

  if (event.event !== "payment.captured") return NextResponse.json({ ok: true });

  const rows = (await sql`
    update orders
       set status = 'paid',
           razorpay_payment_id = ${paymentId},
           paid_at = now()
     where razorpay_order_id = ${rzpOrderId}
       and status = 'created'
    returning id
  `) as { id: string }[];

  // Already processed — a replay, not an error.
  if (rows.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  const orderId = rows[0].id;
  await logEvent(orderId, "payment.captured", { paymentId, amount: payment.amount });

  const order = await getOrder(orderId);
  if (order) {
    // Seed the download counters so the order page has rows to increment.
    for (const item of order.items) {
      await sql`
        insert into downloads (order_id, book_slug) values (${orderId}, ${item.slug})
        on conflict do nothing
      `;
    }

    await orderConfirmation(
      order,
      process.env.NEXT_PUBLIC_SITE_URL || "https://books.inventayu.com"
    );
    await sql`update orders set status = 'fulfilled' where id = ${orderId}`;
    await logEvent(orderId, "order.fulfilled", {});
  }

  return NextResponse.json({ ok: true });
}
