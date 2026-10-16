# Admin Offers Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Admin-managed offers: percent off, flat off, buy X get Y, bundle price, any of them behind a coupon code.
- Targets: books, a collection, a subject, or the whole store.
- Checkout prices them on the server and records them on the order.

**Architecture:**
- One pure function, `priceCart` in `src/lib/offers.ts`, is the only pricing path. Checkout, `/api/cart/summary` and offer badges all call it.
- `src/lib/offer-data.ts` loads live offers and builds each line's eligibility (subject family, collections).
- Checkout stores per-line paid prices plus the order discount. Fulfilment records redemptions.
- The admin `/admin/offers` screen manages offers. It turns the feature on in production by applying `migrations/008-offers.sql` with one click.

**Tech Stack:** Next.js 16 App Router, Neon Postgres (`sql` tagged template), PGlite for offline tests, TypeScript, existing CSS layers.

**Spec:** `docs/superpowers/specs/2026-10-16-admin-offers-engine-design.md`. It includes the five approved calls.

## Global Constraints

- Money is integer paise everywhere. No floats in stored values. Percent maths uses `Math.floor`.
- The order total is never below ₹1 (100 paise). The discount shrinks to keep it there.
- Stacking: the best automatic offers, each book used by at most one automatic offer, picked largest saving first. Then at most one coupon:
  - a combinable coupon applies after automatic offers, on the discounted prices;
  - a non-combinable coupon replaces automatic offers only if its saving is larger.
- The client sends `expectedTotal`. If it differs from the server's total, checkout returns 409 `{ error: "Prices changed.", pricing }` and creates no payment link.
- The coupon code is part of the checkout idempotency hash.
- Limits count redemptions of paid orders only. A redemption is recorded at fulfilment even past the limit.
- Each discount is split across its lines in whole paise, with the remainder on the most expensive line. `items[].price` is what was paid for that line, `items[].discount` its share, `items[].list_price` the regular price.
- Storefront copy stays short: badges such as "20% off", "Buy 2 get 1", "Any 3 for ₹499", "Code SAVE10".
- Demo titles may carry offers; checkout still refuses them.
- All admin routes use `checkOrigin` and `isAdmin`, and audit to `events` with type `admin.offer.*`.

## Review Focus

1. A coupon typed in lower case or with spaces should still work: codes are trimmed and upper-cased. Pinned in Task 1.
2. A "buy 2 get 1" cart with only two eligible books gives no discount. Pinned in Task 1.
3. An offer that would push the total under ₹1 is capped at a ₹1 total. Pinned in Task 1.
4. A paused, expired or used-up offer never applies, even if the cart was opened earlier. Pinned in Tasks 1 and 2: checkout returns 409 "Prices changed."
5. A database without the offers tables (production before setup) still sells at normal prices. `loadOffers` returns `[]`. Pinned in Task 2.

---

### Task 1: Pricing engine

**Files:**
- Create: `src/lib/offers.ts`
- Test: `scripts/test-offers.mjs` (add to the list in `scripts/test-all.mjs`)

**Interfaces:**
- Produces:
  - `type Offer = { id: string; name: string; kind: "percent" | "flat" | "bxgy" | "bundle"; scope: "all" | "books" | "collection" | "category" | "order"; targets: string[]; value: number; cap: number | null; buy_qty: number | null; get_qty: number | null; get_percent: number | null; bundle_qty: number | null; bundle_price: number | null; min_items: number; min_subtotal: number; code: string | null; combinable: boolean; first_order_only: boolean; usage_limit: number | null; per_customer_limit: number | null; priority: number; starts_at: string | null; ends_at: string | null; status: "draft" | "active" | "paused" | "archived"; uses: number; created_at: string }`
  - `type CartLine = { slug: string; price: number; regular: number; categories: string[]; collections: string[] }`. `price` is today's `currentPrice().price`, and `categories` includes ancestor subjects.
  - `type Customer = { paidOrders: number; uses: Record<string, number> } | null`. `null` means the email is unknown (cart view).
  - `type PricedCart = { lines: { slug: string; regular: number; base: number; price: number; discount: number; offers: string[] }[]; applied: { id: string; name: string; code: string | null; saving: number }[]; subtotal: number; discount: number; total: number; coupon: { code: string; ok: boolean; message: string | null } | null }`
  - `priceCart(lines: CartLine[], offers: Offer[], ctx: { now: Date; code?: string | null; customer?: Customer }): PricedCart`
  - `isLive(offer: Offer, now: Date): boolean`. True when status is `active`, `starts_at <= now < ends_at` (null means open), and `uses < usage_limit` (null means unlimited).
  - `offerBadge(offer: Offer): string` gives the short label.
  - `normaliseCode(input: string): string` trims, upper-cases and keeps only `[A-Z0-9-]`, up to 32 characters.

