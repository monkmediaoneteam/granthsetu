"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Search, ShoppingBag, Library } from "lucide-react";
import { useCart } from "./CartProvider";
import { motion, useReducedMotion } from "motion/react";

export default function StoreHeader({ name }: { name: string }) {
  const { slugs, ready } = useCart();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return <header className="store-header">
    <div className="store-ribbon">Books for enquiring minds. <Link href="/publish">Share your work with us <span aria-hidden="true">&rarr;</span></Link></div>
    <div className="wrap header-main">
      <Link href="/" className="brand" aria-label={`${name}, home`}>
        <BookOpen size={29} strokeWidth={1.4} aria-hidden="true" />
        <span>{name.includes(" by ") ? <>{name.split(" by ")[0]}<small>by {name.split(" by ").slice(1).join(" by ")}</small></> : name}</span>
      </Link>
      <form action="/catalogue" className="header-search" role="search">
        <label htmlFor="site-search" className="sr-only">Search books, authors, subjects</label>
        <input id="site-search" name="q" type="search" placeholder="Search by title, author or ISBN" />
        <button type="submit" className="icon-button" aria-label="Search catalogue" title="Search catalogue"><Search size={19} aria-hidden="true" /></button>
      </form>
      <Link href="/library" className="header-library" aria-label="My library" title="My library"><Library size={21} aria-hidden="true" /><span>My library</span></Link>
      <Link href="/cart" className="cart-link" aria-label={`Cart, ${ready ? slugs.length : 0} titles`}>
        <ShoppingBag size={21} aria-hidden="true" /><span>Cart</span><motion.span key={ready ? slugs.length : 0} className="cart-count"
          initial={false} animate={{ scale: reduced ? 1 : [1, 1.2, 1] }} transition={{ duration: .25 }}>{ready ? slugs.length : 0}</motion.span>
      </Link>
    </div>
    <nav className="wrap header-nav" aria-label="Main navigation">
      {[["Home", "/"], ["All books", "/catalogue"], ["Ayurveda", "/catalogue?q=Ayurveda"], ["Research", "/catalogue?q=research"], ["Publish with us", "/publish"]].map(([label, href]) =>
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
      <span className="nav-caption">Independent thought. Shared knowledge.</span>
    </nav>
  </header>;
}
