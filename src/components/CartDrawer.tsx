"use client";

import Link from "next/link";
import { Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rupees } from "@/lib/money";
import { useCart } from "./CartProvider";
import Cover from "./Cover";

type Line = { slug: string; title: string; cover: string | null; authorship: string | null; price: number; regular: number; onSale: boolean; saleable: boolean };

export default function CartDrawer() {
  const cart = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (cart.drawerOpen && !el.open) el.showModal();
    if (!cart.drawerOpen && el.open) el.close();
  }, [cart.drawerOpen]);
  useEffect(() => {
    if (!cart.drawerOpen) return;
    let live = true;
    setFailed(false);
    fetch("/api/cart/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: cart.slugs }) })
      .then((r) => r.ok ? r.json() : Promise.reject()).then((d: { books: Line[] }) => { if (live) setLines(d.books); })
      .catch(() => { if (live) { setLines(null); setFailed(true); } });
    return () => { live = false; };
  }, [cart.drawerOpen, cart.slugs]);
  const added = lines?.find((l) => l.slug === cart.lastAdded);
  const payable = lines?.filter((l) => l.saleable) ?? [];
  const subtotal = payable.reduce((sum, l) => sum + l.price, 0);
  return <dialog ref={dialog} className="cart-drawer" aria-labelledby="drawer-title" onClose={cart.closeDrawer} onClick={(e) => { if (e.target === dialog.current) cart.closeDrawer(); }}>
    <div className="drawer-head"><h2 id="drawer-title">Your bag ({cart.slugs.length})</h2>
      <button type="button" className="round-btn" onClick={cart.closeDrawer} aria-label="Close bag"><X size={18} aria-hidden="true" /></button></div>
    {added && <p className="drawer-added" role="status"><Check size={16} aria-hidden="true" /> Added to bag: {added.title}</p>}
    {failed ? <p className="drawer-note">Prices unavailable right now. <Link href="/cart" onClick={cart.closeDrawer}>View bag</Link></p>
      : !lines ? <p className="drawer-note" role="status">Loading your bag…</p>
      : <ul className="drawer-lines">{lines.map((l) => <li key={l.slug}><span className="drawer-cover"><Cover src={l.cover} title={l.title} sizes="56px" /></span>
          <span className="drawer-text"><Link href={`/books/${encodeURIComponent(l.slug)}`} onClick={cart.closeDrawer}>{l.title}</Link>
            <span>{l.saleable ? <>{l.onSale && <s>{rupees(l.regular)}</s>} <strong>{rupees(l.price)}</strong></> : "Not yet on sale"}</span></span>
          <button type="button" className="icon-plain" onClick={() => cart.remove(l.slug)} aria-label={`Remove ${l.title} from bag`}><Trash2 size={17} aria-hidden="true" /></button></li>)}</ul>}
    <div className="drawer-foot">
      {lines && payable.length > 0 && <p className="drawer-subtotal"><span>Subtotal</span><strong>{rupees(subtotal)}</strong></p>}
      <p className="drawer-note">Final prices are confirmed at checkout.</p>
      <div className="drawer-actions"><Link className="btn btn-outline" href="/cart" onClick={cart.closeDrawer}>View bag</Link>
        <Link className="btn btn-yellow" href="/checkout" onClick={cart.closeDrawer}>Checkout</Link></div>
    </div>
  </dialog>;
}
