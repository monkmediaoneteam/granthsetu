"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Banner } from "@/lib/home";

// Shown only until the admin adds a hero banner (Admin > Banners > Hero carousel).
const PLACEHOLDER = { desktop: "/api/placeholder/hero?variant=desktop", mobile: "/api/placeholder/hero?variant=mobile" };

function Art({ banner, first }: { banner: Banner; first: boolean }) {
  return <picture className="hero-image">
    {banner.mobileImage && <source media="(max-width: 640px)" srcSet={banner.mobileImage} />}
    <img src={banner.image!} alt={banner.title} fetchPriority={first ? "high" : undefined} loading={first ? "eager" : "lazy"} />
  </picture>;
}

// The homepage hero: the admin's banner images, rotating in the order set in Admin > Banners. No text is drawn on top;
// each image carries its own message and, if set, links where the admin chose.
export default function HeroCampaign({ banners }: { banners: Banner[] }) {
  const slides = banners.filter((b) => b.image);
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const many = slides.length > 1;
  useEffect(() => {
    if (!many || paused || hover || reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [many, paused, hover, reduced, slides.length]);
  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length);

  if (!slides.length) return <section className="hero-campaign image-hero" aria-label="Featured">
    <div className="hero-slide has-mobile"><picture className="hero-image">
      <source media="(max-width: 640px)" srcSet={PLACEHOLDER.mobile} />
      <img src={PLACEHOLDER.desktop} alt="" fetchPriority="high" />
    </picture></div>
  </section>;

  return <section className="hero-campaign image-hero" aria-roledescription={many ? "carousel" : undefined} aria-label="Featured"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
    {slides.map((s, i) => <div key={s.id} className={`hero-slide${s.mobileImage ? " has-mobile" : ""}`} hidden={i !== index} role={many ? "group" : undefined}
      aria-roledescription={many ? "slide" : undefined} aria-label={many ? `${i + 1} of ${slides.length}` : undefined}>
      {s.href ? <Link href={s.href} className="hero-link" aria-label={s.title} tabIndex={i === index ? 0 : -1}><Art banner={s} first={i === 0} /></Link> : <Art banner={s} first={i === 0} />}
    </div>)}
    {many && <div className="hero-controls">
      <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Previous slide"><ChevronLeft size={17} aria-hidden="true" /></button>
      <div className="hero-dots">{slides.map((s, i) => <button key={s.id} type="button" aria-label={`Show slide ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)} />)}</div>
      <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Next slide"><ChevronRight size={17} aria-hidden="true" /></button>
      {mounted && !reduced && <button type="button" className="round-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play slides" : "Pause slides"}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}</button>}
    </div>}
  </section>;
}
