import { getOrder, sql } from "@/lib/db";
import { rupees } from "@/lib/money";
import { mintDownloadToken } from "@/lib/token";
import { settleFromRazorpay } from "@/lib/settle";
import CopyLinkButton from "@/components/CopyLinkButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order", robots: { index: false } };

const MAX_DOWNLOADS = 10;

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let order = await getOrder(id);

  // No webhook secret yet, so the order page is the primary confirmation path:
  // ask Razorpay directly, and re-read if that settled the order.
  if (order && order.status === "created") {
    const settled = await settleFromRazorpay(order);
    if (settled) order = await getOrder(id);
  }

  if (!order) {
    return (
      <div className="wrap py-24">
        <h1 className="title title-lg mb-6">Order not found.</h1>
        <a className="btn btn-ghost" href="/">
          <span aria-hidden>&larr;</span> Back to the books
        </a>
      </div>
    );
  }

  const paid = order.status === "paid" || order.status === "fulfilled";
  const failed = order.status === "payment_failed";
  const refunded = order.status === "refunded";

  const counts = (await sql`
    select book_slug, count from downloads where order_id = ${id}
  `) as { book_slug: string; count: number }[];
  const used = new Map(counts.map((c) => [c.book_slug, c.count]));

  return (
    <div className="wrap max-w-[760px] py-18">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Order {order.id}</p>
        <CopyLinkButton orderId={order.id} />
      </div>


      {failed || refunded ? (
        <>
          <p className="mb-4 inline-flex items-center gap-2 rounded-2 bg-danger/10 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-danger uppercase">
            <span aria-hidden>&times;</span>
            {refunded ? "Refunded" : "Payment failed"}
          </p>
          <h1 className="title title-lg mb-3">
            {refunded ? "This order was refunded." : "That payment did not go through."}
          </h1>
          <hr className="gold-rule mb-6" />
          <p className="mb-8 max-w-[58ch] text-ink-soft">
            {refunded
              ? "The amount has been returned to your original payment method. Bank timelines vary, so allow a few working days for it to appear."
              : "Nothing was charged. This usually means the payment was cancelled or the link expired — you can start again from the catalogue."}
          </p>
          <a className="btn btn-primary" href="/#catalogue">
            Back to the catalogue <span aria-hidden>&rarr;</span>
          </a>
        </>
      ) : !paid ? (
        <>
          <p className="mb-4 inline-flex items-center gap-2 rounded-2 bg-gold/10 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-gold uppercase">
            <span aria-hidden>&bull;</span>
            Awaiting payment
          </p>
          <h1 className="title title-lg mb-3">Confirming your payment.</h1>
          <hr className="gold-rule mb-6" />
          <p className="mb-8 max-w-[58ch] text-ink-soft">
            We check with the payment provider every time this page loads, so
            refreshing is the fastest way to confirm. Your download link is emailed
            the moment payment clears. If you were charged and this has not updated
            after a few refreshes, write to us with the order number above.
          </p>
          <a className="btn btn-ghost" href={`/order/${order.id}`}>
            Check again <span aria-hidden>&#8635;</span>
          </a>
        </>
      ) : (
        <>
          <p className="mb-4 inline-flex items-center gap-2 rounded-2 bg-brand/10 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-brand uppercase">
            <span aria-hidden>&#10003;</span>
            Payment received
          </p>
          <h1 className="title title-lg mb-3">Thank you. Your copy is ready.</h1>
          <hr className="gold-rule mb-6" />
          <p className="mb-10 max-w-[58ch] text-ink-soft">
            Links below expire in 15 minutes for safety &mdash; reopen this page any
            time for fresh ones. Bookmark it, or keep the confirmation email.
          </p>

          <ul className="mb-10 grid gap-4">
            {order.items.map((item) => {
              const n = used.get(item.slug) ?? 0;
              const exhausted = n >= MAX_DOWNLOADS;
              return (
                <li
                  key={item.slug}
                  className="card flex flex-wrap items-center justify-between gap-5"
                >
                  <div>
                    <p className="m-0 font-medium">{item.title}</p>
                    <p className="eyebrow mt-1.5">
                      {n} of {MAX_DOWNLOADS} downloads used
                    </p>
                  </div>
                  {exhausted ? (
                    <span className="eyebrow">Limit reached &mdash; contact us</span>
                  ) : (
                    <a
                      className="btn btn-primary"
                      href={`/api/download?t=${mintDownloadToken(order.id, item.slug)}`}
                    >
                      Download <span aria-hidden>&darr;</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <hr className="mb-6 border-line" />
      <dl className="grid gap-2.5 text-[15px]">
        <div className="flex justify-between">
          <dt className="eyebrow">{paid ? "Total paid" : "Amount"}</dt>
          <dd className="m-0 font-mono">{rupees(order.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="eyebrow">Sent to</dt>
          <dd className="m-0">{order.email}</dd>
        </div>
      </dl>
    </div>
  );
}
