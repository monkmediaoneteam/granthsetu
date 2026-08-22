import { getBooks } from "@/lib/db";
import { rupees } from "@/lib/money";
import Reveal from "@/components/Reveal";

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

  return (
    <>
      <Reveal />

      {/* hero */}
      <header className="wrap" style={{ paddingTop: 96, paddingBottom: 72 }}>
        <div className="eyebrow" style={{ marginBottom: 28 }}>
          <span className="dot" style={{ marginRight: 10 }} />
          Written by Dr. Narendra Bhatt
        </div>
        <h1 className="disp h1" style={{ margin: "0 0 32px", maxWidth: "14ch" }}>
          Five decades,
          <br />
          <span style={{ color: "var(--emerald)" }}>written down.</span>
        </h1>
        <p
          style={{
            maxWidth: "58ch",
            color: "var(--ink-soft)",
            fontSize: 20,
            margin: "0 0 40px",
          }}
        >
          Books on Ayurveda research methodology, integrative perspectives and the
          translation of classical knowledge into validated science — drawn from a
          career across academia, industry, clinic and research.
        </p>
        <a className="btn btn-ghost" href="#books">
          Read the contents →
        </a>
      </header>

      {/* credibility */}
      <section className="wrap reveal" style={{ paddingBottom: 88 }}>
        <div className="rule" style={{ marginBottom: 32 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 32,
          }}
        >
          {CREDENTIALS.map((c) => (
            <div key={c.k}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                {c.k}
              </div>
              <div className="disp" style={{ fontSize: 56, marginBottom: 8 }}>
                {c.v}
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{c.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* books */}
      <section id="books" className="wrap" style={{ paddingBottom: 96 }}>
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          The Books
        </div>
        <h2 className="disp h2" style={{ margin: "0 0 56px", maxWidth: "18ch" }}>
          Available as digital editions.
        </h2>

        <div style={{ display: "grid", gap: 32 }}>
          {books.length === 0 && (
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                No books yet
              </div>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                Run <code>npm run seed</code> to load placeholder titles, then
                replace them with the real files, prices and covers.
              </p>
            </div>
          )}

          {books.map((b) => (
            <article key={b.slug} className="card reveal book-row">
              <div className="cover">
                {b.cover ? (
                  <img
                    src={b.cover}
                    alt={"Cover of " + b.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="eyebrow">Cover pending</span>
                )}
              </div>

              <div>
                <h3 className="disp h3" style={{ margin: "0 0 12px" }}>
                  {b.title}
                </h3>
                {b.subtitle && (
                  <p
                    style={{
                      margin: "0 0 20px",
                      color: "var(--ink-soft)",
                      fontSize: 17,
                    }}
                  >
                    {b.subtitle}
                  </p>
                )}
                {b.description && (
                  <p
                    style={{
                      margin: "0 0 24px",
                      color: "var(--ink-soft)",
                      maxWidth: "62ch",
                    }}
                  >
                    {b.description}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    flexWrap: "wrap",
                    marginBottom: 28,
                  }}
                >
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
                        <div className="eyebrow" style={{ marginBottom: 4 }}>
                          {k}
                        </div>
                        <div style={{ fontSize: 15 }}>{v}</div>
                      </div>
                    ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    flexWrap: "wrap",
                  }}
                >
                  <div className="disp" style={{ fontSize: 34 }}>
                    {rupees(b.price_inr)}
                  </div>
                  <a
                    className="btn btn-primary"
                    href={"/checkout?book=" + encodeURIComponent(b.slug)}
                  >
                    Buy the digital edition <span aria-hidden>→</span>
                  </a>
                </div>
                <p className="eyebrow" style={{ marginTop: 16 }}>
                  Instant download · No account needed
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* faq */}
      <section className="wrap reveal" style={{ paddingBottom: 40 }}>
        <div className="rule" style={{ marginBottom: 48 }} />
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          Questions
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 40,
          }}
        >
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <h4 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600 }}>
                {q}
              </h4>
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 15 }}>
                {a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
