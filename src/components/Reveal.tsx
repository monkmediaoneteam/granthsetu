"use client";
import { useEffect } from "react";

/** Mirrors the main site's IntersectionObserver reveal. */
export default function Reveal() {
  useEffect(() => {
    const items = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.target.classList.toggle("in", e.isIntersecting)),
      { threshold: 0.14, rootMargin: "0px 0px -12% 0px" }
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);
  return null;
}
