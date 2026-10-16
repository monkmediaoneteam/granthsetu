# Admin offers engine — design

Date: 2026-10-16 · Status: draft for approval · First of three admin upgrades (offers → analytics → payments and roles).

## Intent

The admin can only set one sale price per book today. The owner wants store-style promotions like Crossword and Bookswagon run: choose **which products** (single books, a collection, a subject, or everything), choose **the type** (percent off, flat off, buy X get Y, bundle price, coupon codes), schedule them, cap them, and see what each one earned. Customers must see the offer before they pay, and must be charged exactly what they were shown.

## Goals

- One admin screen, **Offers**: list with status (Live / Scheduled / Paused / Ended), uses, discount given and revenue from orders using each offer, plus create, edit, pause/resume, duplicate.
- Offer types:
  1. **Percent off** (for example 20% off), with an optional cap in rupees.
  2. **Flat off** (₹50 off each eligible book, or off the order when the scope is "order").
  3. **Buy X get Y**: buy X eligible books and get Y more eligible books free or at a percent off. The cheapest eligible books are discounted.
  4. **Bundle price**: any N eligible books for ₹P.
  5. **Coupon code**: any of the above that needs a code typed at checkout.
- Targets: all books, chosen books, a collection (existing `content_collections`), or a subject (category, including its child subjects).
- Conditions: start and end time in India time, minimum books, minimum order value, total use limit, per-customer limit (by email), first order only.
- Storefront:
  - offer badges on cards and product pages ("20% off", "Buy 2 get 1");
  - an "Offers available" box on the product page;
  - cart and checkout list each applied offer and the saving, with a coupon box;
  - the Offers & deals link lists books with live offers.
- Checkout computes the discount on the server, stores it on the order, and charges `total = subtotal − discount`.

## Non-goals (this phase)

- Gift cards, wallet or store credit, loyalty points, referral codes.
- Offers that stack freely. Rule: **the best automatic offer, plus at most one coupon**. A coupon is only allowed on top when that coupon is marked "can combine"; otherwise the customer gets whichever is larger, coupon or automatic offer.
- Tax changes (tax stays 0, as today).

## Anti-goals: these would make it a failure even if it works

- The customer is charged a different amount from what the cart showed.
- Any discount computed in the browser is trusted.
- An order total of ₹0 or below. Razorpay's minimum is ₹1, so the discount is capped so the total is at least ₹1.
- Admin revenue figures that count demo or failed orders.

## How it works (decided)

- **Data** (migration `008-offers.sql`):
  - `offers`: `id`, `name`, `kind` (`percent`, `flat`, `bxgy`, `bundle`), `scope` (`all`, `books`, `collection`, `category`, `order`), `targets` (jsonb slugs), `value`, `cap`, `buy_qty`, `get_qty`, `get_percent`, `bundle_qty`, `bundle_price`, `min_items`, `min_subtotal`, `code` (unique, nullable, upper-cased), `combinable`, `first_order_only`, `usage_limit`, `per_customer_limit`, `priority`, `starts_at`, `ends_at`, `status` (`draft`, `active`, `paused`, `archived`), timestamps.
  - `offer_redemptions`: `offer_id`, `order_id`, `email`, `discount`, `created_at`, unique on (`offer_id`, `order_id`).
  - `orders` gains `discount int default 0` and `offers jsonb default '[]'`.
- **Engine**: a pure function `priceCart(lines, offers, { now, code, email history })` in `src/lib/offers.ts`.
  - It returns per-line prices, applied offers with their savings, and the totals.
  - Base price is today's `currentPrice`, so the per-book sale price keeps working. Offers apply on top of it.
  - It is the only pricing path. Checkout, `/api/cart/summary`, cards and product pages all call it.
- **Limits**:
  - Use and per-customer limits are checked at checkout against redemptions of **paid** orders.
  - A redemption row is written when the order is fulfilled.
  - Two buyers racing for the last use can both succeed. That's acceptable at this scale and noted in the code.
- **Admin UI**:
  - `/admin/offers`: list and form. The form changes its fields with the offer type and shows a plain-language preview such as "Buy 2, get 1 free on Ayurveda".
  - It reuses the existing book picker, the India-time inputs used by banners, and the existing audit events.
- **Storefront copy** stays short, following the house rule of minimal text and rich visuals: badges and chips, not paragraphs.

## Calls made after the builder review (owner to confirm)

1. **Price changed between cart and payment** (offer ended, limit reached, first-order coupon used by a returning email):
   - The client sends the total it showed. If the server's total differs, checkout answers 409 "Prices changed" with the new breakdown, and the customer confirms again.
   - The coupon code is part of the idempotency hash.
   - Nobody is ever charged an amount they weren't shown.
2. **Several automatic offers in one cart:** each book can be used by **one** offer, but different offers can apply to different books.
   - The engine takes offers largest saving first, and each one consumes the books it uses.
   - Example: an Ayurveda "Buy 2 get 1" and "20% off Science" both apply in a mixed cart.
3. **Combinable coupon:** applies after automatic offers, to the already-discounted prices. Its minimum order value is checked against that discounted subtotal.
4. **Limit hit after the order is created but before payment:** the discount is honoured. The payment is final, so the redemption is recorded even past the limit.
5. **Per-book revenue:** each discount is split across its books, rounded to whole paise, with the remainder on the most expensive book. `orders.items[].price` holds what was actually paid for that book, and `discount` holds its share. Analytics and refunds can then work per book.

## Left to the builder

- Exact badge wording and placement within the existing card and product layouts.
- When several automatic offers qualify, pick the one with the largest saving for this cart. Ties go to higher `priority`, then the newer offer.
- Whether demo titles may carry offers. They may (they can't be bought anyway).

## After this (separate designs)

1. **Analytics**:
   - revenue by day, orders, average order value, conversion, top books;
   - offer performance and refunds, over a date range;
   - demo and failed orders excluded.
2. **Payments and roles**:
   - payments list with Razorpay status, refunds from admin, and reconciliation;
   - admin users with roles (owner, editor, support) replacing the single shared admin token, with an audit trail.
