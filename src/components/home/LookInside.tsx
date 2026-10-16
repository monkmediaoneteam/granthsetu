import Link from "next/link";
import Carousel from "../Carousel";
import Cover from "../Cover";
import type { PublicBook } from "../book-data";

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default function LookInside({ books }: { books: PublicBook[] }) {
  const items = books.filter((b) => b.highlights.length).slice(0, 8);
  if (!items.length) return null;
  return <section className="wrap section"><div className="look-band"><Carousel title="Look inside" tagline="A glimpse before you buy">
    {items.map((b) => <Link key={b.slug} href={`/books/${encodeURIComponent(b.slug)}`} className="look-card">
      <span className="look-cover"><Cover src={b.cover} title={b.title} sizes="96px" /></span>
      <span className="look-text"><span className="look-title">{b.title}</span><ul>{b.highlights.slice(0, 3).map((h, i) => <li key={i}>{clip(h)}</li>)}</ul></span>
    </Link>)}</Carousel></div></section>;
}
