import Image from "next/image";
import { getBooks, type Book } from "@/lib/db";
import { rupees } from "@/lib/money";
import Reveal from "@/components/Reveal";
import StickyBuyBar from "@/components/StickyBuyBar";
import BookCopy from "@/components/BookCopy";

export const dynamic = "force-dynamic";

/**
 * Provenance of the catalogue, not a personal CV — this is a press, and the
 * volumes carry many contributors between them.
 */
const PROVENANCE = [
  { v: "52+", k: "Years", l: "Clinical, academic and industrial research behind the list" },
  { v: "100+", k: "Papers & patents", l: "Published by the authors and contributors" },
  { v: "6", k: "Domains", l: "Academia · Industry · Clinic · Research · Science · Practice" },
];

const FAQ: [string, string][] = [
  [
    "How is the book delivered?",
    "Instantly. A download link appears the moment payment clears, and the same link is emailed to you. Reopening your order page always issues a fresh one.",
  ],
  [
    "Do I need an account?",
    "No. Your email at checkout is enough. The order page is your permanent access point — bookmark it or keep the email.",
  ],
  [
    "What am I buying?",
    "A PDF, readable on any device, licensed for your personal use. Each copy is watermarked with the buyer's email.",
  ],
  [
    "Can I get a refund?",
    "Not once a file has been downloaded. If it will not open, write to us and we will replace it or refund you in full.",
  ],
];

