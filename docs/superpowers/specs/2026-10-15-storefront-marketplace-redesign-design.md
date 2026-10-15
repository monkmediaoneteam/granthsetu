# Storefront marketplace redesign — design

Date: 2026-10-15 · Branch: `feature/reading-room-platform` · Status: approved in conversation, awaiting spec review

## 1. Intent

The storefront must read as a multi-category digital book marketplace in the
spirit of crossword.in and bookswagon.com, not a showcase for the two titles that
exist today. The previous storefront (serif display type, muted greens, outline
icons standing in for imagery, no motion, copy about two books) is replaced, not
restyled. Commerce, publishing, access control and security code stays; only
what this spec names changes.

Success means: a visually rich, image-led store that is dense, colourful and
interactive at 60 titles and still coherent at 2; every admin function reachable
and usable locally; admin-managed banners and per-title offers that flow through
server-priced checkout.

### Decisions taken

| Question | Decision |
|---|---|
| Inventory for design and preview | Demo catalogue (~60 titles, 10+ categories) in the isolated preview only |
| Visual direction | A · Bright retail (Crossword) with Bookswagon category bar and product details |
| Working features | Search suggestions, wishlist, quick view + quick add, cart drawer, admin campaign banners, offers, full admin |
| Offer model | Per-title sale price with optional start/end dates |

### Constraints kept from READING_ROOM_PRD.md

- Digital-only, INR, server-priced immutable purchase snapshots.
- No fabricated reviews, ratings, bestseller claims or testimonials. "Bestsellers"
  is computed from real paid orders only.
- Real covers are never altered; demo covers exist only in the isolated preview.
- Additive migrations; archive instead of delete; verified roles; origin checks.

### Changed in READING_ROOM_PRD.md

"No discounts" becomes: admin-set per-title sale prices are allowed; a struck
price must be the title's genuine regular price.

## 2. Sub-project order

1. Admin access and admin rebuild
2. Migration 007 and demo catalogue
3. Visual system, header, footer
4. Product card and carousels
5. Homepage
6. Category and search pages
7. Product page
8. Interactions: suggestions, wishlist, quick view, cart drawer, recently viewed
9. Offers through checkout
10. Browser, accessibility and screenshot pass

Each step ends with `npm test`, `tsc`, and a screenshot review at 390 and 1440px.

## 3. Admin

### Local access
- `scripts/dev-preview.mjs` generates a random `ADMIN_TOKEN` per run and prints it
  to the terminal. Production configuration is unchanged.
- When `NODE_ENV !== 'production'` and `RESEND_API_KEY` is unset, `sendMagicLink`
  logs the sign-in URL to the server console instead of throwing. Production keeps
  requiring Resend.

### Admin shell and sections
One shell with left navigation: Dashboard, Orders, Books, Categories, Authors,
Collections, Banners, Homepage sections, Submissions/Reviews, Delivery recovery.

- **Books:** structured form — title, subtitle, authorship, author profile,
  category, language, format, edition, ISBN, pages, publisher, price, sale price
  with start/end, release date, cover preview, sample, publish/archive. Release
  gates (rights, commercial, scan, release) shown as a checklist with the reason a
  title is not on sale.
- **Categories:** CRUD with image, colour, parent, order.
- **Banners and homepage sections:** forms per module type with image preview,
  schedule (start/end), draft/published, reorder.
- **Collections:** book picker with search, no slug typing.
- **Orders:** search and status/date filters, order detail with item snapshots,
  existing CSV export.
- Existing audit, origin and role checks apply to every new route.

## 4. Data (migration `007-marketplace.sql`, additive)

```sql
create table if not exists categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 80),
  parent_slug text references categories(slug),
  image_url text, colour text, sort int not null default 0,
  status text not null default 'published' check (status in ('draft','published','archived'))
);
alter table books add column if not exists category_slug text references categories(slug);
alter table books add column if not exists sale_price_inr int;
alter table books add column if not exists sale_starts_at timestamptz;
alter table books add column if not exists sale_ends_at timestamptz;
alter table books add column if not exists release_date date;
-- constraint added guarded: sale_price_inr is null or (sale_price_inr > 0 and sale_price_inr < price_inr)
create table if not exists wishlist (
  reader_id text not null, book_slug text not null references books(slug),
  created_at timestamptz not null default now(), primary key (reader_id, book_slug)
);
alter table content_modules add column if not exists ends_at timestamptz;
-- content_modules.type check extended with 'announcement','promo','genre-switcher'
```

Existing `subject` values are copied into `categories` and `books.category_slug`;
`subject` is not dropped. Public content reads honour `ends_at`.

### Demo catalogue
`scripts/isolated-db.mjs` seeds, only for the isolated preview: 12 categories, ~60
demo titles with generated typographic SVG covers (title, author, category colour;
clearly fictional), mixed prices, some active sales, some future release dates,
several authors with profiles, demo paid orders so Bestsellers has data, banners,
promo tiles and an announcement. Demo rows are flagged (`facts._demo = 'true'`) and
the production seed never inserts them.

## 5. Visual system

- **Type:** Plus Jakarta Sans (headings 700–800) and Inter (text, prices) via
  `next/font/google`. Fraunces and Manrope are removed.
