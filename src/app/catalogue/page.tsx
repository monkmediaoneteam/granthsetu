import Link from "next/link";
import { Search, X } from "lucide-react";
import { getBooks } from "@/lib/db";
import { getPublicContent } from "@/lib/content";
import { publicBook, visibleBook, type PublicBook } from "@/components/book-data";
import BookCard from "@/components/BookCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue" };
type Query = Record<string, string | string[] | undefined>;
const first = (value: Query[string]) => Array.isArray(value) ? value[0] || "" : value || "";
const keys = ["q", "subject", "language", "format", "collection", "author", "sort"] as const;
type Key = typeof keys[number];
type Params = Record<Key, string>;

// Plain links, so filtering works without JavaScript and every state has a shareable URL.
function catalogueHref(params: Params, key: Key, value: string | null) {
  const next = new URLSearchParams();
  for (const name of keys) {
    const current = name === key ? value : params[name];
    if (current) next.set(name, current);
  }
  const query = next.toString();
  return query ? `/catalogue?${query}` : "/catalogue";
}

export default async function Catalogue({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, records, content] = await Promise.all([searchParams, getBooks(), getPublicContent()]);
  const books = records.filter(visibleBook).map(publicBook);
  const params = Object.fromEntries(keys.map((key) => [key, first(query[key]).trim()])) as Params;
  const selectedCollection = content.collections.find((item) => item.slug === params.collection);
  const needle = params.q.toLocaleLowerCase();
  const tests: Record<Exclude<Key, "sort">, (book: PublicBook) => boolean> = {
    q: (book) => !needle || [book.title, book.subtitle, book.authorship, book.description, book.subject, book.isbn].some((value) => value?.toLocaleLowerCase().includes(needle)),
    subject: (book) => !params.subject || book.subject === params.subject,
    language: (book) => !params.language || book.language === params.language,
    format: (book) => !params.format || book.file_format === params.format,
    author: (book) => !params.author || book.author_slug === params.author,
    collection: (book) => !params.collection || Boolean(selectedCollection?.book_slugs.includes(book.slug)),
  };
  // Each facet counts against every other active filter, so a count is what a click will show.
  const matching = (except?: Key) => books.filter((book) => Object.entries(tests).every(([key, test]) => key === except || test(book)));
  const filtered = matching();
  if (params.sort === "price-asc") filtered.sort((a, b) => a.price_inr - b.price_inr);
  if (params.sort === "price-desc") filtered.sort((a, b) => b.price_inr - a.price_inr);
  if (params.sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));
  const facet = (key: Key, value: (book: PublicBook) => string | null | undefined, label: (book: PublicBook) => string | null | undefined = value) => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const book of matching(key)) {
      const id = value(book);
      if (id) counts.set(id, { label: label(book) || id, count: (counts.get(id)?.count || 0) + 1 });
    }
    return [...counts].sort((a, b) => a[1].label.localeCompare(b[1].label));
  };
  type Facet = { key: Key; title: string; options: [string, { label: string; count: number }][] };
  const facets = ([
    { key: "subject", title: "Subject", options: facet("subject", (book) => book.subject) },
    { key: "author", title: "Author", options: facet("author", (book) => book.author_slug, (book) => book.authorship) },
    { key: "language", title: "Language", options: facet("language", (book) => book.language) },
    { key: "format", title: "Format", options: facet("format", (book) => book.file_format) },
    { key: "collection", title: "Collection", options: content.collections.flatMap((item) => {
      const count = matching("collection").filter((book) => item.book_slugs.includes(book.slug)).length;
      return count ? [[item.slug, { label: item.title, count }] as [string, { label: string; count: number }]] : [];
    }) },
  ] satisfies Facet[] as Facet[]).filter((group) => group.options.length > 0 || params[group.key]);
  const chips = keys.filter((key) => key !== "sort" && params[key]).map((key) => ({ key,
    label: key === "q" ? `“${params.q}”` : facets.find((group) => group.key === key)?.options.find(([id]) => id === params[key])?.[1].label || params[key] }));
  const enabled = process.env.COMMERCE_ENABLED === "true";
  return <div className="wrap section">
    <div className="page-heading"><p className="eyebrow">The digital bookshelf</p><h1>{selectedCollection?.title || "The catalogue"}</h1>
      <p>{selectedCollection?.description || "Research, practice, and perspectives. Find a book to spend time with."}</p>
    </div>
    <div className="catalogue-layout">
      <aside className="facet-panel" aria-label="Filter books">
        <form action="/catalogue" className="facet-search" role="search">
          {keys.filter((key) => key !== "q" && params[key]).map((key) => <input key={key} type="hidden" name={key} value={params[key]} />)}
          <label className="field-label" htmlFor="catalogue-q">Search books</label>
          <div className="facet-search-row"><input id="catalogue-q" className="field-input" type="search" name="q" defaultValue={params.q} placeholder="Title, author, subject, ISBN" />
            <button className="btn btn-primary" type="submit" aria-label="Find books"><Search size={17} aria-hidden="true" /></button></div>
        </form>
        {facets.map((group) => <div className="facet-group" key={group.key}>
          <h2>{group.title}</h2>
          <ul>{group.options.map(([id, option]) => {
            const active = params[group.key] === id;
            return <li key={id}><Link href={catalogueHref(params, group.key, active ? null : id)} aria-current={active ? "true" : undefined}>
              <span>{option.label}</span><span className="facet-count">{option.count}</span></Link></li>;
          })}</ul>
        </div>)}
      </aside>
      <div className="catalogue-results">
        <div className="results-bar">
          <p className="result-count" role="status">{filtered.length} {filtered.length === 1 ? "title" : "titles"}</p>
          <nav className="sort-links" aria-label="Sort books"><span>Sort</span>
            {[["", "Featured"], ["title", "Title"], ["price-asc", "Price ↑"], ["price-desc", "Price ↓"]].map(([value, label]) =>
              <Link key={value} href={catalogueHref(params, "sort", value || null)} aria-current={params.sort === value ? "true" : undefined}>{label}</Link>)}
          </nav>
        </div>
        {chips.length > 0 && <ul className="filter-chips" aria-label="Active filters">
          {chips.map((chip) => <li key={chip.key}><Link href={catalogueHref(params, chip.key, null)} aria-label={`Remove filter ${chip.label}`}>{chip.label}<X size={14} aria-hidden="true" /></Link></li>)}
          <li><Link className="underline" href="/catalogue">Clear filters</Link></li>
        </ul>}
        {filtered.length ? <div className="book-grid">{filtered.map((book, index) => <BookCard book={book} index={index} enabled={enabled} key={book.slug} />)}</div>
          : <div className="empty-state"><h2>No books found.</h2><p>Try another title, author, or subject.</p><Link className="btn btn-ghost" href="/catalogue">Browse all books</Link></div>}
      </div>
    </div>
  </div>;
}
