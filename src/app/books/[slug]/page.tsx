import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, BookOpen, Download, FileText, Globe2, Hash, Infinity as Lifetime, Layers, Lock, Building2 } from "lucide-react";
import { getBook, getBooks } from "@/lib/db";
import { getPublicContent, safeUrl } from "@/lib/content";
import { bookJsonLd, jsonLdHtml } from "@/lib/catalogue";
import { siteUrl } from "@/lib/store";
import { getCategories } from "@/lib/store-data";
import { publicBook, visibleBook } from "@/components/book-data";
import AddToCart from "@/components/AddToCart";
import BookCard from "@/components/BookCard";
import Carousel from "@/components/Carousel";
import Cover from "@/components/Cover";
import Price from "@/components/Price";
import BookTabs from "@/components/product/BookTabs";
import ShareButton from "@/components/product/ShareButton";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const book = await getBook((await params).slug);
  if (!book || !visibleBook(book)) return { title: "Book not found", robots: { index: false } };
  return { title: book.title, description: book.description || undefined,
    alternates: { canonical: `${siteUrl()}/books/${encodeURIComponent(book.slug)}` },
    openGraph: { title: book.title, description: book.description || undefined, images: book.cover && !book.cover.startsWith("data:") ? [book.cover] : [] } };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const now = new Date();
  const [book, records, content, categories] = await Promise.all([getBook((await params).slug), getBooks(), getPublicContent(), getCategories()]);
  if (!book || !visibleBook(book)) notFound();
  const view = publicBook(book, now);
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const url = `${siteUrl()}/books/${encodeURIComponent(book.slug)}`;
  const category = categories.find((c) => c.slug === book.category_slug);
  const author = book.author_slug ? content.authors.find((a) => a.id === book.author_slug) : undefined;
  let sample: string | null = null;
  try { sample = safeUrl(book.sample_url); } catch { /* A malformed sample is not offered. */ }
  const others = records.filter((r) => r.slug !== book.slug && visibleBook(r)).map((r) => publicBook(r, now));
  const byAuthor = book.author_slug ? others.filter((o) => o.author_slug === book.author_slug).slice(0, 12) : [];
  const similar = others.filter((o) => o.category_slug && o.category_slug === book.category_slug && !byAuthor.includes(o)).slice(0, 12);
  const details: [typeof BookOpen, string, string | number | null | undefined][] = [
    [FileText, "Format", book.file_format], [Layers, "Pages", book.pages], [Globe2, "Language", view.language], [Hash, "ISBN", book.isbn],
    [Building2, "Publisher", book.publisher], [BookOpen, "Edition", view.edition], [BadgeCheck, "Published", book.release_date ? String(book.release_date).slice(0, 10) : book.year],
  ];
  const facts = Object.entries(book.facts || {}).filter(([k]) => !k.startsWith("_"));
  const paragraphs = (book.long_description || "").split(/\n\s*\n/).filter(Boolean);
  const tabs = [
    (paragraphs.length || book.description) && { id: "about", label: "About the book", content: <div className="prose">{(paragraphs.length ? paragraphs : [book.description!]).map((p, i) => <p key={i}>{p}</p>)}</div> },
    view.highlights.length && { id: "contents", label: "Contents", content: <ul className="contents-list">{view.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> },
    facts.length && { id: "details", label: "More details", content: <table className="spec-table"><tbody>{facts.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table> },
    author && { id: "author", label: "About the author", content: <div className="prose"><p><strong>{author.name}</strong></p>{author.bio && <p>{author.bio}</p>}<p><Link className="text-link" href={`/authors/${encodeURIComponent(author.id)}`}>All books by {author.name}</Link></p></div> },
  ].filter(Boolean) as { id: string; label: string; content: React.ReactNode }[];
  return <div className="product-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(bookJsonLd(book, url, view.saleable, now)) }} />
    <div className="wrap">
      <nav className="crumbs product-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / {category && <><Link href={`/category/${category.slug}`}>{category.name}</Link> / </>}<span aria-current="page">{book.title}</span></nav>
      <article className="product-main">
        <div className="product-gallery"><div className="gallery-stage"><Cover src={book.cover} title={book.title} sizes="(max-width: 900px) 80vw, 420px" priority /></div>
          {sample && <a className="btn btn-outline sample-btn" href={sample} target="_blank" rel="noopener noreferrer"><BookOpen size={17} aria-hidden="true" /> Read a sample</a>}</div>
        <div className="product-info">
          <div className="title-row"><h1>{book.title}</h1><div className="title-actions">{/* wishlist heart: Task C2 */}<ShareButton title={book.title} url={url} /></div></div>
          {book.subtitle && <p className="product-subtitle">{book.subtitle}</p>}
          {book.authorship && <p className="product-author">by {book.author_slug ? <Link href={`/authors/${encodeURIComponent(book.author_slug)}`}>{book.authorship}</Link> : book.authorship}</p>}
          <ul className="tag-row">{category && <li><Link className="chip" href={`/category/${category.slug}`}>{category.name}</Link></li>}
            {view.language && <li><Link className="chip" href={`/search?language=${encodeURIComponent(view.language)}`}>{view.language}</Link></li>}
            {book.file_format && <li><span className="chip">{book.file_format}</span></li>}</ul>
          <Price book={view} size="page" />
          {view.saleable && <p className="tax-note">Digital edition · Personal-use licence</p>}
          <div className="buy-row"><AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} saveable={view.saveable} />{/* Buy now: Task C4 */}</div>
          {!enabled && <p className="notice">Online ordering is opening soon. Save this book to your bag and check out when it opens.</p>}
          <ul className="trust-row">{[[Download, "Instant download"], [Lock, "Secure payment"], [BadgeCheck, "Licensed copy"], [Lifetime, "Lifetime library"]].map(([Icon, label]) =>
            <li key={label as string}><span className="trust-icon"><Icon size={22} aria-hidden="true" /></span>{label as string}</li>)}</ul>
          <dl className="detail-strip">{details.filter(([, , v]) => v).map(([Icon, label, value]) => <div key={label}><dt><Icon size={18} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}</dl>
        </div>
      </article>
      <BookTabs tabs={tabs} />
      {byAuthor.length > 0 && <div className="section"><Carousel title={`More by ${book.authorship}`}>{byAuthor.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>}
      {similar.length > 0 && <div className="section"><Carousel title="Similar books" href={category ? `/category/${category.slug}` : "/search"}>{similar.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>}
    </div>
  </div>;
}
