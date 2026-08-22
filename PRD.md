# PRD — INVENTAYU Books (digital)

Standalone storefront selling Dr. Narendra Bhatt's books as digital copies.
Separate app, separate deploy, separate DB from the main static site.

## 1. Decisions (locked)

| | |
|---|---|
| Product | **Digital only.** PDF (+EPUB if available). Prepaid, INR. |
| Delivery | Instant. Signed expiring URL, emailed + on the order page. |
| Stack | **Next.js App Router (TS)** in `books/`, own Vercel project. |
| Domain | `books.inventayu.com` |
| DB | **Vercel Postgres (Neon)** — new instance, not the blog DB. |
| Files | **Vercel Blob, private access.** Never a public URL. |
| Payments | **Razorpay Standard Checkout** + signature-verified webhook. |
| Auth | **Guest checkout.** No login. Order link re-mints download links. |
| Email | **Resend** — order confirmation + download link only. |

Design: reuse the main site's tokens verbatim (emerald/gold on warm off-white,
Geist + Geist Mono, mono uppercase eyebrows, oversized tight display headings,
hairline rules, scroll-reveal). Copy stays institutional and evidence-first —
"Read the contents →" over "Buy now". The book is presented as scholarship, the
purchase is the quiet secondary action.

## 2. Scope — today

### Pages
- `/` — landing. Hero, both books, author credibility block (52+ yrs, 100+
  papers/chapters/patents, IASTAM), contents/chapter preview, sample pages, FAQ,
  footer. Sticky buy bar on mobile.
- `/checkout` — email + phone only. Creates order → Razorpay.
- `/order/[id]` — receipt + download buttons. Unguessable id. Re-mints links on
  demand, so a lost email is never a lost book.
- `/admin` — token-gated. Orders table, revenue/units, download counts.
- `/privacy`, `/terms`, `/refund-policy`, `/delivery-policy` — **required by
  Razorpay for activation.**

### Order lifecycle
`created → paid → fulfilled` plus `payment_failed`, `refunded`.
That's the whole machine. Razorpay webhook (`payment.captured`) is the sole
source of truth for `paid` — never the browser redirect. Idempotent on
`payment_id`.

### Download security
- Signed URL, **15 min TTL**, minted per click.
- **Cap of 10 downloads per order line**, then the order page says contact us.
- Every mint logged to `events` (ip, ua, ts) so abuse is visible in `/admin`.
- PDF stamped with buyer email + order id on the footer of each page.
  *Deterrent, not DRM — see §5.*

### Emails (Resend)
1. Order confirmed + download links.
2. Refund issued (manual trigger from admin).

### Data model
`books` (slug, title, subtitle, description, cover, price_inr, blob_key,
file_format, file_size, isbn, publisher, pages, year, active)
`orders` (id, email, phone, items jsonb, subtotal, tax, total, status,
razorpay_order_id, razorpay_payment_id, created_at, paid_at)
`downloads` (order_id, book_slug, count, last_at)
`events` (order_id, type, payload jsonb, created_at) — audit trail.

### SEO / analytics
Per-page metadata + canonical, OG images, JSON-LD `Book` + `Product` + `Offer`
+ `Person` (author), sitemap, robots, `llms.txt` matching the main site's style.
GA4 + server-side revenue/units in `/admin`.

## 3. Explicitly NOT today

Cart (buy-one-now; two books), per-book detail pages (inline on landing),
OTP login / `/orders` history, coupons, reviews, wishlist, multi-currency,
abandoned-cart email, affiliate links, print edition.

## 4. Inputs needed from you

1. **The actual PDF/EPUB files.** Hard blocker — nothing ships without these.
2. Price per book (INR).
3. Cover images (high-res), ISBN, publisher, page count, year.
4. Sample pages / table of contents for the preview section.
5. Razorpay: KYC submitted? Test keys?
6. Refund stance for digital — recommend "no refund once downloaded", stated
   plainly on the checkout page.
7. Resend sending domain — `books.inventayu.com` or `inventayu.com`?
8. **GST rate on e-books — confirm with your CA.** Printed books are exempt but
   digital editions are not treated the same way, and I'm not certain of the
   current rate. This changes the displayed price, so it needs a real answer
   before launch, not after.

## 5. Known gaps, deliberate

- **Stamping is a deterrent, not DRM.** A determined buyer can share the PDF.
  Real DRM costs more than it recovers at this volume. The stamp plus the
  download cap makes casual sharing traceable, which is the 95% case.
- **No refund automation.** Refunds are issued by hand in the Razorpay
  dashboard, then marked in admin. Correct until it happens weekly.
- **No cart.** Buying both books is two transactions. Fix when a third book
  exists.
