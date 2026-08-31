/**
 * TailAdmin-style chrome (fixed sidebar, stat cards, panelled tables) rendered
 * in INVENTAYU's own tokens rather than importing the TailAdmin template see
 * the note in README. Server component: no client JS needed for a static nav.
 */
export default function AdminShell({
  token,
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  token: string;
  active: "overview" | "books";
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const nav = [
    { key: "overview", label: "Overview", href: `/admin?token=${encodeURIComponent(token)}` },
    { key: "books", label: "Books", href: `/admin/books?token=${encodeURIComponent(token)}` },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-bg-2 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="px-6 py-6">
          <p className="text-[15px] font-semibold tracking-tight">
            INVENTAYU<sup className="text-[9px]">&reg;</sup>
          </p>
          <p className="eyebrow mt-1">Books admin</p>
        </div>

        <nav className="px-3 pb-6">
          <ul className="grid gap-1">
            {nav.map((n) => (
              <li key={n.key}>
                <a
                  href={n.href}
                  aria-current={active === n.key ? "page" : undefined}
                  className={`block rounded-2 px-3 py-2 text-[15px] transition-colors ${
                    active === n.key
                      ? "bg-brand text-white"
                      : "text-ink-soft hover:bg-bg-3 hover:text-ink"
                  }`}
                >
                  {n.label}
                </a>
              </li>
            ))}
            <li className="mt-2 border-t border-line pt-2">
              <a
                href={`/api/admin/export?token=${encodeURIComponent(token)}`}
                className="block rounded-2 px-3 py-2 text-[15px] text-ink-soft hover:bg-bg-3 hover:text-ink"
              >
                Export orders (CSV)
              </a>
            </li>
            <li>
              <a
                href="/"
                className="block rounded-2 px-3 py-2 text-[15px] text-ink-soft hover:bg-bg-3 hover:text-ink"
              >
                View storefront
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 px-5 py-8 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="title title-lg">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[15px] text-ink-soft">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
