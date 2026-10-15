import { getBooks } from "@/lib/db";
import { publicBook, visibleBook } from "@/components/book-data";
import CartContents from "./CartContents";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  const books = (await getBooks()).filter(visibleBook).map(publicBook);
  return <div className="wrap section"><div className="page-heading"><p className="eyebrow">Your next reads</p><h1>Your cart</h1></div>
    <CartContents books={books} enabled={process.env.COMMERCE_ENABLED === "true"} />
  </div>;
}
