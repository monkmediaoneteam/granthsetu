import Image from "next/image";
import type { Book } from "@/lib/db";
import { STORE } from "@/lib/store";

/**
 * The hero's job is to say what this shop sells, using the shop's own goods.
 *
 * The dark band is the deep green the imprint already uses; the gold linework
 * is a sprig and a double helix, drawn rather than illustrated, because the
 * catalogue sits exactly on that seam — plant material studied as pharmacology.
 * Everything animates once, on load, as one sequence.
 */
export default function Hero({ books }: { books: Book[] }) {
  const shown = books.slice(0, 2);

  return (
    <section className="relative overflow-hidden bg-forest text-cream">
      {/* depth: a soft pool of lighter green behind the covers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 right-[-10%] h-[720px] w-[720px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-forest-2) 0%, transparent 68%)",
        }}
      />
      <Sprig />

      <div className="wrap relative grid items-center gap-14 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] lg:gap-16 lg:py-28">
        <div className="enter">
          <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-[0.14em] text-gold uppercase">
            <span className="inline-block h-px w-7 bg-gold/70" />
            {STORE.kicker}
          </p>

          <h1 className="disp mt-7 mb-6 text-[clamp(40px,5.4vw,76px)] leading-[0.98] text-cream">
            The research
            <br />
            behind the
            <span className="relative ml-3 inline-block text-gold">
              medicine
              <svg
                aria-hidden
                viewBox="0 0 240 12"
                preserveAspectRatio="none"
                className="absolute -bottom-1.5 left-0 h-2.5 w-full text-gold/60"
              >
                <path
                  d="M2 8C48 3 92 2 138 5c34 2 68 4 100 1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>

          <p className="mb-9 max-w-[50ch] text-[19px] leading-relaxed text-cream/70">
            Reference volumes on Ayurvedic methodology, standardization and
            natural-product pharmacology — written by the people who do the work.
            Bought once, downloaded straight away.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a className="btn btn-gold" href="#catalogue">
              See the catalogue <span aria-hidden>→</span>
            </a>
            <a className="btn btn-ghost btn-outline-cream" href="#faq">
              How delivery works
            </a>
          </div>

          <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-5 border-t border-forest-line pt-7">
            {[
              ["Titles", String(books.length)],
              ["Format", "PDF"],
              ["Delivery", "Instant"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] tracking-[0.14em] text-cream/45 uppercase">
                  {k}
                </dt>
                <dd className="disp m-0 mt-1.5 text-[26px] text-cream">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* The stock itself, angled on a shelf. */}
        <div className="relative flex items-end justify-center gap-6 sm:gap-9 lg:justify-end">
          {shown.map((b, i) =>
            b.cover ? (
              <a
                key={b.slug}
                href={`#book-${b.slug}`}
                className="tilt drift block w-[44%] max-w-[218px] shrink-0"
                style={{
                  marginBottom: i === 0 ? 34 : 0,
                  animationDelay: `${i * 1.6}s`,
                  filter: "drop-shadow(0 28px 46px rgb(0 0 0 / 0.5))",
                }}
              >
                <Image
                  src={b.cover}
                  alt={`Cover of ${b.title}`}
                  width={520}
                  height={660}
                  priority={i === 0}
                  sizes="(max-width: 640px) 44vw, 218px"
                  className="h-auto w-full"
                />
                <span className="sr-only">Jump to {b.title}</span>
              </a>
            ) : null
          )}
        </div>
      </div>
    </section>
  );
}

/** Sprig and helix, drawn in gold — the two halves of the subject. */
function Sprig() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 600"
      fill="none"
      className="sprig pointer-events-none absolute -left-10 top-0 hidden h-full w-[380px] text-gold/45 md:block"
    >
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        {/* stem */}
        <path d="M120 590C120 470 132 380 168 300c30-66 66-118 82-186" style={{ ["--len" as string]: 700 }} />
        {/* leaves */}
        <path d="M150 470c-34-10-52-38-52-70 34 4 58 28 62 62" style={{ ["--len" as string]: 260 }} />
        <path d="M162 396c30-16 44-46 40-80-32 12-52 40-52 74" style={{ ["--len" as string]: 260 }} />
        <path d="M196 318c-32-14-48-44-46-78 32 10 54 38 56 72" style={{ ["--len" as string]: 260 }} />
        <path d="M224 236c30-18 42-50 36-84-32 14-50 44-48 78" style={{ ["--len" as string]: 260 }} />
        {/* double helix rising alongside */}
        <path d="M300 560c40-40 40-80 0-120s-40-80 0-120 40-80 0-120" style={{ ["--len" as string]: 640 }} />
        <path d="M340 560c-40-40-40-80 0-120s40-80 0-120-40-80 0-120" style={{ ["--len" as string]: 640 }} />
        {[520, 460, 400, 340, 280, 220].map((y, i) => (
          <line key={y} x1="304" y1={y} x2="336" y2={y} style={{ ["--len" as string]: 40, animationDelay: `${0.5 + i * 0.12}s` }} />
        ))}
      </g>
    </svg>
  );
}
