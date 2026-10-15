import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, FlaskConical, Leaf, Library, Microscope, Sprout } from "lucide-react";
import type { PublicBook } from "./book-data";
import MotionBookLink from "./MotionBookLink";

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

export default function DiscoveryFeatures({ books }: { books: PublicBook[] }) {
  const featured = books.filter(book => book.cover && book.description).slice(0, 2);
  if (!featured.length) return null;
  return <section className="section reading-paths" aria-labelledby="reading-paths-title"><div className="wrap">
    <div className="section-heading"><div><p className="eyebrow">Between the covers</p><h2 id="reading-paths-title">Follow your curiosity.</h2></div><p className="muted small">A closer look at the ideas inside.</p></div>
    <div className="feature-grid">{featured.map((book, index) => <article className={`publication-feature feature-${index}`} key={book.slug}>
      <img className="feature-backdrop" src={index === 0 ? "/assets/reading-room-botanical-v2.webp" : "/assets/reading-room-campaign.webp"} alt="" loading="lazy" />
      <div className="feature-copy"><p className="eyebrow">{book.subject || "Ayurveda & natural products"}</p><h3>{book.title}</h3><p>{book.description}</p>
        <Link className="text-link" href={`/books/${encodeURIComponent(book.slug)}`}>Inside the book <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <MotionBookLink className="feature-cover" href={`/books/${encodeURIComponent(book.slug)}`} label={`Explore ${book.title}`}>
        <Image src={book.cover!} unoptimized={book.cover!.startsWith("https://")} alt={`Cover of ${book.title}`} width={1120} height={1400} sizes="(max-width: 640px) 120px, 200px" />
      </MotionBookLink>
    </article>)}</div>
  </div></section>;
}
