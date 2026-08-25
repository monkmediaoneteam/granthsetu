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
      const ref = order.razorpay_order_id;

      // Payment Links carry a plink_ id; the Orders API uses order_. Checkout
      // creates links now, but older rows may still be orders, so handle both.
      const isLink = ref.startsWith("plink_");
      const url = isLink
        ? `https://api.razorpay.com/v1/payment_links/${ref}`
        : `https://api.razorpay.com/v1/orders/${ref}/payments`;

      const res = await fetch(url, { headers: { authorization: auth } });
      if (!res.ok) {
        console.error(`[reconcile] lookup failed for ${order.id}:`, await res.text());
        continue;
      }

      const data = (await res.json()) as {
        status?: string;
        payments?: { payment_id?: string; id?: string; status?: string }[];
        items?: { id: string; status: string }[];
      };

      let capturedId: string | null = null;
      let definitelyFailed = false;

      if (isLink) {
        if (data.status === "paid") {
          const p = (data.payments || []).find((x) => x.status === "captured")
            ?? (data.payments || [])[0];
          capturedId = p?.payment_id ?? p?.id ?? null;
        } else if (data.status === "cancelled" || data.status === "expired") {
          definitelyFailed = true;
        }
      } else {
        const items = data.items || [];
        const captured = items.find((p) => p.status === "captured");
        capturedId = captured?.id ?? null;
        definitelyFailed = !captured && items.length > 0 && items.every((p) => p.status === "failed");
      }

      // A paid link with no retrievable payment id is still a paid order — the
      // buyer must get their book; the payment id is only bookkeeping.
      if (capturedId || (isLink && data.status === "paid")) {
        const ok = await fulfilOrder(ref, capturedId);
        if (ok) {
          fulfilledCount++;
          await logEvent(order.id, "reconcile.fulfilled", { paymentId: capturedId });
        }
      } else if (definitelyFailed) {
        await sql`
          update orders set status = 'payment_failed'
          where id = ${order.id} and status = 'created'
        `;
        failedCount++;
        await logEvent(order.id, "reconcile.payment_failed", {});
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
