import Image from "next/image";
import { getBooks, type Book } from "@/lib/db";
import { rupees } from "@/lib/money";
import Reveal from "@/components/Reveal";
import { STORE } from "@/lib/store";
import BookCopy from "@/components/BookCopy";
import Hero from "@/components/Hero";

export const dynamic = "force-dynamic";

const FAQ: [string, string][] = [
  [
    "How are titles delivered?",
    "Immediately. A download link appears as soon as payment clears and the same link is emailed to you. Reopening your order page always issues a fresh one, so access never lapses.",
  ],
  [
    "Do I need an account?",
    "No. Your email at checkout is enough. Each order gets its own page, which stays your permanent access point — bookmark it or keep the email.",
  ],
  [
    "What am I buying?",
    "A digital edition: a PDF you can read on any device, licensed for your personal use. Every copy carries the buyer’s email in the page footer.",
  ],
  [
    "Can I buy more than one title?",
    "Yes, though each is bought separately for now. Every purchase gets its own order page and download link.",
  ],
  [
    "Can I get a refund?",
    "Not once a file has been downloaded. If a file will not open or is not what was described, write to us and we will replace it or refund you in full.",
  ],
  [
    "Do you add new titles?",
    "Yes. The catalogue grows as publishers and authors bring work to the shop. Everything listed is available immediately.",
  ],
];

export default async function Home() {
  const books = await getBooks();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": books.map((b) => ({
      "@type": ["Book", "Product"],
      "@id": `${siteUrl}/#book-${b.slug}`,
      name: b.title,
      headline: b.subtitle || b.title,
      description: b.description,
      bookFormat: "https://schema.org/EBook",
      // Attribution comes from the record, never assumed — these volumes have
      // many contributors and naming one person would misstate authorship.
      ...(b.authorship ? { author: { "@type": "Person", name: b.authorship } } : {}),
      publisher: b.publisher ? { "@type": "Organization", name: b.publisher } : undefined,
      offers: {
        "@type": "Offer",
        price: (b.price_inr / 100).toFixed(2),
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: `${siteUrl}/checkout?book=${encodeURIComponent(b.slug)}`,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Book copy is admin-editable, so escape < to stop a stray </script>
        // in a description from breaking out of this block.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Reveal />

      <Hero books={books} />

      {/* ── catalogue ── */}
      <section id="catalogue" className="wrap scroll-mt-20 pt-20 pb-10">
        <div className="reveal mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="title title-lg mb-3">The catalogue</h2>
            <p className="text-[16px] text-ink-soft">
              Everything currently in stock. Each title is delivered as a
              watermarked PDF.
            </p>
          </div>
          <span className="pill">All prices in INR</span>
        </div>
        <hr className="fade-rule reveal mb-12" />

        {books.length === 0 && (
          <div className="card">
            <p className="eyebrow mb-3">The catalogue is empty</p>
            <p className="m-0 text-ink-soft">
              No titles are listed yet. Add them from the admin console and they
              will appear here.
            </p>
          </div>
        )}

        <div className="grid gap-14">
          {books.map((b, i) => (
            <Entry key={b.slug} book={b} index={i + 1} total={books.length} />
          ))}
        </div>
      </section>

      {/* ── faq ─────────────────────────────────────────────────────── */}
      <section id="faq" className="wrap reveal scroll-mt-24 pb-16">
        <h2 className="title title-lg mb-5">Buying and delivery</h2>
        <hr className="fade-rule mb-10" />
        <dl className="grid gap-x-16 gap-y-9 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="surface surface-hover reveal p-6">
              <dt className="mb-2.5 text-[16px] font-medium">{q}</dt>
              <dd className="m-0 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

/** One catalogue entry: the book, its apparatus, and the buy action. */
function Entry({ book: b, index, total }: { book: Book; index: number; total: number }) {
  const facts: [string, string][] = [
    // Keys starting with "_" are internal bookkeeping, never shown.
    ...Object.entries(b.facts ?? {}).filter(([k]) => !k.startsWith("_")),
    ...(b.pages ? ([["Pages", String(b.pages)]] as [string, string][]) : []),
    ...(b.year ? ([["Year", String(b.year)]] as [string, string][]) : []),
    ...(b.isbn ? ([["ISBN", b.isbn]] as [string, string][]) : []),
  ];

  return (
    <article
      id={`book-${b.slug}`}
      className="surface surface-lit reveal scroll-mt-20 overflow-hidden"
      style={{ ["--i" as string]: index - 1 }}
    >
      {/*
        Desktop: cover top-left, facts beneath it, copy filling the right.
        Mobile: cover, then title and copy, then the facts table LAST — the
        bibliographic detail must never arrive before the title it describes.
      */}
      <div className="grid gap-x-14 gap-y-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="plate cover-lift order-1 mx-auto grid w-full max-w-[240px] place-items-center p-6 lg:mx-0 lg:max-w-none lg:self-start">
          {b.cover ? (
            <Image
              src={b.cover}
              alt={`Cover of ${b.title}`}
              width={540}
              height={680}
              priority={index === 1}
              sizes="(max-width: 1024px) 240px, 280px"
              className="cover-img h-auto w-full"
            />
          ) : (
            <div className="grid aspect-3/4 w-full place-items-center">
              <span className="eyebrow">Cover pending</span>
            </div>
          )}
        </div>

        <div className="order-2 flex min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <p className="eyebrow mb-4">Catalogue no. {String(index).padStart(3, "0")}</p>

          <h2 className="title title-lg mb-3">{b.title}</h2>
          {b.subtitle && <p className="subtitle mb-5 text-[20px]">{b.subtitle}</p>}
          {b.authorship && <p className="eyebrow mb-6">{b.authorship}</p>}

          {b.description && (
            <p className="mb-7 max-w-[58ch] text-[18px] leading-relaxed text-ink">
              {b.description}
            </p>
          )}

          <BookCopy long={b.long_description} highlights={b.highlights ?? []} />

          <div className="mt-auto flex flex-wrap items-center gap-x-7 gap-y-4 pt-8">
            <p className="disp m-0 text-[34px] leading-none">{rupees(b.price_inr)}</p>
            <a
              className="btn btn-primary"
              href={`/checkout?book=${encodeURIComponent(b.slug)}`}
            >
              Buy the digital edition <span aria-hidden>&rarr;</span>
            </a>
            <p className="eyebrow">PDF &middot; Instant download</p>
          </div>
        </div>

        {facts.length > 0 && (
          <div className="order-3 lg:col-start-1 lg:row-start-2">
            <table className="catalogue">
              <caption className="sr-only">
                Bibliographic details for {b.title}
              </caption>
              <tbody>
                {facts.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
