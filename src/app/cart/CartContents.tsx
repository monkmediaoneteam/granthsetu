"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { cartTotals, useCart } from "@/components/CartProvider";
import type { PublicBook } from "@/components/book-data";
import { rupees } from "@/lib/money";

export default function CartContents({ books, enabled }: { books: PublicBook[]; enabled: boolean }) {
  const cart = useCart();
  if (!cart.ready) return <p role="status">Loading your cart...</p>;
  if (!cart.slugs.length) return <div className="empty-state"><ShoppingBag size={30} aria-hidden="true" /><h2>Your next chapter starts here.</h2><p>Your cart is empty.</p><Link href="/catalogue" className="btn btn-primary">Explore the books <ArrowRight size={17} aria-hidden="true" /></Link></div>;
  const selected = cart.slugs.flatMap((slug) => books.filter((book) => book.slug === slug));
  const missing = cart.slugs.filter((slug) => !books.some((book) => book.slug === slug));
  const totals = selected.every((book) => book.saleable) ? cartTotals(selected) : null;
  const totalLabel = totals ? rupees(totals.total) : "Not yet on sale";
  const unavailable = !totals || missing.length > 0 || selected.some((book) => !book.saleable);
  return <div className="cart-layout">
    <div>{selected.map((book) => <article className="cart-row" key={book.slug}>
      <Link href={`/books/${encodeURIComponent(book.slug)}`} tabIndex={-1} aria-hidden="true">{book.cover && <Image src={book.cover} unoptimized={book.cover.startsWith("https://")} alt="" width={112} height={140} />}</Link>
      <div><h2><Link href={`/books/${encodeURIComponent(book.slug)}`}>{book.title}</Link></h2>{book.file_format && <p className="small muted">{book.file_format} digital edition</p>}<p className={book.saleable && book.price_inr > 0 ? "price" : "small muted"}>{book.saleable && book.price_inr > 0 ? rupees(book.price_inr) : "Not yet on sale"}</p>{!book.saleable && <p className="small muted">{enabled ? "Not available for purchase" : "Saved for later"}</p>}</div>
      <button className="icon-button" type="button" title={`Remove ${book.title}`} aria-label={`Remove ${book.title} from cart`} onClick={() => cart.remove(book.slug)}><Trash2 size={19} aria-hidden="true" /></button>
    </article>)}
      {missing.map((slug) => <div className="cart-row" key={slug}><span /><div><p>This title is no longer available.</p><p className="small muted">{slug}</p></div><button type="button" className="icon-button" title="Remove unavailable title" aria-label={`Remove unavailable title ${slug}`} onClick={() => cart.remove(slug)}><Trash2 size={19} aria-hidden="true" /></button></div>)}
      {cart.error && <p className="small text-danger" role="alert">{cart.error}</p>}
      <Link className="text-link mt-6" href="/catalogue">Continue browsing <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
    <aside className="order-summary"><h2>Your selection</h2><div className="summary-line"><span>{cart.slugs.length} {cart.slugs.length === 1 ? "edition" : "editions"}</span><span>{totals ? rupees(totals.subtotal) : totalLabel}</span></div>
      {totals && totals.tax > 0 && <div className="summary-line"><span>Tax</span><span>{rupees(totals.tax)}</span></div>}
      <div className="summary-line summary-total"><span>Total</span><span>{totalLabel}</span></div>
      {!enabled && <p className="purchase-paused">Online ordering is currently unavailable. You can keep browsing and save titles in your cart for later.</p>}
      {(missing.length > 0 || (enabled && unavailable)) && <p className="small text-danger">Remove unavailable titles to continue.</p>}
      {enabled && !unavailable ? <Link className="btn btn-primary" href="/checkout">Continue to checkout <ArrowRight size={17} aria-hidden="true" /></Link> : <button className="btn btn-primary" type="button" disabled>Checkout unavailable</button>}
      <p className="small muted">Digital editions for personal use. Prices and availability are confirmed at checkout.</p>
    </aside>
  </div>;
}
