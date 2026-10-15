"use client";

import Link from "next/link";
import { Heart, ShoppingBag, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCart } from "./CartProvider";
import CategoryBar from "./CategoryBar";
import SearchBox from "./SearchBox";
import type { NavCategory } from "@/lib/navigation";

export default function StoreHeader({ name, nav, announcement }: {
  name: string; nav: { primary: NavCategory[]; more: NavCategory[] }; announcement: { title: string; link_url: string | null } | null;
}) {
  const { slugs, ready } = useCart();
  const reduced = useReducedMotion();
  const [brand, by] = name.includes(" by ") ? [name.split(" by ")[0], name.split(" by ").slice(1).join(" by ")] : [name, ""];
  const count = ready ? slugs.length : 0;
  return <header className="site-header">
    {announcement && <div className="announcement-bar">{announcement.link_url ? <Link href={announcement.link_url}>{announcement.title}</Link> : announcement.title}</div>}
    <div className="header-yellow"><div className="wrap header-row">
      <Link href="/" className="logo" aria-label={`${name}, home`}><span className="logo-mark" aria-hidden="true">R</span><span>{brand}{by && <small>by {by}</small>}</span></Link>
      <SearchBox />
      <nav className="header-icons" aria-label="Your account">
        <Link href="/wishlist" aria-label="Wishlist"><Heart size={22} strokeWidth={2} aria-hidden="true" /></Link>
        <Link href="/library" aria-label="Your library"><UserRound size={22} strokeWidth={2} aria-hidden="true" /></Link>
        <Link href="/cart" aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`} className="bag-link">
          <ShoppingBag size={22} strokeWidth={2} aria-hidden="true" />
          <motion.span key={count} className="count-badge" initial={false} animate={{ scale: reduced ? 1 : [1, 1.25, 1] }} transition={{ duration: .25 }}>{count}</motion.span>
        </Link>
      </nav>
    </div></div>
    <CategoryBar nav={nav} />
  </header>;
}
