import { sql } from "@/lib/db";
import { rupees } from "@/lib/money";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/AdminShell";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * ponytail: token rides in the URL, so it leaks via referrer and history.
 * Fine for a single operator on an unlinked page; move to a signed cookie the
 * moment anyone else gets access.
 */
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  if (!(await isAdmin(token))) redirect("/admin/login");

  const orders = (await sql`
    select id, name, email, phone, total, status, created_at, items
    from orders order by created_at desc limit 100
  `) as {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    total: number;
    status: string;
    created_at: string;
    items: { title: string }[];
  }[];

  const [totals] = (await sql`
    select coalesce(sum(total),0)::int as revenue, count(*)::int as units
    from orders where status in ('paid','fulfilled')
  `) as { revenue: number; units: number }[];

  const [conv] = (await sql`
    select count(*)::int as started from orders
  `) as { started: number }[];

  const downloadStats = (await sql`
    select book_slug, sum(count)::int as total_downloads, count(*)::int as active_orders
    from downloads group by book_slug order by total_downloads desc
  `) as { book_slug: string; total_downloads: number; active_orders: number }[];

  const recentEvents = (await sql`
    select id, order_id, type, payload, created_at
    from events order by created_at desc limit 40
  `) as {
    id: number;
    order_id: string | null;
    type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }[];

  const rate = conv.started ? Math.round((totals.units / conv.started) * 100) : 0;
  const allDownloads = downloadStats.reduce((a, d) => a + d.total_downloads, 0);
  const exportHref = "/api/admin/export";

  return (
    <AdminShell
      active="overview"
      title="Overview"
      subtitle="Sales, downloads and the audit trail."
      actions={
        <a className="btn btn-ghost" href={exportHref}>
          Export CSV <span aria-hidden>&darr;</span>
        </a>
      }
    >
      <div className="mb-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={rupees(totals.revenue)} accent />
        <StatCard
          label="Paid orders"
          value={totals.units}
          hint={conv.started + " started"}
        />
        <StatCard label="Conversion" value={rate + "%"} hint="paid of started" />
        <StatCard
          label="Downloads"
          value={allDownloads}
          hint={downloadStats.length + " titles"}
        />
      </div>

      {downloadStats.length > 0 && (
        <section className="mb-12">
          <h2 className="title title-md mb-4">Per title</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {downloadStats.map((d) => (
              <StatCard
                key={d.book_slug}
                label={d.book_slug.replace(/-/g, " ")}
                value={d.total_downloads}
                hint={d.active_orders + " orders"}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="title title-md mb-4">Orders</h2>
        <div className="overflow-x-auto rounded-3 border border-line">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Recent orders</caption>
            <thead>
              <tr className="bg-bg-2">
                {["Order", "Customer", "Contact", "Book", "Total", "Status", "When"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="eyebrow border-b border-line-2 px-4 py-3 text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-bg-2/60">
                  <td className="border-b border-line px-4 py-3">
                    <a
                      className="font-mono underline hover:text-brand"
                      href={"/order/" + o.id}
                    >
                      {o.id.slice(0, 10)}
                    </a>
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    {o.name ?? "—"}
                  </td>
                  <td className="border-b border-line px-4 py-3 text-ink-soft">
                    {o.email}
                    {o.phone && (
                      <>
                        <br />
                        <span className="font-mono text-xs">{o.phone}</span>
                      </>
                    )}
                  </td>
                  <td className="border-b border-line px-4 py-3 max-w-[220px] truncate">
                    {o.items?.[0]?.title ?? "—"}
                  </td>
                  <td className="border-b border-line px-4 py-3 font-mono whitespace-nowrap">
                    {rupees(o.total)}
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    <span
                      className={
                        "inline-block rounded-1 px-2 py-0.5 font-mono text-xs font-medium " +
                        (o.status === "fulfilled" || o.status === "paid"
                          ? "bg-brand/10 text-brand"
                          : o.status === "payment_failed"
                            ? "bg-danger/10 text-danger"
                            : "bg-ink-mute/10 text-ink-mute")
                      }
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="border-b border-line px-4 py-3 text-ink-soft whitespace-nowrap">
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
        <h2 className="title title-md mb-4">Audit trail</h2>
        <div className="overflow-x-auto rounded-3 border border-line">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-bg-2">
                {["Time", "Type", "Order", "Payload"].map((h) => (
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
                <tr key={ev.id} className="transition-colors hover:bg-bg-2/60">
                  <td className="border-b border-line px-4 py-2.5 whitespace-nowrap text-ink-soft">
                    {new Date(ev.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 font-semibold text-brand">
                    {ev.type}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 text-ink-soft">
                    {ev.order_id ? (
                      <a href={"/order/" + ev.order_id} className="underline">
                        {ev.order_id.slice(0, 10)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 max-w-[380px] truncate text-ink-soft">
                    {JSON.stringify(ev.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentEvents.length === 0 && (
            <p className="p-6 text-ink-soft">No events yet.</p>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
