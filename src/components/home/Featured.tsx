import BookCard from "../BookCard";
import CatalogueEntry from "../CatalogueEntry";
import Carousel from "../Carousel";
import type { PublicBook } from "../book-data";
import type { Home } from "@/lib/home";

// Fewer than five titles read best as full catalogue cards; a larger shelf becomes rails.
export default function Featured({ books, rails, enabled }: { books: PublicBook[]; rails: Home["rails"]; enabled: boolean }) {
  if (!books.length) return <section className="wrap section"><p className="eyebrow">New titles on the way</p></section>;
  if (books.length < 5) return <section id="catalogue" className="wrap section">
    <div className="section-head reveal"><h2>The catalogue</h2><span className="pill">Prices in INR</span></div>
    <div className="entries">{books.map((b, i) => <CatalogueEntry key={b.slug} book={b} index={i + 1} enabled={enabled} />)}</div>
  </section>;
  const seen = new Set<string>();
  const once = (slug: string) => (seen.has(slug) ? false : (seen.add(slug), true));
  return <>{rails.map((r) => <div className="wrap section" key={r.key}><Carousel title={r.title} tagline={r.tagline} href={r.href}>
    {r.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} morph={once(b.slug)} />)}</Carousel></div>)}</>;
}
