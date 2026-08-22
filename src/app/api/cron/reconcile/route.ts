import { NextResponse } from "next/server";
import { sql, logEvent } from "@/lib/db";
import { fulfilOrder } from "@/lib/fulfil";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Cron reconciliation job to recover stuck orders.
 *
 * If a webhook is dropped or times out during high network load, an order could
 * be stuck in 'created' despite payment being captured. This job checks Razorpay
 * for orders created between 10 minutes and 24 hours ago.
 *
 * Protected by CRON_SECRET (Vercel Cron header) or ADMIN_TOKEN.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const tokenParam = new URL(req.url).searchParams.get("token") || "";

  const secret = env("CRON_SECRET") || env("ADMIN_TOKEN");
  const isAuthorized =
    secret &&
    (authHeader === `Bearer ${secret}` || tokenParam === secret);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = env("RAZORPAY_KEY_ID");
  const keySecret = env("RAZORPAY_KEY_SECRET");

  if (!keyId || !keySecret) {
    return NextResponse.json({
      message: "Razorpay keys not configured; reconciliation skipped.",
      reconciled: 0,
    });
  }

  // Find orders stuck in 'created' state between 10 minutes and 24 hours ago
  const stuckOrders = (await sql`
    select id, razorpay_order_id, created_at from orders
    where status = 'created'
      and razorpay_order_id is not null
      and razorpay_order_id not like 'nopay_%'
      and created_at < now() - interval '10 minutes'
      and created_at > now() - interval '24 hours'
    limit 50
  `) as { id: string; razorpay_order_id: string; created_at: string }[];

  let fulfilledCount = 0;
  let failedCount = 0;

  const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  for (const order of stuckOrders) {
    try {
      const res = await fetch(
        `https://api.razorpay.com/v1/orders/${order.razorpay_order_id}/payments`,
        { headers: { authorization: auth } }
      );

      if (!res.ok) {
        console.error(`[reconcile] Failed to fetch payments for order ${order.id}:`, await res.text());
        continue;
      }

      const data = (await res.json()) as {
        items?: { id: string; status: string }[];
      };
      const items = data.items || [];

      const captured = items.find((p) => p.status === "captured");
      if (captured) {
        const ok = await fulfilOrder(order.razorpay_order_id, captured.id);
        if (ok) {
          fulfilledCount++;
          await logEvent(order.id, "reconcile.fulfilled", { paymentId: captured.id });
        }
      } else {
        const allFailed = items.length > 0 && items.every((p) => p.status === "failed");
        if (allFailed) {
          await sql`
            update orders set status = 'payment_failed'
            where id = ${order.id} and status = 'created'
          `;
          failedCount++;
          await logEvent(order.id, "reconcile.payment_failed", {});
        }
      }
    } catch (err) {
      console.error(`[reconcile] Error reconciling order ${order.id}:`, err);
    }
  }

  return NextResponse.json({
    checked: stuckOrders.length,
    fulfilled: fulfilledCount,
    failed: failedCount,
  });
}
