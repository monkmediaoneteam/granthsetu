"use client";

import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";
import { motion, useReducedMotion } from "motion/react";

export default function AddToCart({ slug, title, enabled, saleable, saveable }: { slug: string; title: string; enabled: boolean; saleable: boolean; saveable: boolean }) {
  const cart = useCart();
  const reduced = useReducedMotion();
  const added = cart.slugs.includes(slug);
  const full = cart.slugs.length >= 20;
  const canSave = saleable || (!enabled && saveable);
  const label = !canSave ? "Unavailable" : full ? "Cart is full" : enabled ? "Add to cart" : "Save to cart";
  return <div className="cart-control">
    {added ? <Link className="btn btn-ghost" href="/cart"><Check size={17} aria-hidden="true" /> In your cart</Link>
      : <motion.button className="btn btn-primary" type="button" disabled={!cart.ready || !canSave || full}
        whileTap={reduced ? undefined : { scale: .96 }} transition={{ duration: .12 }}
        onClick={() => cart.add(slug)} aria-label={`${label}: ${title}`}>
        <ShoppingBag size={17} aria-hidden="true" />{label}
      </motion.button>}
    <span className="sr-only" role="status">{added ? `${title} is in your cart.` : ""}</span>
    {cart.error && <p className="small text-danger" role="alert">{cart.error}</p>}
  </div>;
}
