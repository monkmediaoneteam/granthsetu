"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import Cover from "../Cover";
import { LANGUAGE_FONT, LANGUAGE_GLYPHS, LANGUAGE_NATIVE } from "@/lib/languages";

type HeroBook = { slug: string; title: string; cover: string | null };

// The identity's one orchestrated moment: the first letter of each Indian script, cycling behind real covers.
export default function AksharaHero({ languages, covers }: { languages: string[]; covers: HeroBook[][] }) {
  const reduced = useReducedMotion();
  const list = ["English", ...languages.filter((l) => l !== "English" && LANGUAGE_GLYPHS[l])];
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const shown = useRef(0);

  const show = (next: number) => {
    if (next === shown.current) return;
    setLeaving(true);
    window.setTimeout(() => { shown.current = next; setIndex(next); setLeaving(false); }, 380);
  };
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 80); return () => window.clearTimeout(t); }, []);
  useEffect(() => {
    if (reduced || chosen || list.length < 2) return;
    const timer = window.setInterval(() => show((shown.current + 1) % list.length), 3400);
    return () => window.clearInterval(timer);
  }, [reduced, chosen, list.length]);
  useEffect(() => {
    if (reduced) return;
    const move = (e: PointerEvent) => {
      const el = stage.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--x", String((e.clientX - r.left) / r.width - .5));
      el.style.setProperty("--y", String((e.clientY - r.top) / r.height - .5));
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, [reduced]);

  const language = list[index];
  const set = covers.length ? covers[index % covers.length] : [];
  return <section className={`akshara-hero wrap${ready ? " ready" : ""}`}>
    <div className="hero-copy">
      <h1>Books from India&apos;s independent writers.</h1>
      <p>Science, Ayurveda, stories and research in digital editions you keep forever. Read in English, Hindi, Tamil and more.</p>
      <div className="hero-actions"><Link className="btn btn-neel" href="/search">Browse all books</Link><Link className="btn btn-outline" href="/publish">Publish your book</Link></div>
      {list.length > 1 && <div className="hero-langs" role="group" aria-label="Show the letter of a language">
        {list.map((l, i) => <button key={l} type="button" aria-pressed={i === index} lang={l === "English" ? "en" : undefined}
          onClick={() => { setChosen(true); show(i); }}>{LANGUAGE_NATIVE[l] ?? l}</button>)}
      </div>}
    </div>
    <div className="hero-stage" ref={stage} aria-hidden="true">
      <span className="hero-halo" />
      <span className={`hero-glyph akshara${leaving ? " out" : ""}`} style={{ fontFamily: LANGUAGE_FONT[language] ?? "var(--font-head)" }}>{LANGUAGE_GLYPHS[language] ?? "A"}</span>
      {set.map((book, i) => <Link key={`${index}-${book.slug}`} href={`/books/${encodeURIComponent(book.slug)}`} tabIndex={-1} className={`hero-book b${i}`}>
        <Cover src={book.cover} title={book.title} sizes="(max-width: 900px) 30vw, 180px" priority={index === 0} /></Link>)}
    </div>
  </section>;
}
