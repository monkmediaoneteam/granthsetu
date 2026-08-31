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
    "How is the book delivered?",
    "Instantly. A download link appears the moment payment clears, and the same link is emailed to you. Reopening your order page always issues a fresh one.",
  ],
  [
    "Do I need an account?",
    "No. Your email at checkout is enough. The order page is your permanent access point — bookmark it or keep the email.",
  ],
  [
    "What am I buying?",
    "A PDF, readable on any device, licensed for your personal use. Each copy is watermarked with the buyer’s email.",
  ],
  [
    "Can I get a refund?",
    "Not once a file has been downloaded. If it will not open, write to us and we will replace it or refund you in full.",
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
      <section id="catalogue" className="wrap pt-24 pb-8">
        <div className="reveal mb-12">
          <h2 className="title title-lg mb-4">The catalogue</h2>
          <div className="rule-grow h-px w-full bg-line" />
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

        <div className="grid gap-14">
          {books.map((b, i) => (
            <Entry key={b.slug} book={b} index={i + 1} total={books.length} />
          ))}
        </div>
      </section>

      {/* ── faq ─────────────────────────────────────────────────────── */}
      <section id="faq" className="wrap reveal scroll-mt-24 pb-16">
        <h2 className="title title-lg mb-4">Before you buy</h2>
        <div className="rule-grow mb-10 h-px w-full bg-line" />
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

/** One catalogue entry: the book, its apparatus, and the buy action. */
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
      className="reveal lift scroll-mt-24 overflow-hidden rounded-3 border border-line bg-bg-2"
      style={{ ["--i" as string]: index - 1 }}
    >
      <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:gap-14">
        <div>
          <div className="volume mx-auto w-full max-w-[240px] lg:mx-0 lg:max-w-none">
            {b.cover ? (
              <Image
                src={b.cover}
                alt={`Cover of ${b.title}`}
                width={540}
                height={680}
                priority={index === 1}
                sizes="(max-width: 1024px) 240px, 270px"
                className="h-auto w-full"
              />
            ) : (
              <div className="grid aspect-3/4 place-items-center rounded-2 border border-line-2 bg-bg-3">
                <span className="eyebrow">Cover pending</span>
              </div>
            )}
          </div>

          {facts.length > 0 && (
            <table className="catalogue mt-8">
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

        <div className="flex min-w-0 flex-col">
          <p className="eyebrow mb-4">
            {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>

          <h2 className="title title-lg mb-3">{b.title}</h2>
          {b.subtitle && <p className="subtitle mb-5 text-[20px]">{b.subtitle}</p>}
          {b.authorship && <p className="eyebrow mb-6">{b.authorship}</p>}

          {b.description && (
            <p className="mb-7 max-w-[58ch] text-[18px] leading-relaxed text-ink">
              {b.description}
            </p>
          )}

          <BookCopy long={b.long_description} highlights={b.highlights ?? []} />

          {/* Price and action pinned to the bottom so both cards line up. */}
          <div className="mt-auto flex flex-wrap items-center gap-x-7 gap-y-4 border-t border-line-2 pt-7">
            <p className="title m-0 text-[34px] leading-none">{rupees(b.price_inr)}</p>
            <a
              className="btn btn-primary"
              href={`/checkout?book=${encodeURIComponent(b.slug)}`}
            >
              Buy the digital edition <span aria-hidden>&rarr;</span>
            </a>
            <p className="eyebrow">PDF &middot; Instant download</p>
          </div>
        </div>
      </div>
    </article>
  );
}
