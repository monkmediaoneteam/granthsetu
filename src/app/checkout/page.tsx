import Link from "next/link";
import { getBooks } from "@/lib/db";
import { publicBook, visibleBook } from "@/components/book-data";
import CheckoutForm from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function Checkout({ searchParams }: { searchParams: Promise<{ book?: string | string[] }> }) {
  const [query, records] = await Promise.all([searchParams, getBooks()]);
  const slug = Array.isArray(query.book) ? query.book[0] : query.book;
  const books = records.filter(visibleBook).map(publicBook);
  if (slug && !books.some((book) => book.slug === slug)) return <div className="wrap section empty-state"><h1 className="title title-lg">That title is not available.</h1><Link className="btn btn-ghost" href="/catalogue">Back to the catalogue</Link></div>;
  return <div className="wrap section"><div className="page-heading"><p className="eyebrow">Bring the books home</p><h1>Checkout</h1></div>
    <CheckoutForm books={books} initialSlug={slug} enabled={process.env.COMMERCE_ENABLED === "true"} />
  </div>;
}
