import { getBook } from "@/lib/db";
import { rupees } from "@/lib/money";
import CheckoutForm from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout", robots: { index: false } };

export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const { book: slug } = await searchParams;
  const book = slug ? await getBook(slug) : null;

  if (!book || !book.active) {
    return (
      <main className="wrap" style={{ padding: "96px 0" }}>
        <h1 className="disp h3" style={{ marginTop: 0 }}>That book is not available.</h1>
        <a className="btn btn-ghost" href="/">← Back to the books</a>
      </main>
    );
  }

  return (
    <main className="wrap" style={{ padding: "72px 0", maxWidth: 880 }}>
      <div className="eyebrow" style={{ marginBottom: 20 }}>Checkout</div>
      <h1 className="disp h3" style={{ margin: "0 0 40px" }}>{book.title}</h1>

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 500 }}>{book.title}</div>
            <div className="eyebrow" style={{ marginTop: 6 }}>
              {book.file_format || "PDF"} · Instant download
            </div>
          </div>
          <div className="disp" style={{ fontSize: 28 }}>{rupees(book.price_inr)}</div>
        </div>
      </div>

      <CheckoutForm slug={book.slug} amountLabel={rupees(book.price_inr)} title={book.title} />

      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 28, maxWidth: "62ch" }}>
        Digital copies cannot be returned once downloaded. If the file fails to open,
        write to us and we will replace it or refund you. By paying you agree to our{" "}
        <a href="/terms" style={{ textDecoration: "underline" }}>terms</a> and{" "}
        <a href="/refund-policy" style={{ textDecoration: "underline" }}>refund policy</a>.
      </p>
    </main>
  );
}
