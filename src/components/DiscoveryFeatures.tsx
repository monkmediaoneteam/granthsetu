import Link from "next/link";
import { ArrowRight, BookOpen, FlaskConical, Leaf, Library, Microscope, Sprout } from "lucide-react";
import type { PublicBook } from "./book-data";

const subjects = [
  { label: "Ayurveda", query: "Ayurveda", icon: Leaf },
  { label: "Research", query: "research", icon: Microscope },
  { label: "Natural products", query: "natural products", icon: Sprout },
  { label: "Phytopharmaceuticals", query: "phytopharmaceuticals", icon: FlaskConical },
  { label: "Reference books", query: "reference", icon: BookOpen },
];

export function SubjectNavigation({ books }: { books: PublicBook[] }) {
  const available = subjects.filter(({ query }) => books.some(book =>
    [book.title, book.subtitle, book.description, book.subject].some(value => value?.toLowerCase().includes(query.toLowerCase()))));
  if (!books.length) return null;
  return <nav className="wrap subject-navigation" aria-label="Browse books by interest">
    {available.map(({ label, query, icon: Icon }) => <Link href={`/catalogue?q=${encodeURIComponent(query)}`} key={label}>
      <span className="subject-icon"><Icon size={30} strokeWidth={1.8} aria-hidden="true" /></span><span>{label}</span><ArrowRight className="subject-arrow" size={16} aria-hidden="true" />
    </Link>)}
    <Link href="/catalogue"><span className="subject-icon"><Library size={30} strokeWidth={1.8} aria-hidden="true" /></span><span>All books</span><ArrowRight className="subject-arrow" size={16} aria-hidden="true" /></Link>
  </nav>;
}

// Text from inside the books, not a second set of covers: the shelf above already shows them.
export default function DiscoveryFeatures({ books }: { books: PublicBook[] }) {
  const featured = books.filter(book => book.highlights.length || book.description).slice(0, 2);
  if (!featured.length) return null;
  return <section className="section look-inside" aria-labelledby="look-inside-title"><div className="wrap">
    <div className="section-heading"><div><p className="eyebrow">Look inside</p><h2 id="look-inside-title">What you will find between the covers.</h2></div></div>
    <div className="look-grid">{featured.map((book, index) => <article className="look-card" key={book.slug}>
      <p className="look-index">{String(index + 1).padStart(2, "0")}</p>
      <div><p className="eyebrow">{book.subject || "Digital edition"}</p><h3>{book.title}</h3>
        {book.highlights.length ? <ul>{book.highlights.slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>{book.description}</p>}
        <Link className="text-link" href={`/books/${encodeURIComponent(book.slug)}`}>Read the full contents <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </article>)}</div>
  </div></section>;
}
