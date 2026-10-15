import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, FileCheck2, Library, ShieldCheck, Zap } from "lucide-react";
import { getBook, getBooks } from "@/lib/db";
import { bookJsonLd, jsonLdHtml } from "@/lib/catalogue";
import { getPublicContent, safeUrl } from "@/lib/content";
import { rupees } from "@/lib/money";
import { siteUrl } from "@/lib/store";
import { publicBook, visibleBook } from "@/components/book-data";
import AddToCart from "@/components/AddToCart";
import BookCopy from "@/components/BookCopy";
import { Shelf } from "@/components/BookCard";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const book = await getBook((await params).slug);
  if (!book || !visibleBook(book)) return { title: "Book not found", robots: { index: false } };
  return { title: book.title, description: book.description || undefined,
    alternates: { canonical: `${siteUrl()}/books/${encodeURIComponent(book.slug)}` },
    openGraph: { title: book.title, description: book.description || undefined, images: book.cover ? [book.cover] : [] } };
}

export default async function BookDetail({ params }: { params: Promise<{ slug: string }> }) {
  const [book, records, content] = await Promise.all([getBook((await params).slug), getBooks(), getPublicContent()]);
  if (!book || !visibleBook(book)) notFound();
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const view = publicBook(book);
  const priced = view.saleable && book.price_inr > 0;
  const url = `${siteUrl()}/books/${encodeURIComponent(book.slug)}`;
  const author = book.author_slug ? content.authors.find((item) => item.id === book.author_slug) : undefined;
  let authorPhoto: string | null = null;
  try { authorPhoto = safeUrl(author?.photo_url); } catch { /* An unusable photo is omitted. */ }
  const others = records.filter((item) => item.slug !== book.slug && visibleBook(item)).map((book) => publicBook(book));
  const related = [...others.filter((item) => view.subject && item.subject === view.subject), ...others.filter((item) => !view.subject || item.subject !== view.subject)].slice(0, 8);
  let sample: string | null = null;
  try { sample = safeUrl(book.sample_url); } catch { /* A malformed sample is not a download link. */ }
  const facts = new Map<string, string>(Object.entries(book.facts || {}).filter(([key]) => !key.startsWith("_")));
  for (const [label, value] of [["Format", book.file_format], ["Edition", book.edition], ["Language", book.language], ["Subject", book.subject], ["Pages", book.pages], ["Published", book.year], ["ISBN", book.isbn], ["Publisher", book.publisher], ["File size", book.file_size]] as const) {
    if (value) facts.set(label, String(value));
  }
  return <div className="wrap section">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(bookJsonLd(book, url, view.saleable)) }} />
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Reading room</Link><span aria-hidden="true">/</span><Link href="/catalogue">Catalogue</Link>
      {view.subject && <><span aria-hidden="true">/</span><Link href={`/catalogue?subject=${encodeURIComponent(view.subject)}`}>{view.subject}</Link></>}
      <span aria-hidden="true">/</span><span aria-current="page">{book.title}</span></nav>
    <article className="book-detail">
      <div className="detail-art">{book.cover ? <Image src={book.cover} unoptimized={book.cover.startsWith("https://")} alt={`Cover of ${book.title}`} width={1120} height={1400} preload sizes="(max-width: 640px) 90vw, 30vw" /> : <p>Cover image unavailable</p>}</div>
      <div className="detail-copy">
        <p className="eyebrow">{view.subject || "Digital edition"}</p><h1>{book.title}</h1>
        {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
        {book.authorship && <p className="detail-author">by {book.author_slug ? <Link className="underline" href={`/authors/${encodeURIComponent(book.author_slug)}`}>{book.authorship}</Link> : book.authorship}</p>}
        {book.description && <p className="detail-lede preserve-lines">{book.description}</p>}
        {(book.long_description || book.highlights?.length > 0) && <section className="book-description" aria-labelledby="inside-title"><h2 id="inside-title">Inside the book</h2><BookCopy long={book.long_description} highlights={book.highlights || []} /></section>}
        {facts.size > 0 && <section className="book-description" aria-labelledby="details-title"><h2 id="details-title">Edition details</h2>
          <table className="catalogue"><caption className="sr-only">Bibliographic details</caption><tbody>{[...facts].map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table></section>}
        {author && <section className="author-card" aria-label="About the author">
          {authorPhoto && <img src={authorPhoto} alt="" className="author-card-photo" loading="lazy" />}
          <div><p className="eyebrow">About the author</p><h2>{author.name}</h2>{author.bio && <p className="author-card-bio">{author.bio}</p>}
            <Link className="text-link" href={`/authors/${encodeURIComponent(author.id)}`}>Author profile <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </section>}
      </div>
      <aside className="buy-panel" aria-label="Purchase">
        {priced ? <p className="price">{rupees(book.price_inr)}</p> : <p className="status-pill">Forthcoming digital edition</p>}
        {book.file_format && <p className="small muted">{book.file_format} · Personal-use licence</p>}
        <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} saveable={view.saveable} />
        {!enabled && <p className="purchase-paused">Online ordering is currently unavailable. You can save this title in your cart for later.</p>}
        {enabled && !view.saleable && <p className="small muted">This edition is not currently available to buy.</p>}
        {sample && <a className="text-link" href={sample} target="_blank" rel="noopener noreferrer">Read a sample <ArrowUpRight size={17} aria-hidden="true" /></a>}
        <ul className="trust-list">
          <li><Zap size={18} aria-hidden="true" /><span><strong>Digital delivery</strong>Nothing is shipped; download once payment is confirmed.</span></li>
          <li><ShieldCheck size={18} aria-hidden="true" /><span><strong>Hosted secure payment</strong>Card, UPI and netbanking through Razorpay.</span></li>
          <li><FileCheck2 size={18} aria-hidden="true" /><span><strong>Your licensed copy</strong>Each file carries a personal licence mark.</span></li>
          <li><Library size={18} aria-hidden="true" /><span><strong>In your library</strong>Purchases stay listed under your verified email.</span></li>
        </ul>
        <p className="small"><Link className="underline" href="/delivery-policy">Delivery</Link> · <Link className="underline" href="/refund-policy">Refunds</Link></p>
      </aside>
    </article>
    {related.length > 0 && <section className="related-books" aria-labelledby="related-title">
      <div className="section-heading"><div><p className="eyebrow">Keep reading</p><h2 id="related-title">{view.subject && related[0]?.subject === view.subject ? `More in ${view.subject}` : "More on the shelf"}</h2></div>
        <Link href="/catalogue" className="text-link">All books <ArrowRight size={18} aria-hidden="true" /></Link></div>
      <Shelf books={related} enabled={enabled} label="Related books" />
    </section>}
  </div>;
}
