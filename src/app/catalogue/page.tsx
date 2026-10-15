import Link from "next/link";
import { Search } from "lucide-react";
import { getBooks } from "@/lib/db";
import { getPublicContent } from "@/lib/content";
import { publicBook, visibleBook } from "@/components/book-data";
import BookCard from "@/components/BookCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue" };
type Query = Record<string, string | string[] | undefined>;
const first = (value: Query[string]) => Array.isArray(value) ? value[0] || "" : value || "";

export default async function Catalogue({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, records, content] = await Promise.all([searchParams, getBooks(), getPublicContent()]);
  const books = records.filter(visibleBook).map(publicBook);
  const q = first(query.q).trim();
  const subject = first(query.subject), language = first(query.language), collection = first(query.collection), sort = first(query.sort), author = first(query.author), format = first(query.format);
  const selectedCollection = content.collections.find((item) => item.slug === collection);
  let filtered = books.filter((book) =>
    (!q || [book.title, book.subtitle, book.authorship, book.description, book.subject, book.isbn].some((value) => value?.toLocaleLowerCase().includes(q.toLocaleLowerCase()))) &&
    (!subject || book.subject === subject) && (!language || book.language === language) && (!author || book.author_slug === author) && (!format || book.file_format === format) &&
    (!collection || Boolean(selectedCollection?.book_slugs.includes(book.slug))));
  if (sort === "price-asc") filtered.sort((a, b) => a.price_inr - b.price_inr);
  if (sort === "price-desc") filtered.sort((a, b) => b.price_inr - a.price_inr);
  if (sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));
  const subjects = [...new Set(books.flatMap((book) => book.subject ? [book.subject] : []))].sort();
  const languages = [...new Set(books.flatMap((book) => book.language ? [book.language] : []))].sort();
  const formats = [...new Set(books.flatMap((book) => book.file_format ? [book.file_format] : []))].sort();
  const enabled = process.env.COMMERCE_ENABLED === "true";
  return <div className="wrap section">
    <div className="page-heading"><p className="eyebrow">The digital bookshelf</p><h1>{selectedCollection?.title || "The catalogue"}</h1>
      <p>{selectedCollection?.description || "Research, practice, and perspectives. Find a book to spend time with."}</p>
    </div>
    <form action="/catalogue" className="filter-form" role="search">
      {author && <input type="hidden" name="author" value={author} />}
      <div className="search-filter"><label className="field-label" htmlFor="catalogue-q">Search books</label><input id="catalogue-q" className="field-input" type="search" name="q" defaultValue={q} placeholder="Title, author, subject, ISBN" /></div>
      {subjects.length > 0 && <div><label className="field-label" htmlFor="subject">Subject</label><select className="field-input" id="subject" name="subject" defaultValue={subject}><option value="">All subjects</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select></div>}
      {languages.length > 0 && <div><label className="field-label" htmlFor="language">Language</label><select className="field-input" id="language" name="language" defaultValue={language}><option value="">All languages</option>{languages.map((item) => <option key={item}>{item}</option>)}</select></div>}
      {formats.length > 0 && <div><label className="field-label" htmlFor="format">Format</label><select className="field-input" id="format" name="format" defaultValue={format}><option value="">All formats</option>{formats.map((item) => <option key={item}>{item}</option>)}</select></div>}
      {content.collections.length > 0 && <div><label className="field-label" htmlFor="collection">Collection</label><select className="field-input" id="collection" name="collection" defaultValue={collection}><option value="">All collections</option>{content.collections.map((item) => <option value={item.slug} key={item.slug}>{item.title}</option>)}</select></div>}
      <div><label className="field-label" htmlFor="sort">Sort by</label><select className="field-input" id="sort" name="sort" defaultValue={sort}><option value="">Catalogue order</option><option value="title">Title</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div>
      <button className="btn btn-primary" type="submit"><Search size={17} aria-hidden="true" /> Find books</button>
    </form>
    <p className="result-count">{filtered.length} {filtered.length === 1 ? "title" : "titles"}{q ? ` matching "${q}"` : ""}{(q || subject || language || collection || author || format) && <> · <Link className="underline" href="/catalogue">Clear filters</Link></>}</p>
    {filtered.length ? <div className="book-grid">{filtered.map((book, index) => <BookCard book={book} index={index} enabled={enabled} key={book.slug} />)}</div>
      : <div className="empty-state"><h2>No books found.</h2><p>Try another title, author, or subject.</p><Link className="btn btn-ghost" href="/catalogue">Browse all books</Link></div>}
  </div>;
}
