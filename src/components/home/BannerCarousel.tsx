"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Banner } from "@/lib/home";
import Cover from "../Cover";

// Script letterforms drifting behind the copy: the band carries the identity, admin supplies the words.
const SCRIPT_ROW = "अ आ इ ई உ ஊ এ ঐ ઓ ಔ క ఖ ক খ গ ઘ ङ ச ஞ ಟ ఠ ड ढ ण";

export default function BannerCarousel({ banners, covers = [] }: { banners: Banner[]; covers?: { slug: string; title: string; cover: string | null }[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  // The reduced-motion preference is only known in the browser; render its control after mount so hydration matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
      <div className="band-script" aria-hidden="true"><span>{SCRIPT_ROW} {SCRIPT_ROW}</span><span>{SCRIPT_ROW} {SCRIPT_ROW}</span></div>
      {b.image && <picture className="banner-art">{b.mobileImage && <source media="(max-width: 640px)" srcSet={b.mobileImage} />}<img src={b.image} alt="" /></picture>}
      <div className="banner-copy">{b.subtitle && <p className="banner-kicker">{b.subtitle}</p>}<h2>{b.title}</h2>{b.body && <p>{b.body}</p>}
        {b.href && <Link className="btn band-btn" href={b.href}>{b.label || "Shop now"}</Link>}</div>
      {!b.image && covers.length >= 3 && <div className="band-books" aria-hidden="true">{[0, 1, 2].map((k) => covers[(i * 3 + k) % covers.length]).map((c) =>
        <span key={c.slug} className="band-book"><Cover src={c.cover} title={c.title} sizes="160px" /></span>)}</div>}
    </div>)}</div>
    {many && <div className="banner-controls">
      <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Previous offer"><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className="banner-dots">{banners.map((b, i) => <button key={b.id} type="button" aria-label={`Show offer ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)} />)}</div>
      <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Next offer"><ChevronRight size={18} aria-hidden="true" /></button>
      {mounted && !reduced && <button type="button" className="round-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play offers" : "Pause offers"}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>}
    </div>}
  </section>;
}
