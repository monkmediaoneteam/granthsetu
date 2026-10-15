import Link from "next/link";
import { LANGUAGE_FONT, LANGUAGE_NATIVE } from "@/lib/languages";

export default function LanguageShelf({ languages }: { languages: { name: string; glyph: string; count: number }[] }) {
  if (languages.length < 2) return null;
  return <section className="wrap section"><div className="section-head"><div><h2>Read in your language</h2><p>Every edition is a native digital file, not a scan.</p></div></div>
    <ul className="lang-grid">{languages.map((l) => <li key={l.name}><Link className="lang-tile" href={`/search?language=${encodeURIComponent(l.name)}`}>
      <span className="lang-glyph akshara" style={{ fontFamily: LANGUAGE_FONT[l.name] ?? "var(--font-head)" }} aria-hidden="true">{l.glyph}</span>
      <span className="lang-name">{l.name}</span>
      {LANGUAGE_NATIVE[l.name] && LANGUAGE_NATIVE[l.name] !== l.name && <span className="lang-native">{LANGUAGE_NATIVE[l.name]}</span>}
      <span className="lang-count">{l.count} {l.count === 1 ? "book" : "books"}</span></Link></li>)}</ul></section>;
}
