import Link from "next/link";
import Cover from "../Cover";
import Price from "../Price";
import type { PublicBook } from "../book-data";

// Two retail promo cards beside the hero: the deepest saving and the newest title, always real books.
export function sideBooks(books: PublicBook[]) {
  const live = books.filter((b) => !b.comingSoon);
  const deal = [...live].sort((a, b) => b.saving - a.saving || b.price - a.price)[0];
  const fresh = [...live].sort((a, b) => String(b.release_date ?? "").localeCompare(String(a.release_date ?? "")) || (b.year ?? 0) - (a.year ?? 0))
    .find((b) => b.slug !== deal?.slug) ?? deal;
  return { deal, fresh };
}

function Card({ book, kicker, tone }: { book: PublicBook; kicker: string; tone: "gold" | "green" }) {
  const off = book.onSale && book.regular > 0 ? Math.round((book.saving / book.regular) * 100) : 0;
  return <Link href={`/books/${encodeURIComponent(book.slug)}`} className={`side-card side-${tone}`}>
    <span className="side-text">
      <span className="eyebrow">{off > 0 ? `${off}% off · ${kicker}` : kicker}</span>
      <span className="side-title">{book.title}</span>
      <Price book={book} />
      <span className="link-line">Shop now <span aria-hidden="true">→</span></span>
    </span>
    <span className="side-cover"><Cover src={book.cover} title={book.title} sizes="120px" /></span>
  </Link>;
}

export default function HomeSide({ books }: { books: PublicBook[] }) {
  const { deal, fresh } = sideBooks(books);
  if (!deal) return null;
  return <aside className="home-side" aria-label="Deals">
    <Card book={deal} kicker="Deal of the day" tone="gold" />
    {fresh && <Card book={fresh} kicker="New arrival" tone="green" />}
  </aside>;
}
