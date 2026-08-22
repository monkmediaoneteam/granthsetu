import { getOrder, sql } from "@/lib/db";
import { rupees } from "@/lib/money";
import { mintDownloadToken } from "@/lib/token";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <main className="wrap" style={{ padding: "96px 0" }}>
        <h1 className="disp h3" style={{ marginTop: 0 }}>Order not found.</h1>
        <a className="btn btn-ghost" href="/">← Back to the books</a>
      </main>
    );
  }

  const paid = order.status === "paid" || order.status === "fulfilled";

  const counts = (await sql`
    select book_slug, count from downloads where order_id = ${id}
  `) as { book_slug: string; count: number }[];
  const used = new Map(counts.map((c) => [c.book_slug, c.count]));

  return (
    <main className="wrap" style={{ padding: "72px 0", maxWidth: 760 }}>
      <div className="eyebrow" style={{ marginBottom: 20 }}>
        Order {order.id}
      </div>

      {!paid ? (
        <>
          <h1 className="disp h3" style={{ margin: "0 0 16px" }}>
            Waiting for payment confirmation.
          </h1>
          <p style={{ color: "var(--ink-soft)", maxWidth: "58ch" }}>
            This can take a few seconds. Refresh this page — and check your email,
            the download link is sent there the moment payment clears. If you were
            charged and this does not update within a few minutes, write to us with
            your order number above.
          </p>
        </>
      ) : (
        <>
          <h1 className="disp h3" style={{ margin: "0 0 16px" }}>
            Thank you. Your copy is ready.
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0 0 40px", maxWidth: "58ch" }}>
            Links below expire in 15 minutes for safety — reopen this page any time
            for fresh ones. Bookmark it, or keep the confirmation email.
          </p>

          <div style={{ display: "grid", gap: 16, marginBottom: 40 }}>
            {order.items.map((item) => {
              const n = used.get(item.slug) ?? 0;
              const exhausted = n >= 10;
              return (
                <div
                  key={item.slug}
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div className="eyebrow" style={{ marginTop: 6 }}>
                      {n} of 10 downloads used
                    </div>
                  </div>
                  {exhausted ? (
                    <span className="eyebrow">Limit reached — contact us</span>
                  ) : (
                    <a
                      className="btn btn-primary"
                      href={`/api/download?t=${mintDownloadToken(order.id, item.slug)}`}
                    >
                      Download <span aria-hidden>↓</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="rule" style={{ margin: "0 0 24px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
        <span className="eyebrow">Total paid</span>
        <span style={{ fontFamily: "var(--mono)" }}>{rupees(order.total)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginTop: 10 }}>
        <span className="eyebrow">Sent to</span>
        <span>{order.email}</span>
      </div>
    </main>
  );
}
