import Link from "next/link";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";
import Cover from "./Cover";
import WishlistButton from "./WishlistButton";
import QuickView from "./QuickView";
import { rupees } from "@/lib/money";

const href = (book: PublicBook) => `/books/${encodeURIComponent(book.slug)}`;

// The price hangs from the top of the cover like a bookmark ribbon; kumkum when the title is on offer.
function Ribbon({ book }: { book: PublicBook }) {
  if (book.comingSoon) return <span className="ribbon soon">Soon</span>;
  if (book.saleable && book.price > 0) return <span className={`ribbon${book.onSale ? " sale" : ""}`}>
    {book.onSale && <s aria-label={`Regular price ${rupees(book.regular)}`}>{rupees(book.regular)}</s>}
    <span>{rupees(book.price)}</span></span>;
  return null;
}

export default function BookCard({ book, enabled }: { book: PublicBook; index?: number; enabled: boolean }) {
  return <article className="product-card">
    <div className="card-stand">
      <Link href={href(book)} className="card-cover" aria-label={`View ${book.title}`} tabIndex={-1}>
        <Cover src={book.cover} title={book.title} sizes="(max-width: 640px) 45vw, 200px" />
      </Link>
      <Ribbon book={book} />
      <WishlistButton slug={book.slug} title={book.title} />
      <QuickView book={book} enabled={enabled} />
    </div>
    <span className="ledge" aria-hidden="true" />
    <div className="card-body">
      <h3><Link href={href(book)}>{book.title}</Link></h3>
      {book.authorship && <p className="card-author">{book.authorship}</p>}
      {book.onSale && <p className="card-saving">Save {rupees(book.saving)}</p>}
      <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} />
    </div>
  </article>;
}