- [ ] **Step 1: Write the failing tests** in `scripts/test-offers.mjs`.
  - Load `src/lib/offers.ts` with `ts.transpileModule`, as `scripts/test-publishing-db.mjs` does.
  - Lines: A ₹300, B ₹200, C ₹100, each in categories `['ayurveda']` with no collections. `offer(overrides)` builds a live `Offer` with defaults.
  - Assertions:
    - percent 20, scope all: discount 12000, total 48000. Line prices 24000/16000/8000.
    - percent 50 with cap 10000: discount 10000. Shares by price: 5000/3333/1667, remainder on the most expensive line.
    - flat 5000 per book, scope books `['a']`: only A discounted, so total 55000.
    - flat 5000, scope order, min_subtotal 70000: no discount. Same offer with min_subtotal 50000: discount 5000.
    - bxgy buy 2 get 1 at 100: C is free, discount 10000. Cart of A and B only: discount 0.
    - bundle of 2 for ₹400: picks A and B (saving 10000). C keeps full price.
    - Two automatic offers, 20% on `books ['a']` (saving 6000) and flat ₹150 per book on `books ['a','b']` (saving 15000 + 15000 = 30000):
      - flat runs first and uses A and B;
      - percent then has no unused book;
      - `applied.length === 1` and discount 30000.
    - Combinable coupon SAVE10 (percent 10, scope all) after automatic 20% scope all: auto 12000. The coupon applies to 48000, so 4800. Discount 16800.
    - Non-combinable coupon flat ₹50 scope order vs automatic 20%: coupon saving 5000 < 12000. The automatic offer is kept, and `coupon.ok === false` with message "A better offer is already applied."
    - Code `'  save10 '` matches SAVE10. An unknown code gives `coupon.ok === false` with message "This code is not valid."
    - ₹1 floor: flat 99999 scope order on a ₹1.50 cart gives total 100.
    - Not live: a paused, expired, or `uses >= usage_limit` offer has no effect. `isLive` returns false for each.
    - `first_order_only` with `customer.paidOrders === 1`: no effect. With `customer: null`: applied (cart view).
    - `per_customer_limit` 1 with `customer.uses[id] === 1`: no effect.
    - `offerBadge`: "20% off", "₹50 off", "Buy 2 get 1", "Buy 2 get 1 at 50% off", "Any 2 for ₹400", "Code SAVE10".

