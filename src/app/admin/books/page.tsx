import { sql, type Book } from "@/lib/db";
import { env } from "@/lib/env";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books", robots: { index: false, follow: false } };

export default async function AdminBooks({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; saved?: string }>;
}) {
  const { token, saved } = await searchParams;
  const expected = env("ADMIN_TOKEN");

  if (!expected || token !== expected) {
    return (
      <div className="wrap py-24">
        <h1 className="disp h3">Not authorised.</h1>
      </div>
    );
  }

  const books = (await sql`select * from books order by sort, title`) as Book[];

  const sold = (await sql`
    select book_slug, count(*)::int as orders, sum(count)::int as downloads
    from downloads group by book_slug
  `) as { book_slug: string; orders: number; downloads: number }[];
  const stats = new Map(sold.map((s) => [s.book_slug, s]));

  return (
    <AdminShell token={token} active="books" title="Books"
      subtitle="Everything shown on the storefront is edited here.">
      {saved && (
        <p className="mb-6 rounded-2 border border-brand/30 bg-brand/5 px-4 py-3 text-[15px] text-brand">
          Saved. The storefront was updated.
        </p>
      )}

      <div className="grid gap-8">
        {books.map((b) => {
          const s = stats.get(b.slug);
          return (
            <form
              key={b.slug}
              action="/api/admin/book"
              method="post"
              className="rounded-3 border border-line bg-bg-2 p-6"
            >
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="slug" value={b.slug} />

              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
                <h2 className="disp text-[22px]">{b.title}</h2>
                <p className="eyebrow">
                  {s
                    ? `${s.orders} orders · ${s.downloads} downloads`
                    : "No sales yet"}
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  name="title"
                  label="Title"
                  defaultValue={b.title}
                  required
                />
                <Field
                  name="subtitle"
                  label="Subtitle"
                  defaultValue={b.subtitle ?? ""}
                />
                <Field
                  name="price_inr"
                  label="Price (₹)"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={String(b.price_inr / 100)}
                  required
                />
                <Field
                  name="publisher"
                  label="Publisher"
                  defaultValue={b.publisher ?? ""}
                />
                <Field name="isbn" label="ISBN" defaultValue={b.isbn ?? ""} />
                <Field
                  name="pages"
                  label="Pages"
                  type="number"
                  defaultValue={b.pages ? String(b.pages) : ""}
                />
                <Field
                  name="year"
                  label="Year"
                  type="number"
                  defaultValue={b.year ? String(b.year) : ""}
                />
                <Field
                  name="cover"
                  label="Cover path"
                  defaultValue={b.cover ?? ""}
                />
                <div className="md:col-span-2">
                  <Field
                    name="file_url"
                    label="PDF file URL"
                    defaultValue={b.file_url ?? ""}
                    hint="Leave blank until the real book file is hosted downloads return 503 while empty."
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                <div>
                  <label className="field-label" htmlFor={`${b.slug}-desc`}>
                    Short description
                  </label>
                  <textarea
                    id={`${b.slug}-desc`}
                    name="description"
                    rows={3}
                    className="field-input resize-y"
                    defaultValue={b.description ?? ""}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`${b.slug}-long`}>
                    Long description (shown under “View more”, blank line
                    between paragraphs)
                  </label>
                  <textarea
                    id={`${b.slug}-long`}
                    name="long_description"
                    rows={10}
                    className="field-input resize-y"
                    defaultValue={b.long_description ?? ""}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`${b.slug}-auth`}>
                    Authorship line (shown under the title)
                  </label>
                  <input
                    id={`${b.slug}-auth`}
                    name="authorship"
                    className="field-input"
                    defaultValue={b.authorship ?? ""}
                    placeholder="41 contributors, edited under IASTAM"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`${b.slug}-facts`}>
                    Catalogue facts (one per line, Key: Value)
                  </label>
                  <textarea
                    id={`${b.slug}-facts`}
                    name="facts"
                    rows={5}
                    className="field-input resize-y font-mono text-[13px]"
                    defaultValue={Object.entries(b.facts ?? {})
                      .map(([k, v]) => k + ": " + v)
                      .join("\n")}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`${b.slug}-hl`}>
                    Highlights (one per line)
                  </label>
                  <textarea
                    id={`${b.slug}-hl`}
                    name="highlights"
                    rows={4}
                    className="field-input resize-y"
                    defaultValue={(b.highlights ?? []).join("\n")}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-line pt-5">
                <label className="flex items-center gap-2 text-[15px]">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={b.active}
                    className="h-4 w-4 accent-[color:var(--color-brand)]"
                  />
                  Visible on the storefront
                </label>
                <button className="btn btn-primary" type="submit">
                  Save changes
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </AdminShell>
  );
}

function Field({
  name, label, defaultValue, hint, ...rest
}: {
  name: string; label: string; defaultValue?: string; hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="field-label" htmlFor={name + defaultValue?.slice(0, 4)}>{label}</label>
      <input id={name + defaultValue?.slice(0, 4)} name={name} className="field-input"
        defaultValue={defaultValue} {...rest} />
      {hint && <p className="mt-1.5 text-[13px] text-ink-soft">{hint}</p>}
    </div>
  );
}
