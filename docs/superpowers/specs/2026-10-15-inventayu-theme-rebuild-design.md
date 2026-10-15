# INVENTAYU theme rebuild and live readiness — design

Date: 2026-10-15 · Branch: `feature/reading-room-platform` · Supersedes the visual
sections of `2026-10-15-storefront-marketplace-redesign-design.md` (functional
sections of that spec still stand). Status: approved in conversation, awaiting spec review.

## 1. Intent

The live storefront fails on looks and on function. The user rejected both the
Crossword-style and the Akshara rebuilds and chose the original INVENTAYU-inspired
storefront at commit `65f7044` as the base: "aesthetic, rich and minimally premium".
That base is kept and extended with the marketplace components the branch already
implements, under one rule that applies to every page.

### The governing rule (applies everywhere)

> Text minimalization and visual component richness, transitions and animations
> that make content engaging and let the user experience the sync. Richer, not
> just minimal.

Every page — home, listing, product, bag, checkout, library, wishlist, login,
author workspace, admin, emails — is reviewed against it:

- Headings ≤ 6 words; at most one short line beneath; no homepage paragraphs.
- Facts are mono chips (`PDF · 51 CHAPTERS · INSTANT`), not sentences.
- Every section has a visual anchor (covers, artwork, cover stacks, imagery).
- Navigation and actions are continuous: shared-element transitions, motion
  feedback on every action, no dead jumps.

Success: the live site looks like `65f7044` grown into a full store, every
storefront and admin function works on the deployed URL, and a ₹1 test-mode
purchase completes end to end.

## 2. Visual system (from `65f7044`, verbatim tokens)

| Token | Value |
|---|---|
| Fonts | Geist (sans), Geist Mono (labels, data) |
| Page ground | `#fafaf7`; raised cards `#ffffff`; tint `#efede5` |
| Ink | `#0a0e0c`, soft `#4a524f` |
| Lines | `#e8e6dd`, strong `#d6d3c7` |
| Brand | green `#2f7a4d`, deep `#1f5a3a`, glow `#5bc58a`, gold `#b9852e` |
| Bands | forest `#0b2416`, `#123a24`, line `#1e4d33`, cream `#f4f1e6` |
| Radii | 4 / 10 / 18px; container 1400px |

Signature details kept: emerald→gold gradient on one key phrase per heading,
mono uppercase labels, soft-shadow raised cards, check-tick trust rows,
gradient-filled green primary buttons.

Removed: all styling from the Crossword, forest-retail and Akshara attempts
(yellow header, indigo, ribbons, script letterforms, Bricolage/Mukta fonts,
per-title coloured demo covers). Demo covers become neutral typographic covers
in the theme palette (preview only).

### Visual richness
- Covers render as 3D books: perspective, spine, page edges, ground shadow.
- Hero uses the existing botanical artwork graded to emerald/gold with real
  covers floating in front.
- Theme-coloured gradient-mesh washes behind sections; forest bands with a gold glow.
- Category tiles are fanned stacks of real covers with a mono count.

### Motion and sync
- Shared-element transitions: card cover morphs into the product page cover
  and back (View Transitions API; cross-fade fallback).
- Add to bag: cover flies to the bag icon, count ticks, drawer slides in.
- Wishlist heart burst; cards tilt toward the cursor and lift to reveal Quick
  view and Add; rails drag/swipe with momentum plus arrows.
- Hero covers drift with pointer and scroll parallax; gradient phrase shimmers once.
- Scroll-linked staggered reveals; skeleton shimmer while loading; search
  suggestions drop down with covers; listing grids animate on filter change (FLIP).
- Transform/opacity only; all motion off under `prefers-reduced-motion`.

### Scaling
Fewer than 5 visible titles: the large `65f7044` catalogue cards (trimmed to
title, author, chips, price, buy). Five or more: compact 3D cover cards in rails
and grids. Same tokens either way.

## 3. Components and pages

### Frame
- Header: slim white bar, frosted on scroll; wordmark + mono `BY INVENTAYU`;
  centred search pill with cover suggestions; wishlist, account, bag with counts;
  second row of mono category links with gold **Offers**; hover panel with
  sub-categories and three cover previews.
- Announcement strip: thin forest bar with gold text, only when set in admin.
- Footer: `65f7044` footer plus link columns and popular-search chips.

