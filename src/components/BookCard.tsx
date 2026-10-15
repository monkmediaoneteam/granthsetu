import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { rupees } from "@/lib/money";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";

export default function BookCard({ book, index = 0, enabled }: { book: PublicBook; index?: number; enabled: boolean }) {
  return <article className="book-card">
    <Link href={`/books/${encodeURIComponent(book.slug)}`} className={`book-art tone-${index % 3}`} aria-label={`View ${book.title}`}>
      {book.cover ? <Image src={book.cover} unoptimized={book.cover.startsWith("https://")} alt={`Cover of ${book.title}`} width={1120} height={1400}
        sizes="(max-width: 640px) 44vw, 220px" className="book-cover" /> : <span>{book.title}</span>}
      <span className="format-tag">{book.file_format || "Digital edition"}</span>
      <span className="art-arrow"><ArrowUpRight size={21} aria-hidden="true" /></span>
    </Link>
    <div className="book-card-copy">
      {book.subject && <p className="eyebrow">{book.subject}</p>}
      <h3><Link href={`/books/${encodeURIComponent(book.slug)}`}>{book.title}</Link></h3>
      {book.subtitle && <p className="book-subtitle">{book.subtitle}</p>}
      {book.authorship && <p className="small muted">{book.authorship}</p>}
      {book.description && <p className="book-summary">{book.description}</p>}
      <div className="book-card-buy"><span className={book.saleable && book.price_inr > 0 ? "price" : "small muted"}>{book.saleable && book.price_inr > 0 ? rupees(book.price_inr) : "Forthcoming digital edition"}</span>
        <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} />
      </div>
    </div>
  </article>;
}
