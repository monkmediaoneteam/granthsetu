import { sql, getOrder, logEvent } from "./db";
import { orderConfirmation } from "./email";

/**
 * Marks an order paid, seeds its download counters and emails the links.
 *
 * Single entry point so the Razorpay webhook and the local no-payment path
 * cannot drift apart. Idempotent: the `status = 'created'` guard means replays
 * (Razorpay retries the same event) do nothing and send no second email.
 *
 * Returns true only for the call that actually transitioned the order.
 */
export async function fulfilOrder(
  rzpOrderId: string,
  paymentId: string | null
): Promise<boolean> {
  const rows = (await sql`
    update orders
       set status = 'paid',
           razorpay_payment_id = ${paymentId},
           paid_at = now()
     where razorpay_order_id = ${rzpOrderId}
       and status = 'created'
    returning id
  `) as { id: string }[];

  if (rows.length === 0) return false; // already handled, or unknown order

  const orderId = rows[0].id;
  await logEvent(orderId, "payment.captured", { paymentId });

  const order = await getOrder(orderId);
  if (!order) return false;

  for (const item of order.items) {
    await sql`
      insert into downloads (order_id, book_slug) values (${orderId}, ${item.slug})
      on conflict do nothing
    `;
  }

  await orderConfirmation(
    order,
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  );

  await sql`update orders set status = 'fulfilled' where id = ${orderId}`;
  await logEvent(orderId, "order.fulfilled", {});
  return true;
}
