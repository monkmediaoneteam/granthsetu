import { sql } from "@/lib/db";
import { rupees } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * Deliberately plain. One user, read-only, token in the URL.
 * ponytail: URL token leaks via referrer/history. Fine for a single operator on
 * an unlinked page; move to a signed cookie if anyone else ever gets access.
 */
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return (
      <main className="wrap" style={{ padding: "96px 0" }}>
        <h1 className="disp h3" style={{ marginTop: 0 }}>Not authorised.</h1>
      </main>
    );
  }

  const orders = (await sql`
    select id, email, total, status, created_at, items
    from orders order by created_at desc limit 200
  `) as {
    id: string; email: string; total: number; status: string;
    created_at: string; items: { title: string }[];
  }[];

  const [totals] = (await sql`
    select coalesce(sum(total),0)::int as revenue, count(*)::int as units
    from orders where status in ('paid','fulfilled')
  `) as { revenue: number; units: number }[];

  return (
    <main className="wrap" style={{ padding: "56px 0" }}>
      <div className="eyebrow" style={{ marginBottom: 24 }}>Admin</div>

      <div style={{ display: "flex", gap: 48, marginBottom: 40 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Revenue</div>
          <div className="disp" style={{ fontSize: 44 }}>{rupees(totals.revenue)}</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Paid orders</div>
          <div className="disp" style={{ fontSize: 44 }}>{totals.units}</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {["Order", "Email", "Book", "Total", "Status", "When"].map((h) => (
                <th key={h} className="eyebrow"
                  style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--line-2)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={cell}><a href={`/order/${o.id}`} style={{ fontFamily: "var(--mono)" }}>{o.id}</a></td>
                <td style={cell}>{o.email}</td>
                <td style={cell}>{o.items?.[0]?.title ?? "—"}</td>
                <td style={{ ...cell, fontFamily: "var(--mono)" }}>{rupees(o.total)}</td>
                <td style={cell}>
                  <span style={{
                    color: o.status === "fulfilled" || o.status === "paid"
                      ? "var(--emerald)" : "var(--ink-soft)",
                  }}>{o.status}</span>
                </td>
                <td style={{ ...cell, color: "var(--ink-soft)" }}>
                  {new Date(o.created_at).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p style={{ color: "var(--ink-soft)", padding: "24px 0" }}>No orders yet.</p>
        )}
      </div>
    </main>
  );
}

const cell = { padding: "10px 12px", borderBottom: "1px solid var(--line)" } as const;
