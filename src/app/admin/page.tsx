import { sql } from "@/lib/db";
import { rupees } from "@/lib/money";

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

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return (
      <div className="wrap py-24">
        <h1 className="disp h3">Not authorised.</h1>
      </div>
    );
  }

  const orders = (await sql`
    select id, email, total, status, created_at, items
    from orders order by created_at desc limit 200
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

  return (
    <div className="wrap py-14">
      <p className="eyebrow mb-6">Admin</p>

      <dl className="mb-10 flex flex-wrap gap-12">
        <div>
          <dt className="eyebrow mb-2">Revenue</dt>
          <dd className="disp m-0 text-[44px]">{rupees(totals.revenue)}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-2">Paid orders</dt>
          <dd className="disp m-0 text-[44px]">{totals.units}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Recent orders</caption>
          <thead>
            <tr>
              {["Order", "Email", "Book", "Total", "Status", "When"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="eyebrow border-b border-line-2 px-3 py-2.5 text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="border-b border-line px-3 py-2.5">
                  <a className="font-mono underline" href={`/order/${o.id}`}>
                    {o.id}
                  </a>
                </td>
                <td className="border-b border-line px-3 py-2.5">{o.email}</td>
                <td className="border-b border-line px-3 py-2.5">
                  {o.items?.[0]?.title ?? "\u2014"}
                </td>
                <td className="border-b border-line px-3 py-2.5 font-mono">
                  {rupees(o.total)}
                </td>
                <td className="border-b border-line px-3 py-2.5">
                  <span
                    className={
                      o.status === "fulfilled" || o.status === "paid"
                        ? "text-brand"
                        : "text-ink-soft"
                    }
                  >
                    {o.status}
                  </span>
                </td>
                <td className="border-b border-line px-3 py-2.5 text-ink-soft">
                  {new Date(o.created_at).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="py-6 text-ink-soft">No orders yet.</p>}
      </div>
    </div>
  );
}
