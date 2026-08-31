import { sql, logEvent, type Order } from "./db";
import { fetchPaymentLink } from "./razorpay";
import { fulfilOrder } from "./fulfil";
import { env } from "./env";

/**
 * Asks Razorpay directly whether an order has been paid, and fulfils it if so.
 *
 * The webhook is the fast path, but it needs a shared secret we do not have
 * yet — and even with one, webhooks get dropped. This is the authoritative
 * fallback: it is called whenever a buyer opens their order page, and by the
 * reconcile cron. Razorpay's own record is the source of truth either way.
 *
 * Safe to call repeatedly. fulfilOrder() only transitions an order still in
 * 'created', so a second call is a no-op and sends no second email.
 */
export async function settleFromRazorpay(order: Order): Promise<boolean> {
  if (order.status !== "created") return false;
  if (!order.razorpay_link_id) return false;
  if (!env("RAZORPAY_KEY_ID") || !env("RAZORPAY_KEY_SECRET")) return false;

  try {
    const link = await fetchPaymentLink(order.razorpay_link_id);

    if (link.status === "paid") {
      const p =
        (link.payments || []).find((x) => x.status === "captured") ??
        (link.payments || [])[0];
      const paymentId = p?.payment_id ?? p?.id ?? null;

      const fresh = await fulfilOrder(order.razorpay_link_id, paymentId);
      if (fresh) {
        await logEvent(order.id, "settled.from_razorpay", {
          paymentId,
          amountPaid: link.amount_paid,
          method: p?.method ?? null,
        });
      }
      return fresh;
    }

    if (link.status === "cancelled" || link.status === "expired") {
      await sql`
        update orders set status = 'payment_failed'
        where id = ${order.id} and status = 'created'
      `;
      await logEvent(order.id, "settled.failed", { linkStatus: link.status });
    }

    return false;
  } catch (err) {
    // Never surface a Razorpay outage as a broken order page — the buyer can
    // refresh, and the cron will catch it regardless.
    console.error("[settle] lookup failed for", order.id, err);
    return false;
  }
}
