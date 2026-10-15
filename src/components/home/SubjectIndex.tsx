"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Cover from "../Cover";

type Subject = { slug: string; name: string; count: number; covers: string[] };

// Subjects as a typographic index; pointing at one fans its covers out beside the cursor.
export default function SubjectIndex({ subjects }: { subjects: Subject[] }) {
  const fan = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Subject | null>(null);
  if (!subjects.length) return null;
  const follow = (e: React.PointerEvent) => { if (fan.current) fan.current.style.transform = `translate(${e.clientX + 28}px, ${e.clientY - 96}px)`; };
  return <section className="wrap section">
    <div className="section-head"><div><h2>Browse by subject</h2><p>Point at a subject to see what&apos;s inside.</p></div><Link className="link-line" href="/search">All books</Link></div>
    <ul className="subject-index" onPointerLeave={() => setActive(null)}>
      {subjects.map((s) => <li key={s.slug}><Link href={`/category/${s.slug}`} onPointerEnter={(e) => { follow(e); setActive(s); }} onPointerMove={follow}>
        <span className="subject-name">{s.name}</span><span className="subject-count">{s.count} {s.count === 1 ? "book" : "books"}</span></Link></li>)}
    </ul>
    <div ref={fan} className={`subject-fan${active ? " on" : ""}`} aria-hidden="true">
      {(active?.covers ?? []).slice(0, 3).map((c, i) => <span key={`${active?.slug}-${i}`}><Cover src={c} title="" sizes="96px" /></span>)}
    </div>
  </section>;
}
