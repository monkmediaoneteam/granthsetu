"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export default function Carousel({ title, tagline, href, label, children }: { title: string; tagline?: string; href?: string; label?: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = track.current;
    if (el) setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);
  const page = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.9, behavior: "smooth" });
  const items = Children.toArray(children);
  if (!items.length) return null;
  return <section className="carousel" aria-label={label ?? title}>
    <div className="section-head"><div><h2>{title}</h2>{tagline && <p>{tagline}</p>}</div>
      <div className="section-actions">
        {!(edges.start && edges.end) && <>
          <button type="button" className="round-btn" onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous in ${title}`}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" className="round-btn" onClick={() => page(1)} disabled={edges.end} aria-label={`Next in ${title}`}><ChevronRight size={20} aria-hidden="true" /></button></>}
        {href && <Link className="link-line" href={href}>See all</Link>}
      </div></div>
    <ul ref={track} className="carousel-track" onScroll={measure}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
  </section>;
}
