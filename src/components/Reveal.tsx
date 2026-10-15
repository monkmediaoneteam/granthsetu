"use client";
import { useEffect } from "react";

/**
 * Scroll reveal. Reveals once and stops observing — toggling elements back out
 * as you scroll up reads as jitter, not motion design.
 *
 * Elements inside a shared parent get a stagger index automatically, so groups
 * arrive in sequence rather than all at once.
 */
export default function Reveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    // Stagger siblings that share a parent.
    const byParent = new Map<Element, number>();
    for (const el of items) {
      if (el.style.getPropertyValue("--i")) continue;
      const parent = el.parentElement;
      if (!parent) continue;
      const n = byParent.get(parent) ?? 0;
      el.style.setProperty("--i", String(Math.min(n, 4)));
      byParent.set(parent, n + 1);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);

  return null;
}