export default async function Home() {
  const books = await getBooks();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://books.inventayu.com";

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
      <StickyBuyBar />

      {/* ── hero: the shelf is the thesis ───────────────────────────── */}
      <header className="wrap grid items-center gap-14 pt-20 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-20 lg:pt-28">
        <div>
          <p className="eyebrow mb-8 flex items-center gap-2.5">
            <span className="dot" />
            INVENTAYU Press · Digital editions
          </p>

          <h1 className="title title-xl mb-7 max-w-[15ch] text-balance">
            The literature of{" "}
            <span className="text-brand">Ayurveda research</span>, in full.
          </h1>

          <hr className="gold-rule mb-7" />

          <p className="mb-9 max-w-[52ch] text-[19px] leading-relaxed text-ink-soft">
            Reference volumes on methodology, standardization and the regulation of
            Ayurvedic and natural products — written and edited by the researchers
            who work on them. Delivered as PDFs, the moment you pay.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a className="btn btn-primary" href="#catalogue">
              Browse the catalogue <span aria-hidden>↓</span>
            </a>
            <p className="eyebrow">{books.length} volumes available</p>
          </div>
        </div>

        {/* Books as objects, on a shelf — a bookshop leads with its stock. */}
        <div className="relative">
          <div className="flex items-end justify-center gap-5 sm:gap-7">
            {books.slice(0, 2).map((b, i) => (
              <a
                key={b.slug}
                href={`#book-${b.slug}`}
                className="volume block w-[42%] max-w-[190px] shrink-0"
                style={{ marginBottom: i === 0 ? 22 : 0 }}
                aria-label={`Jump to ${b.title}`}
              >
                <span className="relative block aspect-3/4 w-full bg-white">
                  {b.cover && (
                    <Image
                      src={b.cover}
                      alt={`Cover of ${b.title}`}
                      fill
                      priority={i === 0}
                      sizes="(max-width: 640px) 42vw, 190px"
                      className="object-cover"
                    />
                  )}
                </span>
              </a>
            ))}
          </div>

          {/* The shelf the volumes stand on. */}
          <div className="mx-auto mt-1 h-px w-[86%] bg-line-2" />
          <div className="mx-auto h-4 w-[80%] rounded-b-2 bg-gradient-to-b from-ink/8 to-transparent" />
        </div>
      </header>

      {/* ── catalogue ───────────────────────────────────────────────── */}
      <section id="catalogue" className="wrap pb-8">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6 border-b border-ink pb-5">
          <h2 className="title title-lg m-0">The catalogue</h2>
          <p className="eyebrow">Digital editions · INR · Instant delivery</p>
        </div>

        {books.length === 0 && (
          <div className="card">
            <p className="eyebrow mb-3">Nothing listed yet</p>
            <p className="m-0 text-ink-soft">
              Run <code className="font-mono text-[15px]">npm run seed</code>, then edit
              the entries in the admin console.
            </p>
          </div>
        )}

        <div className="grid gap-20">
          {books.map((b, i) => (
            <Entry key={b.slug} book={b} index={i + 1} total={books.length} />
          ))}
        </div>
      </section>

      {/* ── provenance ──────────────────────────────────────────────── */}
      <section className="wrap reveal pt-24 pb-20">
        <div className="rounded-3 border border-line bg-bg-2 p-8 sm:p-12">
          <p className="eyebrow mb-8">Behind the list</p>
          <dl className="grid gap-10 sm:grid-cols-3">
            {PROVENANCE.map((c) => (
              <div key={c.k}>
                <dd className="title m-0 text-[52px] leading-none text-ink">{c.v}</dd>
                <dt className="eyebrow mt-3 mb-1.5">{c.k}</dt>
                <dd className="m-0 text-[14px] leading-relaxed text-ink-soft">{c.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── faq ─────────────────────────────────────────────────────── */}
      <section className="wrap reveal pb-16">
        <h2 className="title title-lg mb-10">Before you buy</h2>
        <dl className="grid gap-x-16 gap-y-9 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="border-t border-line pt-5">
              <dt className="mb-2.5 text-[17px] font-medium">{q}</dt>
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

/** One catalogue entry: object, apparatus, copy, price. */
function Entry({ book: b, index, total }: { book: Book; index: number; total: number }) {
  const facts: [string, string][] = [
    ...Object.entries(b.facts ?? {}),
    ...(b.pages ? ([["Pages", String(b.pages)]] as [string, string][]) : []),
    ...(b.year ? ([["Year", String(b.year)]] as [string, string][]) : []),
    ...(b.isbn ? ([["ISBN", b.isbn]] as [string, string][]) : []),
  ];

  return (
    <article
      id={`book-${b.slug}`}
      className="reveal grid scroll-mt-24 gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-16"
    >
      {/* Object + apparatus travel together, like a card behind the book. */}
      <div>
        <div className="volume mx-auto w-full max-w-[240px] lg:mx-0">
          <div className="relative aspect-3/4 w-full bg-white">
            {b.cover ? (
              <Image
                src={b.cover}
                alt={`Cover of ${b.title}`}
                fill
                sizes="(max-width: 1024px) 240px, 300px"
                className="object-cover"
              />
            ) : (
              <span className="eyebrow absolute inset-0 grid place-items-center">
                Cover pending
              </span>
            )}
          </div>
        </div>

        {facts.length > 0 && (
          <table className="catalogue mt-9">
            <caption className="sr-only">Bibliographic details for {b.title}</caption>
            <tbody>
              {facts.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="min-w-0">
        <p className="eyebrow mb-5">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>

        <h3 className="title title-lg mb-3">{b.title}</h3>
        {b.subtitle && <p className="subtitle mb-6 text-[21px]">{b.subtitle}</p>}

        {b.authorship && (
          <p className="eyebrow mb-7 text-ink-soft">{b.authorship}</p>
        )}

        {b.description && (
          <p className="mb-8 max-w-[58ch] text-[19px] leading-relaxed text-ink">
            {b.description}
          </p>
        )}

        <BookCopy long={b.long_description} highlights={b.highlights ?? []} />

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-7">
          <p className="title m-0 text-[38px] leading-none">{rupees(b.price_inr)}</p>
          <a
            className="btn btn-primary"
            href={`/checkout?book=${encodeURIComponent(b.slug)}`}
          >
            Buy the digital edition <span aria-hidden>→</span>
          </a>
          <p className="eyebrow">Instant download · No account</p>
        </div>
      </div>
    </article>
  );
}
