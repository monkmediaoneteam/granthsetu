import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { NavCategory } from "@/lib/navigation";

export default function CategoryBar({ nav }: { nav: { primary: NavCategory[]; more: NavCategory[] } }) {
  const all = [...nav.primary, ...nav.more];
  if (!all.length) return null;
  return <nav className="category-bar" aria-label="Categories"><div className="wrap category-row">
    <div className="mega"><button type="button" className="mega-trigger" aria-haspopup="true">All categories <ChevronDown size={16} aria-hidden="true" /></button>
      <div className="mega-panel">{all.map((c) => <div key={c.slug}><Link className="mega-head" href={`/category/${c.slug}`}>{c.name}</Link>
        {c.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</div>)}</div></div>
    {nav.primary.map((c) => c.children.length
      ? <div className="mega" key={c.slug}><Link className="mega-trigger" href={`/category/${c.slug}`}>{c.name} <ChevronDown size={14} aria-hidden="true" /></Link>
          <div className="mega-panel small">{c.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</div></div>
      : <Link key={c.slug} href={`/category/${c.slug}`}>{c.name}</Link>)}
    <Link href="/search?offer=1" className="deal-link">Offers</Link>
  </div></nav>;
}
