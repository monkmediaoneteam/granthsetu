import Link from "next/link";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";
import Cover from "./Cover";
import Price from "./Price";
import WishlistButton from "./WishlistButton";

const href = (book: PublicBook) => `/books/${encodeURIComponent(book.slug)}`;

export default function BookCard({ book, enabled }: { book: PublicBook; index?: number; enabled: boolean }) {
  return <article className="product-card">
    <WishlistButton slug={book.slug} title={book.title} />
    <Link href={href(book)} className="card-cover" aria-label={`View ${book.title}`} tabIndex={-1}>
      <Cover src={book.cover} title={book.title} sizes="(max-width: 640px) 45vw, 220px" />
      {book.comingSoon && <span className="card-flag">Coming soon</span>}
    </Link>
    <div className="card-body">
      <h3><Link href={href(book)}>{book.title}</Link></h3>
      {book.authorship && <p className="card-author">{book.authorship}</p>}
      <Price book={book} />
      <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} />
    </div>
  </article>;
}
