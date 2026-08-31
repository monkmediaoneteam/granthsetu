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
      <div className="wrap py-24">
        <h1 className="title title-lg mb-6">That book is not available.</h1>
        <a className="btn btn-ghost" href="/">
          <span aria-hidden>&larr;</span> Back to the books
        </a>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[880px] py-18">
      <p className="eyebrow mb-5">Checkout</p>
      <h1 className="title title-lg mb-3">{book.title}</h1>
      <hr className="gold-rule mb-10" />

      <div className="card mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 font-medium">{book.title}</p>
          <p className="eyebrow mt-1.5">
            {book.file_format || "PDF"} &middot; Instant download
          </p>
        </div>
        <p className="disp m-0 text-[28px]">{rupees(book.price_inr)}</p>
      </div>

      <CheckoutForm
        slug={book.slug}
        amountLabel={rupees(book.price_inr)}
        title={book.title}
      />

      <p className="mt-7 max-w-[62ch] text-[13px] text-ink-soft">
        Digital copies cannot be returned once downloaded. If the file fails to open,
        write to us and we will replace it or refund you. By paying you agree to our{" "}
        <a href="/terms" className="underline">terms</a> and{" "}
        <a href="/refund-policy" className="underline">refund policy</a>.
      </p>
    </div>
  );
}
