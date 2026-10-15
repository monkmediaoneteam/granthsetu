import Link from "next/link";
export default function LanguageShelf({ languages }: { languages: { name: string; glyph: string; count: number }[] }) {
  if (languages.length < 2) return null;
  return <section className="wrap section center-section"><div className="section-head center"><div><h2>Read in your language</h2><p>Books across India's languages</p></div></div>
    <ul className="circle-row">{languages.map((l) => <li key={l.name}><Link href={`/search?language=${encodeURIComponent(l.name)}`}>
      <span className="circle glyph" lang={l.name === "English" ? "en" : undefined} aria-hidden="true">{l.glyph}</span><span>{l.name}</span></Link></li>)}</ul></section>;
}