- [ ] **Step 2: Run** `node scripts/test-offers.mjs`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/offers.ts`.** The selection algorithm is not determined by the tests, so here it is:

```ts
// Automatic offers: repeatedly take the offer with the largest saving on still-unused lines
// (tie: higher priority, then newer); it consumes the lines it discounted; each offer at most once.
// Coupon: combinable -> evaluate on all lines at their post-automatic prices;
// otherwise evaluate alone on base prices and keep it only if it beats the automatic total.
// Finally cap the discount so total >= 100, trimming from the most expensive line.
```

  - `evaluate(offer, lines)` returns `{ saving, perLine: Map<slug, number> }`. It applies the offer's eligibility, `min_items` and `min_subtotal` (both over eligible lines).
  - `bxgy` sorts eligible lines by price, highest first, splits them into groups of `buy + get`, and discounts the last `get` lines of each full group by `get_percent`.
  - `bundle` takes groups of `bundle_qty`, highest price first, and saves `max(0, sum − bundle_price)` per group.
  - `percent` with `cap`, `flat` with scope `order`, and `bundle` split their saving by price share.

- [ ] **Step 4: Run** `node scripts/test-offers.mjs`. Expected: "Offers engine checks passed".

- [ ] **Step 5: Commit**: `git add src/lib/offers.ts scripts/test-offers.mjs scripts/test-all.mjs`, then `git commit -m "Offers pricing engine"`.

### Task 2: Schema, loading, checkout, fulfilment, cart summary

**Files:**
- Create: `migrations/008-offers.sql`, `src/lib/offer-data.ts`
- Modify:
  - `src/app/api/checkout/route.ts`: pricing, `expectedTotal`, coupon, 409
  - `src/lib/fulfil.ts`: write redemptions inside the `paid` CTE
  - `src/app/api/cart/summary/route.ts`: accept `{ slugs, coupon? }` and return `pricing`
  - `src/lib/money.ts`: `orderSavings` unchanged; checkout stops putting zero prices into `computeTotals`
- Test: extend `scripts/test-commerce-db.mjs` and `scripts/test-migrations.mjs`

**Interfaces:**
- Consumes: Task 1 `priceCart`, `Offer`, `CartLine`, `Customer`, `normaliseCode`.
- Produces:
  - `loadOffers(): Promise<Offer[]>`: active, not ended, with `uses`. It returns `[]` when the table is missing (`relation "offers" does not exist`).
  - `cartLines(books: Book[]): Promise<CartLine[]>`: categories with their ancestors from `categories.parent_slug`, and collections from published `content_collections.book_slugs`.
  - `customerHistory(email: string): Promise<Customer>`: paid orders (status `paid` or `fulfilled`), plus redemptions per offer for that email.
  - The `/api/cart/summary` response adds `pricing: PricedCart | null`.

- [ ] **Step 1: Write `migrations/008-offers.sql`.**
  - Plain statements only, with no `$$` blocks, so the admin setup can split on `;\n`.
  - `create table if not exists offers (...)` with the Task 1 columns, plus:
    - `check (kind in (...))` and `check (scope in (...))`;
    - `value >= 0`;
    - `code text unique` and `status` default `'draft'`;
    - timestamps.
  - `create table if not exists offer_redemptions (offer_id text references offers(id), order_id text references orders(id), email text not null, discount integer not null, created_at timestamptz default now(), primary key (offer_id, order_id))`
  - `alter table orders add column if not exists discount integer not null default 0`
  - `alter table orders add column if not exists offers jsonb not null default '[]'::jsonb`
  - `test-migrations` asserts that applying it twice succeeds.
- [ ] **Step 2: Write the failing checkout tests** in `test-commerce-db.mjs`, with live offer rows inserted into PGlite:
  - A 20% scope-all offer on a ₹X cart. Checkout with `expectedTotal` equal to the discounted total gives 200. The order has `discount`, `total` and `items[].price`/`discount` as allocated, and `offers` contains `{ id, saving }`.
  - The same cart with the old `expectedTotal` gives 409 "Prices changed." with `pricing.total`, and no payment link is created.
  - A coupon changes the idempotency hash: the same key with a different coupon gives 409.
  - Fulfilling the order inserts one `offer_redemptions` row. Fulfilling again inserts nothing new.
  - With the offers table dropped, checkout charges `currentPrice` totals (`loadOffers` returns `[]`).
- [ ] **Step 3: Run** `npm test`. Expected: the new checks FAIL.
- [ ] **Step 4: Implement.**
  - `offer-data.ts` loads offers and lines. Checkout calls `priceCart` with `customerHistory(email)`.
  - Checkout computes `subtotal = Σ base`, keeping the existing `computeTotals` validation on base prices, then `discount` and `total`.
  - Checkout inserts `discount` and `offers` and stores the per-line `price`, `discount` and `list_price`. The Razorpay amount is `total`.
  - Fulfilment: `paid` returns `id, email, offers` and inserts redemptions with `on conflict do nothing`.
- [ ] **Step 5: Run** `npm test`. Expected: all suites pass.
- [ ] **Step 6: Commit**: "Checkout charges offers priced on the server; fulfilment records redemptions".

### Task 3: Admin Offers screen

**Files:**
- Create:
  - `src/app/admin/offers/page.tsx` (list and form)
  - `src/app/admin/offers/OfferForm.tsx` (client; fields change by kind and scope; live preview using `offerBadge`)
  - `src/app/api/admin/offers/route.ts`
- Modify:
  - `src/components/AdminShell.tsx`: add the "Offers" nav item with an icon
  - `src/lib/offer-data.ts`: add `parseOffer(form: FormData): Offer`, `saveOffer`, `setOfferStatus(id, status)`, `duplicateOffer(id)`, `offerStats()`
  - `next.config.ts`: `outputFileTracingIncludes["/api/admin/offers"] = ["./migrations/008-offers.sql"]`
- Test: `scripts/test-offers-admin.mjs` (route plus PGlite; add it to test-all)

**Interfaces:**
- Consumes: Task 2 tables, `loadOffers`. Task 1 `offerBadge`, `isLive`, `normaliseCode`.
- Produces: POST `/api/admin/offers`, a form post with `action` set to one of:
  - `save`
  - `pause`
  - `resume`
  - `duplicate`
  - `archive`
  - `setup`, which applies the 008 statements when `offers` is missing

  On success it redirects 303 to `/admin/offers?saved=1`. On error it redirects to `/admin/offers?error=<message>`.

- [ ] **Step 1: Write the failing tests.**
  - `parseOffer` rejects:
    - percent outside 1–90;
    - bxgy without buy/get;
    - bundle without qty/price;
    - an end before its start;
    - a code outside `^[A-Z0-9-]{3,32}$` after `normaliseCode`;
    - scope `books` with no targets.
  - Datetime-local values get `+05:30`.
  - `save`, then `pause`, gives `status='paused'` and an `admin.offer.saved` event.
  - `duplicate` copies the offer as a draft with name "Copy of …" and `code` null.
  - `setup` on a database without the tables creates them.
  - The route returns 401 without admin and 403 with a bad origin.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the screen.**
  - The list shows a status chip (Live / Scheduled / Paused / Ended / Draft, from `isLive` and the dates), the badge text, the target summary, uses (and limit), discount given, and revenue of paid orders carrying the offer.
  - Each row has Edit (details form), Pause/Resume, Duplicate and Archive.
  - The "New offer" form uses `BookPicker` for books, a select of published collections and a select of categories.
  - When tables are missing, the page shows only the "Turn on offers" setup button.
- [ ] **Step 4: Run** `npm test`. Then do a manual pass on the dev preview: create one offer of each kind and see the preview text. Expected: pass.
- [ ] **Step 5: Commit**: "Admin Offers screen".

### Task 4: Storefront: badges, offers box, cart and checkout

**Files:**
- Modify:
  - `src/lib/store-data.ts`: `getStoreBooks` adds `offers: string[]` (badges of live automatic offers and coupons targeting the book) through `loadOffers` + `cartLines`
  - `src/components/book-data.ts`: `PublicBook.offers: string[]` (default `[]`)
  - `src/components/BookCard.tsx`: if `book.offers[0]` exists, it becomes the card flag; otherwise the existing "% off"
  - `src/app/(store)/books/[slug]/page.tsx`: an "Offers" list of chips under the price
  - `src/lib/listing.ts`: `offer` filter = `onSale || offers.length > 0`
  - `src/app/(store)/cart/CartContents.tsx`, `src/app/(store)/checkout/CheckoutForm.tsx`, `src/components/CartDrawer.tsx`: use `pricing` from `/api/cart/summary`
  - `src/components/CartProvider.tsx`: `coupon` state kept in `sessionStorage` under `inventayu-coupon`
- Create: `src/components/CouponBox.tsx` (input with Apply/Remove, plus the server message)
- Test: extend `src/components/reading-room.test.cjs`

**Interfaces:**
- Consumes: the Task 2 summary `pricing` and checkout 409 `{ error: "Prices changed.", pricing }`. The Task 1 `PricedCart` shape.

- [ ] **Step 1: Write the failing tests.**
  - BookCard with `offers: ["Buy 2 get 1"]` renders that flag.
  - CartContents with a `pricing` that has `applied` renders each offer's name and `−₹saving`, and the total from `pricing.total`.
  - CheckoutForm sends `expectedTotal` and `coupon` in the request body.
  - On a 409 "Prices changed." it shows "Prices were updated. Check the new total." and the new total, and the next submit sends the new `expectedTotal`.
  - CouponBox shows the server message when `ok` is false.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the copy short. Styles: `.offer-chips`, `.applied-offer`, `.coupon-box` in `src/styles/account.css` and `card.css`, using existing tokens.
- [ ] **Step 4: Run** `npm test` and the 4-width UI sweep on the dev preview. Then follow a buy-2-get-1 flow through the bag, cart and checkout (preview, with `ALLOW_DEV_CHECKOUT`). Expected: no overflow, totals match on every screen.
- [ ] **Step 5: Commit**: "Storefront shows offers; cart and checkout price them on the server".
