import { sql, type Book } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/AdminShell";
import { Archive, BookCheck, Eye } from "lucide-react";
import { releaseChecklist } from "@/lib/admin-catalogue";
import BookForm from "./BookForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books", robots: { index: false, follow: false } };

export default async function AdminBooks({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; q?: string }>;
}) {
  const { saved, q = "" } = await searchParams;
  if (!(await isAdmin())) redirect("/admin/login");

  const needle = q.trim().toLowerCase().slice(0, 100);
  const books = ((await sql`select * from books order by sort, title`) as (Book & { submission_id: string | null })[])
    .filter((b) => !needle || [b.title, b.slug, b.authorship ?? ""].some((v) => v.toLowerCase().includes(needle)));
  const categories = await sql`select slug,name from categories where status<>'archived' order by sort,name` as { slug: string; name: string }[];
  const authors = await sql`select id,name from author_profiles order by name` as { id: string; name: string }[];
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

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

      <form action="/api/admin/book" method="post" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <input type="hidden" name="action" value="create" />
        <label className="text-sm">Title<input name="title" required maxLength={200} className="field-input mt-1" /></label>
        <label className="text-sm">Slug<input name="slug" required maxLength={101} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field-input mt-1" /></label>
        <button className="btn btn-primary" type="submit">Create draft book</button>
      </form>
      <form method="get" className="mb-8 flex gap-3" role="search">
        <label className="sr-only" htmlFor="admin-book-search">Search books</label>
        <input id="admin-book-search" name="q" defaultValue={q} placeholder="Search by title, slug or author" className="field-input max-w-md" />
        <button className="btn btn-ghost" type="submit">Search</button>
      </form>

      <div className="grid gap-4">
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
            <details className="rounded-lg border border-line bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                <span className="font-semibold">{b.title}</span>
                <span className="text-sm text-ink-soft">{categoryName.get(b.category_slug ?? "") ?? "No category"} · ₹{(b.price_inr / 100).toFixed(2)} · {s ? `${s.orders} orders` : "No sales yet"}</span>
                <span className="text-sm text-ink-soft">{releaseChecklist(b).filter((i) => !i.ok).length ? `${releaseChecklist(b).filter((i) => !i.ok).length} release steps missing` : "Ready for sale"}</span>
              </summary>
              <div className="border-t border-line p-4"><BookForm book={b} categories={categories} authors={authors} />
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
            </details>
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
