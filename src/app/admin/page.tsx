import { sql } from "@/lib/db";
import { rupees } from "@/lib/money";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * Deliberately plain. One user, read-only.
 * ponytail: token rides in the URL, so it leaks via referrer and history.
 * Fine for a single operator on an unlinked page; move to a signed cookie the
 * moment anyone else gets access.
 */
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const expected = env("ADMIN_TOKEN");
  if (!expected || token !== expected) {
    return (
      <div className="wrap py-24">
        <h1 className="disp h3">Not authorised.</h1>
      </div>
    );
  }

  const orders = (await sql`
    select id, email, total, status, created_at, items
    from orders order by created_at desc limit 100
  `) as {
    id: string;
    email: string;
    total: number;
    status: string;
    created_at: string;
    items: { title: string }[];
  }[];

  const [totals] = (await sql`
    select coalesce(sum(total),0)::int as revenue, count(*)::int as units
    from orders where status in ('paid','fulfilled')
  `) as { revenue: number; units: number }[];

  const downloadStats = (await sql`
    select book_slug, sum(count)::int as total_downloads, count(*)::int as active_orders
    from downloads
    group by book_slug
  `) as { book_slug: string; total_downloads: number; active_orders: number }[];

  const recentEvents = (await sql`
    select id, order_id, type, payload, created_at
    from events
    order by created_at desc limit 50
  `) as {
    id: number;
    order_id: string | null;
    type: string;
    payload: Record<string, any>;
    created_at: string;
  }[];

  return (
    <div className="wrap py-14">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Management</p>
          <h1 className="disp h3">Sales & Operations Admin</h1>
        </div>
        <p className="eyebrow text-ink-soft">Internal Use Only</p>
      </div>

      <dl className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <dt className="eyebrow mb-2">Total Revenue</dt>
          <dd className="disp m-0 text-[36px] text-brand">{rupees(totals.revenue)}</dd>
        </div>
        <div className="card">
          <dt className="eyebrow mb-2">Paid Orders</dt>
          <dd className="disp m-0 text-[36px]">{totals.units}</dd>
        </div>
        {downloadStats.map((ds) => (
          <div key={ds.book_slug} className="card">
            <dt className="eyebrow mb-2 line-clamp-1" title={ds.book_slug}>
              Downloads: {ds.book_slug}
            </dt>
            <dd className="disp m-0 text-[36px] font-mono">{ds.total_downloads}</dd>
            <p className="eyebrow mt-1 text-[10px]">{ds.active_orders} orders</p>
          </div>
        ))}
      </dl>

      <section className="mb-16">
        <h2 className="disp text-[22px] mb-4">Orders Log</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Recent orders</caption>
            <thead>
              <tr className="bg-bg-3/50">
                {["Order", "Email", "Book", "Total", "Status", "When"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="eyebrow border-b border-line-2 px-4 py-3 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-bg/60 transition-colors">
                  <td className="border-b border-line px-4 py-3">
                    <a className="font-mono underline hover:text-brand" href={`/order/${o.id}`}>
                      {o.id}
                    </a>
                  </td>
                  <td className="border-b border-line px-4 py-3">{o.email}</td>
                  <td className="border-b border-line px-4 py-3 max-w-[200px] truncate">
                    {o.items?.[0]?.title ?? "\u2014"}
                  </td>
                  <td className="border-b border-line px-4 py-3 font-mono">
                    {rupees(o.total)}
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    <span
                      className={`inline-block rounded-1 px-2 py-0.5 text-xs font-mono font-medium ${
                        o.status === "fulfilled" || o.status === "paid"
                          ? "bg-brand/10 text-brand"
                          : o.status === "payment_failed"
                          ? "bg-danger/10 text-danger"
                          : "bg-ink-mute/10 text-ink-mute"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="border-b border-line px-4 py-3 text-ink-soft">
                    {new Date(o.created_at).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="p-6 text-ink-soft">No orders yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="disp text-[22px] mb-4">Audit Trail & Security Events</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-bg-3/50">
                {["Time", "Type", "Order ID", "Payload"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="eyebrow border-b border-line-2 px-4 py-3 text-left text-[10px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-bg/60 transition-colors">
                  <td className="border-b border-line px-4 py-2.5 text-ink-soft whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 font-semibold text-brand">
                    {ev.type}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 text-ink-soft">
                    {ev.order_id ? (
                      <a href={`/order/${ev.order_id}`} className="underline">
                        {ev.order_id}
                      </a>
                    ) : (
                      "\u2014"
                    )}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 text-ink-soft max-w-[340px] truncate">
                    {JSON.stringify(ev.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentEvents.length === 0 && <p className="p-6 text-ink-soft font-sans">No events logged yet.</p>}
        </div>
      </section>
    </div>
  );
}
