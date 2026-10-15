import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Cover from "../Cover";
export default function CategoryTiles({ tiles }: { tiles: { slug: string; name: string; colour: string | null; image: string | null; covers: string[] }[] }) {
  if (!tiles.length) return null;
  return <section className="wrap section"><div className="section-head"><div><h2>Shop by category</h2><p>Find your next read, your way</p></div></div>
    <ul className="category-tiles">{tiles.map((t) => <li key={t.slug}><Link href={`/category/${t.slug}`} className="category-tile" style={{ ["--tile" as string]: t.colour ?? "#FFD93D" }}>
      <span className="tile-art">{t.image ? <img src={t.image} alt="" loading="lazy" /> : t.covers.map((c, i) => <span key={i} className="tile-cover"><Cover src={c} title={t.name} sizes="90px" /></span>)}</span>
      <span className="tile-foot"><span>{t.name}</span><span className="chip-yellow">Shop now <ArrowUpRight size={14} aria-hidden="true" /></span></span></Link></li>)}</ul></section>;
}
