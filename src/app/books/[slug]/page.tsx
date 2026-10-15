import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getBook } from "@/lib/db";
import { safeUrl } from "@/lib/content";
import { rupees } from "@/lib/money";
import { siteUrl } from "@/lib/store";
import { publicBook, visibleBook } from "@/components/book-data";
import AddToCart from "@/components/AddToCart";
import BookCopy from "@/components/BookCopy";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const book = await getBook((await params).slug);
  if (!book || !visibleBook(book)) return { title: "Book not found", robots: { index: false } };
  return { title: book.title, description: book.description || undefined,
    alternates: { canonical: `${siteUrl()}/books/${encodeURIComponent(book.slug)}` },
    openGraph: { title: book.title, description: book.description || undefined, images: book.cover ? [book.cover] : [] } };
}

export default async function BookDetail({ params }: { params: Promise<{ slug: string }> }) {
  const book = await getBook((await params).slug);
  if (!book || !visibleBook(book)) notFound();
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const view = publicBook(book);
  let sample: string | null = null;
  try { sample = safeUrl(book.sample_url); } catch { /* A malformed sample is not a download link. */ }
  const facts = new Map<string, string>(Object.entries(book.facts || {}).filter(([key]) => !key.startsWith("_")));
  for (const [label, value] of [["Format", book.file_format], ["Edition", book.edition], ["Language", book.language], ["Subject", book.subject], ["Pages", book.pages], ["Published", book.year], ["ISBN", book.isbn], ["Publisher", book.publisher], ["File size", book.file_size]] as const) {
    if (value) facts.set(label, String(value));
  }
  return <div className="wrap section">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Reading room</Link><span aria-hidden="true">/</span><Link href="/catalogue">Catalogue</Link><span aria-hidden="true">/</span><span>{book.title}</span></nav>
    <article>
      <div className="book-detail">
        <div className="detail-art">{book.cover ? <Image src={book.cover} unoptimized={book.cover.startsWith("https://")} alt={`Cover of ${book.title}`} width={1120} height={1400} preload sizes="(max-width: 640px) 90vw, 45vw" /> : <p>Cover image unavailable</p>}</div>
        <div className="detail-copy">
          <p className="eyebrow">{book.subject || "Digital edition"}</p><h1>{book.title}</h1>
          {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
          {book.authorship && <p className="small">{book.author_slug ? <Link className="underline" href={`/catalogue?q=${encodeURIComponent(book.authorship)}&author=${encodeURIComponent(book.author_slug)}`}>{book.authorship}</Link> : book.authorship}</p>}
          {book.description && <p className="muted preserve-lines">{book.description}</p>}
          <div className="detail-buy"><span className={view.saleable && book.price_inr > 0 ? "price" : "small muted"}>{view.saleable && book.price_inr > 0 ? rupees(book.price_inr) : "Forthcoming digital edition"}</span>
            <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} saveable={view.saveable} />
            {!enabled && <p className="purchase-paused">Online ordering is currently unavailable. You can save this title in your cart for later.</p>}
            {enabled && !view.saleable && <p className="small muted">This edition is not currently available to buy.</p>}
            {book.file_format && <p className="small muted">{book.file_format} digital edition · Personal-use licence</p>}
            {sample && <a className="text-link" href={sample} target="_blank" rel="noopener noreferrer">Read a sample <ArrowUpRight size={17} aria-hidden="true" /></a>}
          </div>
          {facts.size > 0 && <table className="catalogue"><caption className="sr-only">Bibliographic details</caption><tbody>{[...facts].map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>}
        </div>
      </div>
      {(book.long_description || book.highlights?.length > 0) && <section className="book-description"><h2>Inside the book</h2><BookCopy long={book.long_description} highlights={book.highlights || []} /></section>}
    </article>
  </div>;
}
