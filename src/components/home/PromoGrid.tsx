import Link from "next/link";
import BookCard from "../BookCard";
import type { Promo } from "@/lib/home";

export default function PromoGrid({ promos, enabled }: { promos: Promo[]; enabled: boolean }) {
  if (!promos.length) return null;
  const large = promos.find((p) => p.size === "large");
  const small = promos.filter((p) => p !== large).slice(0, 4);
  const tile = (p: Promo) => <Link key={p.id} href={p.href ?? "/search"} className={`promo-tile theme-${p.theme}`}>
    {p.image && <img src={p.image} alt="" loading="lazy" />}<span className="promo-title">{p.title}</span><span className="promo-cta">Shop now</span></Link>;
  return <section className="wrap section promo-grid" aria-label="Featured collections">
    {large && <div className={`promo-large theme-${large.theme}`}><h2><Link href={large.href ?? "/search"}>{large.title}</Link></h2>
      <div className="promo-books">{large.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</div></div>}
    <div className="promo-small">{small.map(tile)}</div>
  </section>;
}
