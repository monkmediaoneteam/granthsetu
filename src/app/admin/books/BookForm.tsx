import type { Book } from "@/lib/db";
import { FILE_TYPE_KEYS, FILE_TYPES } from "@/lib/file-types";

const input = "field-input mt-1";

// The details form on a book's edit page. Each setting has one home: discounts are made on the Offers screen,
// visibility and "Put on sale" in the Status card, the file and cover in the Files card.
export default function BookForm({ book, categories, authors }: { book: Book; categories: { slug: string; name: string }[]; authors: { id: string; name: string }[] }) {
  const field = (name: keyof Book | string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    <label className="text-sm">{label}<input name={name} className={input} defaultValue={String((book as Record<string, unknown>)[name] ?? "")} {...props} /></label>;
  return <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="details-heading">
    <h2 id="details-heading" className="font-semibold">Book details</h2>
    <form action="/api/admin/book" method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="action" value="save" /><input type="hidden" name="slug" value={book.slug} />
      {/* The cover is set with Upload cover; saving details keeps it. Visibility is changed with the Status card's button. */}
      <input type="hidden" name="cover" value={book.cover ?? ""} />
      {book.active && <input type="hidden" name="active" value="on" />}
      {field("title", "Title", { required: true, maxLength: 200 })}
      {field("subtitle", "Subtitle", { maxLength: 200 })}
      {field("authorship", "Author line", { maxLength: 500 })}
      <label className="text-sm">Author profile<select name="author_slug" className={input} defaultValue={book.author_slug ?? ""}><option value="">None</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="text-sm">Subject<select name="category_slug" className={input} defaultValue={book.category_slug ?? ""}><option value="">None</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
      <label className="text-sm">Format<select name="file_format" className={input} defaultValue={book.file_format ?? "PDF"}>{FILE_TYPE_KEYS.map((key) => <option key={key} value={key.toUpperCase()}>{FILE_TYPES[key].label}</option>)}</select></label>
      {field("price_inr", "Regular price (₹)", { required: true, inputMode: "decimal", defaultValue: (book.price_inr / 100).toFixed(2) })}
      <label className="text-sm">Release date<input name="release_date" type="date" min="2000-01-01" className={input} defaultValue={book.release_date ? new Date(book.release_date).toISOString().slice(0, 10) : ""} />
        <span className="mt-1 block text-xs text-ink-soft">A future date shows the book as Coming soon.</span></label>
      {field("language", "Language", { maxLength: 60 })}
      {field("edition", "Edition", { maxLength: 120 })}
      {field("publisher", "Publisher", { maxLength: 200 })}
      {field("isbn", "ISBN", { maxLength: 32 })}
      {field("pages", "Pages", { inputMode: "numeric" })}
      {field("year", "Year", { inputMode: "numeric" })}
      <label className="text-sm sm:col-span-2">Short description<textarea name="description" rows={3} className={input} defaultValue={book.description ?? ""} /></label>
      <label className="text-sm sm:col-span-2">About the book<textarea name="long_description" rows={6} className={input} defaultValue={book.long_description ?? ""} /></label>
      <label className="text-sm">Contents and highlights (one per line)<textarea name="highlights" rows={5} className={input} defaultValue={(book.highlights || []).join("\n")} /></label>
      <label className="text-sm">Details (Key: Value per line)<textarea name="facts" rows={5} className={input} defaultValue={Object.entries(book.facts || {}).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}: ${v}`).join("\n")} /></label>
      <p className="text-sm text-ink-soft sm:col-span-2">Changing the format takes the book off sale until it is put on sale again. Discounts are set on the Offers screen.</p>
      <button className="btn btn-primary justify-self-start" type="submit">Save details</button>
    </form>
  </section>;
}