- **Colour tokens:** `--yellow` (~#FFD93D) header, buttons and footer;
  `--ink` (#111) text and primary dark buttons; `--offer` green pill for savings;
  `--sale` coral for campaign panels; sky-blue and lilac campaign panels;
  INVENTAYU green only for success and available states.
- **Icons:** lucide-react kept for controls only (search, heart, user, bag,
  arrows) at stroke 2. Categories, languages and authors use imagery or glyphs,
  never outline icons in tinted circles.
- **Radius and surfaces:** white cards on a light grey page (#F7F7F7), 12px
  card radius, 8px button radius, pill chips.
- **Motion:** hover lift on cards, heart pop, cart count bounce, drawer slide,
  carousel smooth scroll; banner autoplay 6s with pause control. Everything off
  under `prefers-reduced-motion`.

## 6. Pages

### Frame
- Black announcement bar (from `announcement` module; hidden when none).
- Yellow header: logo, top categories inline, rounded search pill with
  suggestions, wishlist, account and bag with counts.
- Category bar with mega-menu dropdowns for categories with children.
- Yellow footer: link columns (Categories, Help, Policies, Publish) and
  "Popular searches" chips from categories.

### Homepage (sections hide when empty)
1. Promo banner carousel (`banner` modules).
2. Bento promo grid (`promo` modules; a large tile may show a collection's live cards).
3. Carousels with heading, tagline, round arrows, "Show all ↗": Bestsellers (paid
   orders, last 90 days), New arrivals, On offer, Coming soon (release-date chip).
4. Genre switcher panel: stacked category names; selecting one swaps the carousel.
5. Indian bookshelf: language circles with script glyphs linking to filters.
6. Category image cards with "Shop now" pill.
7. Discover authors: round photos to author pages.
8. Publish-with-us banner.

### Product card
White card; cover on white in fixed 3:4 frame; heart top-right; title (2 lines),
author; struck regular price, current price, green "₹N off" pill when on sale;
"Coming soon" chip for future release; full-width yellow "Add to bag"; hover lift
and quick-view button.

### Category and search pages
`/category/[slug]` and `/search?q=` share one layout: banner (category image or
colour), sub-category chips, facet sidebar (category, author, language, format,
price band, on offer), sort, result count, active-filter chips, cover grid,
pagination. `/catalogue` redirects to `/search`.

### Product page
Grey page; left: thumbnail strip (cover and sample pages when supplied) and large
image card; right: title, author link, category chips, price block (MRP struck,
price, "₹N off", "Incl. of all taxes" only once tax treatment is approved), Add to
bag and Buy now, wishlist and share, digital trust row (Instant download, Secure
payment, Licensed copy, Lifetime library); details strip with icons (ISBN, pages,
language, format, publisher); tabs: About the book, Contents, About the author;
carousels: More by this author, Similar books, Recently viewed. Book JSON-LD uses
the current price.

### Other pages
Cart, checkout, library, wishlist, login, author workspace, publish and policy
pages adopt the new frame, type and tokens; their logic is unchanged.

## 7. Interactions

- **Search suggestions:** `GET /api/search/suggest?q=` (min 2 chars, 150ms
  debounce) returns ≤6 books (slug, title, author, cover, current price), ≤3
  authors, ≤3 categories; public fields only; rate-limited; ARIA combobox with
  arrow/Enter/Escape; failure hides the panel and plain search still works.
- **Wishlist:** guest list in localStorage (CartProvider pattern, max 100);
  signed-in list in `wishlist`, merged on sign-in via `POST /api/wishlist/merge`;
  `GET/POST/DELETE /api/wishlist`; `/wishlist` page; header count. Sync failure
  keeps local state.
- **Quick view:** native `<dialog>` from card data already on the page.
- **Cart drawer:** opens on add; prices from `POST /api/cart/summary` (server
  `currentPrice`); failure shows "Prices unavailable" with a link to the bag.
  "Buy now" adds and routes to checkout.
- **Recently viewed:** last 12 slugs in localStorage; carousel on product page.

## 8. Offers

- `currentPrice(book, now)` in `src/lib/money.ts` returns
  `{ price, regular, onSale }`; sale applies when `sale_price_inr` is set and
  `now` is within the optional window.
- Used by every display surface, `/api/cart/summary`, JSON-LD and
  `src/app/api/checkout/route.ts` (order item `price` = current price; new
  snapshot field `list_price` = regular price).
- Payment validation continues to compare against the stored order total.
- Existing pending orders keep their snapshot price on retry.
- Receipts and emails show "You saved ₹N" from the snapshot.

## 9. Testing

- Unit: `currentPrice` windows and boundaries; DB constraint rejects sale ≥
  price; suggestion matching and limits; wishlist merge; module `ends_at`.
- Commerce DB tests: checkout charges sale price inside the window and regular
  price outside it; snapshot stores both; webhook amount validation unchanged.
- Admin: browser test signs in locally and exercises each section (create, edit,
  schedule, archive).
- Storefront browser tests (Chromium, Firefox, WebKit; 320–1920px): suggestion
  keyboard path, wishlist persistence, quick view, drawer, buy now, banner pause,
  no horizontal overflow, 200% zoom, no-JS search, axe checks.
- Manual screenshot review against the reference captures before sign-off.

## 10. Out of scope

Coupon codes, category-wide offers, real reviews and ratings, pre-orders with
payment, gift cards, blog ("From the reading desk"), print or shipping features.
