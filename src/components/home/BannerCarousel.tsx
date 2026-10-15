"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Banner } from "@/lib/home";

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const many = banners.length > 1;
  useEffect(() => {
    if (!many || paused || hover || reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [many, paused, hover, reduced, banners.length]);
  if (!banners.length) return null;
  const go = (step: number) => setIndex((i) => (i + step + banners.length) % banners.length);
  return <section className="banner-carousel wrap" aria-roledescription="carousel" aria-label="Featured offers"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
    <div className="banner-viewport">{banners.map((b, i) => <div key={b.id} className={`banner-slide theme-${b.theme}`} hidden={i !== index}
      role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${banners.length}`}>
      {b.image && <picture className="banner-art">{b.mobileImage && <source media="(max-width: 640px)" srcSet={b.mobileImage} />}<img src={b.image} alt="" /></picture>}
      <div className="banner-copy">{b.subtitle && <p className="banner-kicker">{b.subtitle}</p>}<h2>{b.title}</h2>{b.body && <p>{b.body}</p>}
        {b.href && <Link className="btn btn-dark" href={b.href}>{b.label || "Shop now"}</Link>}</div>
    </div>)}</div>
    {many && <div className="banner-controls">
      <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Previous offer"><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className="banner-dots">{banners.map((b, i) => <button key={b.id} type="button" aria-label={`Show offer ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)} />)}</div>
      <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Next offer"><ChevronRight size={18} aria-hidden="true" /></button>
      {!reduced && <button type="button" className="round-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play offers" : "Pause offers"}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>}
    </div>}
  </section>;
}