### Homepage
1. Hero campaign carousel (admin banners; falls back to the `65f7044` hero): gradient
   headline, one line, two CTAs, trust ticks, floating 3D covers over artwork;
   dots, pause control, 7s autoplay.
2. Category tiles (fanned cover stacks, mono counts).
3. Books: large catalogue cards below 5 titles; rails (New, On offer,
   Bestsellers from real orders, Coming soon) at 5+.
4. "Look inside" forest band: swipeable highlight cards per book.
5. Language strip: only languages carried; hidden when only one.
6. Authors: round photo chips for published profiles.
7. Publish band: forest with gold glow, one line, CTA, cover-stack art.
8. FAQ: `65f7044` card grid, answers collapsed.

### Product page
Left: sticky 3D cover with sample-page thumbnails (lightbox). Right: mono
catalogue number, title, author link, chips, price block (struck regular + gold
"% off" chip on sale), **Buy now** (gradient green), **Add to bag**, heart, share,
trust ticks. Below: tabs (About, Contents, Details mono table, Author); rails
(More by this author, Similar, Recently viewed).

### Listing (search, category)
Sticky facet sidebar of mono chips with counts, segmented sort control, compact
cover grid, FLIP animation on filter change.

### Other surfaces
Bag drawer, quick view, wishlist, checkout (two-step card with cover thumbnails
in the summary), library, login, author workspace, admin shell and transactional
emails adopt the same tokens, chips and motion. Their logic is unchanged.

### Existing functionality reused, not rewritten
Admin (books, categories, orders, banners, collections, authors, reviews,
delivery), search suggestions, wishlist and sync, quick view, cart drawer, Buy
now, recently viewed, listing/category/author pages, per-title sale prices
through checkout. Work is in `src/styles/*`, component markup and new motion
components; server logic changes only where a bug is found.

## 4. Live readiness

Order of work: function first (mostly configuration), then the visual rebuild.

1. **Live database.** User takes a Neon backup branch of the production database,
   then runs `node --env-file=<prod env> scripts/migrate.mjs --apply` (additive
   001–007; the 22 existing orders are preserved). Claude verifies schema and data
   read-only afterwards.
2. **Release books.** `scripts/release-books.mjs` (committed version of the dev
   script) takes the expected database host as a required argument and refuses
   any other; records each private file's SHA-256, marks scan clean and released,
   writes an audit event. The real "Researching Research for Ayurveda" PDF replaces
   the 696-byte placeholder in `private/books/` first. The dev-branch run is
   re-checked before the live run.
3. **Vercel environment checklist** (Claude writes it to `docs/LAUNCH_CHECKLIST.md`):
   `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_TOKEN`, `COMMERCE_ENABLED`,
   `COMMERCE_POLICIES_APPROVED`, `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS`,
   `SUPPORT_EMAIL`, `CRON_SECRET`, `DOWNLOAD_SECRET`, `NEXT_PUBLIC_SITE_URL` (https),
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
   `RESEND_API_KEY`, `MAIL_FROM`. Legal and support values come from the user.
4. **Email.** User adds Resend DNS records for `books.inventayu.com` until verified.
5. **Razorpay.** Webhook `https://<site>/api/webhook` with the webhook secret; test
   keys until KYC clears.
6. **Live check.** `scripts/check-live.mjs <url>`: public routes 200, search
   suggestions return results, product pages show a price and enabled Buy now,
   admin token sign-in reaches `/admin`, checkout configuration reports available
   (without creating an order). Then the user makes one ₹1 test-mode payment and
   Claude confirms order, download and receipt read-only.

## 5. Testing

- Existing offline suites stay green (`npm test`, `tsc`).
- Browser checks (`scripts/check-browser.mjs`) extended: shared-element
  transition present on card→product navigation, add-to-bag fly animation
  triggers, reduced motion removes all transforms, no overflow 320–1920px, 200% zoom,
  axe checks.
- Copy check: a test fails if any homepage heading exceeds 6 words or any homepage
  section renders a paragraph longer than one line of body copy (≤ 120 characters).
- Visual review: screenshots at 390 and 1440 for home, listing, product, bag,
  checkout, library and admin compared against `65f7044` before sign-off.

## 6. Out of scope

New business features beyond the earlier spec (coupons, reviews, gift cards),
production database writes by Claude, deploying (user deploys via PR to main).
