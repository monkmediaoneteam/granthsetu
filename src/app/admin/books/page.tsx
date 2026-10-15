import { sql, type Book } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/AdminShell";
import { Archive, BookCheck, Eye, Save } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books", robots: { index: false, follow: false } };

export default async function AdminBooks({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  if (!(await isAdmin())) redirect("/admin/login");

  const books = (await sql`select * from books order by sort, title`) as (Book & { submission_id: string | null })[];

  const sold = (await sql`
    select book_slug, count(*)::int as orders, sum(count)::int as downloads
    from downloads group by book_slug
  `) as { book_slug: string; orders: number; downloads: number }[];
  const stats = new Map(sold.map((s) => [s.book_slug, s]));

  return (
    <AdminShell active="books" title="Books"
      subtitle="Everything shown on the storefront is edited here.">
      {saved && (
        <p className="mb-6 rounded-2 border border-brand/30 bg-brand/5 px-4 py-3 text-[15px] text-brand">
          Saved. The storefront was updated.
        </p>
      )}

      <div className="grid gap-8">
        {books.map((b) => {
          const s = stats.get(b.slug);
          if (b.third_party) {
            const VisibilityIcon = b.active ? Archive : Eye;
            return (
              <section key={b.slug} className="rounded-3 border border-line bg-bg-2 p-6">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="title title-md">{b.title}</h2>
                  <span className="text-sm text-ink-soft">{b.active ? "Visible" : "Archived"} · {b.release_approved ? "Released" : "Awaiting release"}</span>
                </div>
                <p className="text-sm text-ink-soft">{b.publisher || "Author publication"} · INR {(b.price_inr / 100).toFixed(2)} · {s ? `${s.orders} orders` : "No sales yet"}</p>
                <form action="/api/admin/book" method="post" className="mt-4 grid gap-4 border-t border-line pt-4">
                  <input type="hidden" name="action" value={b.active ? "archive" : "restore"} />
                  <input type="hidden" name="slug" value={b.slug} />
                  <Field id={`${b.slug}-visibility-reason`} name="reason" label="Visibility change reason" minLength={10} maxLength={2000} required />
                  <label className="flex items-start gap-2 text-[15px]">
                    <input type="checkbox" name="confirmed" required className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]" />
                    {b.active ? "I confirm archiving this publication." : "I confirm restoring this publication's visibility."}
                  </label>
                  <button className="btn btn-primary justify-self-start" type="submit"><VisibilityIcon size={16} aria-hidden="true" />{b.active ? "Archive" : "Restore"}</button>
                </form>
              </section>
            );
          }
          return (
            <div key={b.slug}>
            <form
              action="/api/admin/book"
              method="post"
              className="rounded-3 border border-line bg-bg-2 p-6"
            >
              <input type="hidden" name="slug" value={b.slug} />
              <input type="hidden" name="action" value="save" />

              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
                <h2 className="title title-md">{b.title}</h2>
                <span className="text-sm text-ink-soft">{b.release_approved ? "Released" : "Release paused"}</span>
                <p className="eyebrow">
                  {s
                    ? `${s.orders} orders · ${s.downloads} downloads`
                    : "No sales yet"}
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  name="title"
                  id={`${b.slug}-title`}
                  maxLength={200}
                  label="Title"
                  defaultValue={b.title}
                  required
                />
                <Field
                  name="subtitle"
                  id={`${b.slug}-subtitle`}
                  maxLength={200}
                  label="Subtitle"
                  defaultValue={b.subtitle ?? ""}
                />
                <Field
                  name="price_inr"
                  id={`${b.slug}-price`}
                  label="Price (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000000"
                  defaultValue={String(b.price_inr / 100)}
                  required
                />
                <Field
                  name="publisher"
                  id={`${b.slug}-publisher`}
                  maxLength={200}
                  label="Publisher"
                  defaultValue={b.publisher ?? ""}
                />
                <Field name="isbn" id={`${b.slug}-isbn`} maxLength={32} label="ISBN" defaultValue={b.isbn ?? ""} />
                <Field
                  name="pages"
                  id={`${b.slug}-pages`}
                  min="1"
                  max="100000"
                  step="1"
                  label="Pages"
                  type="number"
                  defaultValue={b.pages ? String(b.pages) : ""}
                />
                <Field
                  name="year"
                  id={`${b.slug}-year`}
                  min="1"
                  max="9999"
                  step="1"
                  label="Year"
                  type="number"
                  defaultValue={b.year ? String(b.year) : ""}
                />
                <Field
                  name="cover"
                  id={`${b.slug}-cover`}
                  maxLength={2000}
                  label="Cover path"
                  defaultValue={b.cover ?? ""}
                />
              </div>

              <div className="mt-5 grid gap-5">
                <div>
                  <label className="field-label" htmlFor={`${b.slug}-desc`}>
                    Short description
                  </label>
                  <textarea
                    id={`${b.slug}-desc`}
                    name="description"
                    maxLength={20000}
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
                    maxLength={40000}
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
                    maxLength={500}
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
                    maxLength={10000}
                    rows={5}
                    className="field-input resize-y font-mono text-[13px]"
                    defaultValue={Object.entries(b.facts ?? {})
                      .filter(([k]) => !k.startsWith("_"))
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
                    maxLength={10000}
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
                  <Save size={16} aria-hidden="true" /> Save metadata
                </button>
              </div>
            </form>
            {!b.third_party && (
              <form action="/api/admin/book" method="post" className="mt-4 grid gap-4 border-t border-line pt-4">
                <input type="hidden" name="action" value="release" />
                <input type="hidden" name="slug" value={b.slug} />
                <h3 className="text-base font-semibold">Release publication</h3>
                <Field id={`${b.slug}-release-submission`} name="submission_id" label="Reviewed submission ID" defaultValue={b.submission_id ?? ""} maxLength={120} required />
                <Field id={`${b.slug}-release-reason`} name="reason" label="Release reason" minLength={10} maxLength={2000} required />
                <label className="flex items-start gap-2 text-[15px]">
                  <input type="checkbox" name="confirmed" required className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]" />
                  I confirm release using the reviewed submission.
                </label>
                <button className="btn btn-primary justify-self-start" type="submit"><BookCheck size={16} aria-hidden="true" /> Release book</button>
              </form>
            )}
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}

function Field({
  name, label, defaultValue, hint, id = name + defaultValue?.slice(0, 4), ...rest
}: {
  name: string; label: string; defaultValue?: string; hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} name={name} className="field-input"
        defaultValue={defaultValue} {...rest} />
      {hint && <p className="mt-1.5 text-[13px] text-ink-soft">{hint}</p>}
    </div>
  );
}
