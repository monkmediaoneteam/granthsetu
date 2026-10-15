import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { rupees } from "@/lib/money";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";

const href = (book: PublicBook) => `/books/${encodeURIComponent(book.slug)}`;

// One geometry everywhere: covers sit in the same frame whatever their proportions.
export default function BookCard({ book, index = 0, enabled }: { book: PublicBook; index?: number; enabled: boolean }) {
  const priced = book.saleable && book.price_inr > 0;
  return <article className="book-card">
    <Link href={href(book)} className={`book-art tone-${index % 3}`} aria-label={`View ${book.title}`}>
      {book.cover ? <Image src={book.cover} unoptimized={book.cover.startsWith("https://")} alt={`Cover of ${book.title}`} width={1120} height={1400}
        sizes="(max-width: 640px) 44vw, 220px" className="book-cover" /> : <span className="cover-missing">{book.title}</span>}
      {book.file_format && <span className="format-tag">{book.file_format}</span>}
    </Link>
    <div className="book-card-copy">
      {book.subject && <p className="eyebrow">{book.subject}</p>}
      <h3><Link href={href(book)}>{book.title}</Link></h3>
      {book.authorship && <p className="book-author">{book.authorship}</p>}
      <div className="book-card-buy">
        {priced ? <span className="price">{rupees(book.price_inr)}</span> : <span className="status-pill">Forthcoming</span>}
        <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} />
      </div>
    </div>
  </article>;
}

// A rail keeps a row of books scannable at two titles or two hundred. Short
// rails end with an invitation tile instead of empty space.
export function Shelf({ books, enabled, label, invite = true }: { books: PublicBook[]; enabled: boolean; label: string; invite?: boolean }) {
  if (!books.length) return null;
  return <ul className="shelf-rail" aria-label={label} tabIndex={0}>
    {books.map((book, index) => <li key={book.slug}><BookCard book={book} index={index} enabled={enabled} /></li>)}
    {invite && books.length < 4 && <li className="shelf-endcap"><Link href="/publish">
      <PenLine size={26} strokeWidth={1.5} aria-hidden="true" />
      <span className="endcap-title">There is room on this shelf.</span>
      <span>Authors and publishers can submit a book for editorial review.</span>
      <span className="endcap-link">Publish with us <ArrowRight size={16} aria-hidden="true" /></span>
    </Link></li>}
  </ul>;
}
