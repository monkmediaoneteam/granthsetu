import Link from "next/link";
export default function AuthorStrip({ authors }: { authors: { id: string; name: string; photo_url: string | null }[] }) {
  if (!authors.length) return null;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <section className="wrap section center-section"><div className="section-head center"><div><h2>Discover authors</h2><p>The people behind the pages</p></div></div>
    <ul className="circle-row">{authors.map((a) => <li key={a.id}><Link href={`/authors/${encodeURIComponent(a.id)}`}>
      <span className="circle photo">{a.photo_url ? <img src={a.photo_url} alt="" loading="lazy" /> : <span aria-hidden="true">{initials(a.name)}</span>}</span><span>{a.name}</span></Link></li>)}</ul></section>;
}
