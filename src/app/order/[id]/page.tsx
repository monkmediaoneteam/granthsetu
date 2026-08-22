import { getOrder, sql } from "@/lib/db";
import { rupees } from "@/lib/money";
import { mintDownloadToken } from "@/lib/token";
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
  const order = await getOrder(id);

  if (!order) {
    return (
      <div className="wrap py-24">
        <h1 className="disp h3 mb-6">Order not found.</h1>
        <a className="btn btn-ghost" href="/">
          <span aria-hidden>&larr;</span> Back to the books
        </a>
      </div>
    );
  }

  const paid = order.status === "paid" || order.status === "fulfilled";

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


      {!paid ? (
        <>
          <h1 className="disp h3 mb-4">Waiting for payment confirmation.</h1>
          <p className="max-w-[58ch] text-ink-soft">
            This can take a few seconds. Refresh this page &mdash; and check your
            email, the download link is sent there the moment payment clears. If you
            were charged and this does not update within a few minutes, write to us
            with your order number above.
          </p>
        </>
      ) : (
        <>
          <h1 className="disp h3 mb-4">Thank you. Your copy is ready.</h1>
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
          <dt className="eyebrow">Total paid</dt>
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
