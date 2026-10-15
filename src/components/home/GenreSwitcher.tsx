"use client";

import { useState } from "react";
import BookCard from "../BookCard";
import Carousel from "../Carousel";
import type { PublicBook } from "../book-data";

export default function GenreSwitcher({ genres, enabled }: { genres: { slug: string; name: string; books: PublicBook[] }[]; enabled: boolean }) {
  const [active, setActive] = useState(0);
  if (!genres.length) return null;
  const current = genres[Math.min(active, genres.length - 1)];
  return <section className="wrap section"><div className="genre-panel">
    <div className="genre-list" role="tablist" aria-label="Genres">{genres.map((g, i) => <button key={g.slug} type="button" role="tab" id={`genre-${g.slug}`}
      aria-selected={i === active} aria-controls="genre-books" onClick={() => setActive(i)}>{g.name}</button>)}</div>
    <div id="genre-books" role="tabpanel" aria-labelledby={`genre-${current.slug}`} className="genre-books">
      <Carousel title={current.name} href={`/category/${current.slug}`}>{current.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel>
    </div></div></section>;
}
