/**
 * Razorpay will not activate an account without these four pages live and
 * reachable. The text below is a working draft — the bracketed fields must be
 * filled with the real entity details before activation is submitted.
 */

export const ENTITY = {
  name: "INVENTAYU Pvt. Ltd.",
  address: "[REGISTERED ADDRESS — required before Razorpay activation]",
  email: "[SUPPORT EMAIL]",
  phone: "[SUPPORT PHONE]",
};

export function Legal({
  title,
  updated = "22 August 2026",
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="wrap legal" style={{ padding: "72px 0", maxWidth: 760 }}>
      <div className="eyebrow" style={{ marginBottom: 20 }}>Last updated {updated}</div>
      <h1 className="disp h3" style={{ margin: "0 0 40px" }}>{title}</h1>
      {children}
      <div className="rule" style={{ margin: "48px 0 20px" }} />
      <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
        {ENTITY.name}<br />
        {ENTITY.address}<br />
        {ENTITY.email} · {ENTITY.phone}
      </p>
    </main>
  );
}
