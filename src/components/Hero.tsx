import Image from "next/image";
import type { Book } from "@/lib/db";
import { rupees } from "@/lib/money";
import { STORE } from "@/lib/store";

/**
 * Commerce hero: the claim on the left, the products as real cards on the
 * right. Every card, shadow and transition uses the shared surface system, so
 * the page reads as one designed thing rather than a pile of effects.
 */
export default function Hero({ books }: { books: Book[] }) {
  const shown = books.slice(0, 2);

  return (
    <section className="field overflow-hidden border-b border-line">
      <div className="wrap grid items-center gap-16 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-20 lg:py-24">
        <div className="enter">
          <span className="pill">
            <span className="dot" />
            {STORE.kicker}
          </span>

          <h1 className="disp mt-7 mb-6 text-[clamp(38px,4.8vw,62px)] leading-[1.02]">
            The research behind
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-br from-brand via-brand-deep to-gold bg-clip-text text-transparent">
              the medicine
            </span>
            .
          </h1>

          <p className="mb-9 max-w-[50ch] text-[19px] leading-relaxed text-ink-soft">
            Reference volumes on Ayurvedic methodology, standardization and
            natural-product pharmacology — written by the people who do the work.
            Pay once, download straight away.
          </p>

          <div className="mb-11 flex flex-wrap items-center gap-3.5">
            <a className="btn btn-primary" href="#catalogue">
              Browse {books.length} titles <span aria-hidden>→</span>
            </a>
            <a className="btn btn-ghost" href="#faq">
              How delivery works
            </a>
          </div>

          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              ["Instant", "download after payment"],
              ["Secure", "payments via Razorpay"],
              ["Watermarked", "licensed to you"],
            ].map(([strong, rest]) => (
              <li key={strong} className="flex items-center gap-2.5 text-[14px] text-ink-soft">
                <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-brand">
                  <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
                  <path d="M4.7 8.2l2.2 2.2 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong className="font-medium text-ink">{strong}</strong> {rest}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* The products, as the cards the buyer will actually click. */}
        <div className="grid gap-5 sm:grid-cols-2">
          {shown.map((b, i) => (
            <a
              key={b.slug}
              href={`#book-${b.slug}`}
              className="surface surface-hover surface-lit group flex flex-col p-5"
              style={{
                animation: `rise 0.8s var(--ease-out) ${0.18 + i * 0.1}s backwards`,
              }}
            >
              <div className="plate mb-5 grid place-items-center p-5">
                {b.cover ? (
                  <Image
                    src={b.cover}
                    alt={`Cover of ${b.title}`}
                    width={420}
                    height={540}
                    priority={i === 0}
                    sizes="(max-width: 640px) 70vw, 200px"
                    className="cover-img h-auto w-full"
                  />
                ) : (
                  <span className="eyebrow py-16">Cover pending</span>
                )}
              </div>

              <p className="mb-1.5 text-[15px] leading-snug font-medium text-ink">
                {b.title}
              </p>
              <p className="eyebrow mb-4 line-clamp-1">{b.authorship ?? "Digital edition"}</p>

              <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-line pt-4">
                <span className="disp text-[22px]">{rupees(b.price_inr)}</span>
                <span className="eyebrow text-brand transition-colors group-hover:text-brand-deep">
                  View <span aria-hidden>→</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
