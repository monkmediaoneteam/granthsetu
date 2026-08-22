import Image from "next/image";
import { getBooks } from "@/lib/db";
import { rupees } from "@/lib/money";
import Reveal from "@/components/Reveal";
import ChapterPreview from "@/components/ChapterPreview";
import StickyBuyBar from "@/components/StickyBuyBar";

export const dynamic = "force-dynamic";

const CREDENTIALS = [
  { k: "Years of experience", v: "52+", l: "In clinical and industrial research" },
  { k: "Papers, chapters & patents", v: "100+", l: "Publications" },
  { k: "Domains", v: "4", l: "Academia · Industry · Clinic · Research" },
];

const FAQ: [string, string][] = [
  [
    "How is the book delivered?",
    "Immediately after payment. A download link appears on screen and is emailed to you. The link in the email keeps working — it regenerates each time you open it.",
  ],
  [
    "Do I need an account?",
    "No. Enter your email at checkout and the book is yours. The order page is your permanent access point.",
  ],
  [
    "What format?",
    "PDF, readable on any device. Each copy carries your email on the page footer.",
  ],
  [
    "Can I get a refund?",
    "Digital copies cannot be returned once downloaded. If the file fails to open, write to us and we will fix it or refund you.",
  ],
];

export default async function Home() {
  const books = await getBooks();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://books.inventayu.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${siteUrl}/#author`,
        name: "Dr. Narendra Bhatt",
        jobTitle: "Ayurvedic Physician & Research Scientist",
        description:
          "Over 52 years of experience spanning clinical practice, academic leadership, and industrial translation in Ayurveda. Former President of IASTAM India.",
        affiliation: {
          "@type": "Organization",
          name: "INVENTAYU Pvt. Ltd.",
          url: "https://www.inventayu.com",
        },
      },
      ...books.map((b) => ({
        "@type": ["Book", "Product"],
        "@id": `${siteUrl}/#book-${b.slug}`,
        name: b.title,
        headline: b.subtitle || b.title,
        description: b.description,
        bookFormat: "https://schema.org/EBook",
        author: { "@id": `${siteUrl}/#author` },
        publisher: b.publisher ? { "@type": "Organization", name: b.publisher } : undefined,
        offers: {
          "@type": "Offer",
          price: (b.price_inr / 100).toFixed(2),
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          url: `${siteUrl}/checkout?book=${encodeURIComponent(b.slug)}`,
        },
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Reveal />
      <StickyBuyBar />

      <header className="wrap pt-24 pb-18">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <p className="eyebrow flex items-center gap-2.5">
            <span className="dot" />
            Written by Dr. Narendra Bhatt
          </p>
          <span className="eyebrow text-gold font-serif tracking-widest">
            ॥ आयुर्वेदोऽमृतानाम् ॥
          </span>
        </div>

        <h1 className="disp h1 mb-8 max-w-[14ch]">
          Five decades,
          <br />
          <span className="text-brand">written down.</span>
        </h1>
        <p className="mb-10 max-w-[58ch] text-xl text-ink-soft">
          Books on Ayurveda research methodology, integrative perspectives and the
          translation of classical knowledge into validated science — drawn from a
          career across academia, industry, clinic and research.
        </p>
        <a className="btn btn-ghost" href="#books">
          Read the contents <span aria-hidden>→</span>
        </a>
      </header>

      <section className="wrap reveal pb-22">
        <hr className="mb-8 border-line" />
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {CREDENTIALS.map((c) => (
            <div key={c.k}>
              <dt className="eyebrow mb-3">{c.k}</dt>
              <dd className="m-0">
                <span className="disp mb-2 block text-[56px]">{c.v}</span>
                <span className="text-sm text-ink-soft">{c.l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="books" className="wrap pb-24">
        <p className="eyebrow mb-5">The Books</p>
        <h2 className="disp h2 mb-14 max-w-[18ch]">Available as digital editions.</h2>

        <div className="grid gap-8">
          {books.length === 0 && (
            <div className="card">
              <p className="eyebrow mb-3">No books yet</p>
              <p className="m-0 text-ink-soft">
                Run <code className="font-mono text-[15px]">npm run seed</code> to load
                placeholder titles, then replace them with the real files, prices and
                covers.
              </p>
            </div>
          )}

          {books.map((b) => (
            <article
              key={b.slug}
              className="card reveal grid items-start gap-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-10"
            >
              <div className="relative grid aspect-3/4 w-full max-w-[180px] place-items-center overflow-hidden rounded-2 border border-line-2 bg-bg-3 md:max-w-none">
                {b.cover ? (
                  <Image
                    src={b.cover}
                    alt={`Cover of ${b.title}`}
                    fill
                    sizes="(max-width: 768px) 180px, 220px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center p-4 text-center">
                    <span className="eyebrow text-[10px] text-ink-mute mb-2">Digital Edition</span>
                    <span className="font-serif text-sm font-medium leading-tight text-ink">
                      {b.title}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="disp h3 mb-3">{b.title}</h3>
                {b.subtitle && (
                  <p className="mb-5 text-[17px] text-ink-soft">{b.subtitle}</p>
                )}
                {b.description && (
                  <p className="mb-6 max-w-[62ch] text-ink-soft">{b.description}</p>
                )}

                <dl className="mb-7 flex flex-wrap gap-5">
                  {(
                    [
                      ["Publisher", b.publisher],
                      ["Pages", b.pages ? String(b.pages) : null],
                      ["Year", b.year ? String(b.year) : null],
                      ["Format", b.file_format],
                    ] as [string, string | null][]
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="eyebrow mb-1">{k}</dt>
                        <dd className="m-0 text-[15px]">{v}</dd>
                      </div>
                    ))}
                </dl>

                <div className="flex flex-wrap items-center gap-6">
                  <p className="disp m-0 text-[34px]">{rupees(b.price_inr)}</p>
                  <a
                    className="btn btn-primary"
                    href={`/checkout?book=${encodeURIComponent(b.slug)}`}
                  >
                    Buy the digital edition <span aria-hidden>→</span>
                  </a>
                </div>
                <p className="eyebrow mt-4">Instant download · No account needed</p>

                <ChapterPreview slug={b.slug} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap reveal pb-10">
        <hr className="mb-12 border-line" />
        <p className="eyebrow mb-5">Questions</p>
        <div className="grid gap-10 sm:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <h3 className="mb-2 text-[17px] font-semibold">{q}</h3>
              <p className="m-0 text-[15px] text-ink-soft">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
