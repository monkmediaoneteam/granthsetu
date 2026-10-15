# Reading Room Storefront

## Direction

Bookstore redesign for readers and researchers, not a corporate Ayurveda landing page.
The reference priority is Crossword, Bookswagon, then MyPustak; ThemeWagon is a quality reference, not a book catalogue to reproduce.
Energy 3 / Rhythm 2 / Motion 1: campaign artwork and the forest "Look inside" band provide colour; browsing stays predictable.

## Reference Walkthrough

- Crossword: visited the homepage and Tuesdays with Morrie detail page. Campaigns and subject discovery lead into consistently sized products and a clear product detail destination.
- Bookswagon: visited the homepage and Belonging detail page. Compact product comparison and distinct promotional artwork create variety without changing shopping controls.
- ThemeWagon: visited homepage and theme catalogue. Consistent preview geometry and persistent discovery controls are applicable; template-marketplace claims are not.
- MyPustak: reviewed the supplied full-page reference and public homepage. Category entry points are useful; used-book inventory and discount claims do not apply here.

Sources: https://www.crossword.in/ ; https://www.bookswagon.com/ ; https://www.mypustak.com/ ; https://themewagon.com/
Captured reference screenshots are in scratch/reference-*.png.

## Design Decisions

- White storefront, deep green actions, and a restrained yellow announcement strip connect INVENTAYU to retail browsing. Coral and turquoise come from campaign artwork, not arbitrary UI panels.
- Libre Caslon Display gives the bookstore its editorial voice; DM Sans keeps navigation, prices, descriptions, and controls legible.
- Type: 52px campaign title, 34px section heading, 20px desktop product title, 15px body. Mobile uses explicit smaller sizes, not viewport-scaled text.
- Spacing scale: 8, 12, 16, 24, 32, 48px. Shared 1440px container; 48px large-screen gutters and 16px mobile gutters.
- Product cards use 6px corners and no floating shadows. Image proportions remain stable while copy wraps naturally.
- Only actual book covers receive subtle depth. Subject icons are literal leaf, microscope, flask, book, and library symbols from the existing icon library.
- No autoplay, scroll reveals, decorative counters, or animated backgrounds. Reduced motion disables transforms and smooth scrolling.

## Shopping Sequence

Search and account/cart access -> illustrated book campaign -> subject discovery -> "New in the reading room" shelf rail -> subject rails (only for subjects with three or more titles) -> "Look inside" highlights (text, never repeated covers) -> optional approved editorial modules -> concise delivery/library links -> publishing invitation -> digital-purchase questions.

Every book card shares one geometry (4:5 cover frame, title, author, price or Forthcoming). Homepage, collection and related shelves are horizontal scroll-snap rails; rails under four titles end with a publishing invitation tile instead of empty space. The catalogue uses a link-based facet sidebar with counts, removable chips and sort links, so it works without JavaScript. Book pages have a sticky cover, sticky buy panel with factual trust notes, author card, related rail and Book JSON-LD. Public author pages live at /authors/[author profile id]; releases set books.author_slug to that id.
Book, catalogue, cart, and checkout retain the same typography, borders, controls, and availability vocabulary.
Author spotlights are currently excluded from the homepage at the user's request. Factual book credits remain.

## Content And Runtime Boundaries

- Real titles/covers and existing bibliographic records only. No invented bestseller labels, ratings, sales, testimonials, prices, or media.
- The main campaign uses generated botanical paper artwork, with unmodified real covers layered above it. The revised artwork leaves typography clear.
- Unapproved prices are not advertised on shelves or detail pages. Backend sale gates remain authoritative.
- No public configuration banners. Customer-facing errors explain the next action without revealing server setup.
- Missing optional CMS tables no longer break the public catalogue. Other database errors still fail visibly; this is not a replacement for the pending database migration.
- No production schema, payment, email, or deployment changes are part of this visual revision.

## Verification

Use scripts/check-browser.mjs against the isolated live-source preview for all six widths, three browser engines, keyboard access, reduced motion, no-JavaScript rendering, long titles, image loading, and cart interactions.
Use the actual component suite for subject visibility, homepage author exclusion, checkout gating, and CMS publication rules.
Manual screenshot review remains necessary; passing automated layout checks does not imply user approval of the visual design.

### Verified In This Revision

- Regression suite and production build passed; focused component tests also passed after hiding unapproved cart and checkout prices.
- Chromium, Firefox, and WebKit covered 320, 390, 768, 1024, 1440, and 1920px, public routes, image loading, keyboard navigation, no-JavaScript content, cart persistence, and catalogue fixtures.
- The matrix exposed enlarged-header overflow. After the wrapping fix, all three engines passed a focused six-width and 200% zoom recheck.
- Automated accessibility checks reported no violations in the tested desktop and mobile homepage states. This is not a complete accessibility certification.
- Final desktop and mobile screenshots were reviewed in scratch/final-home-1440.png and scratch/final-first-screen-390.png.
- Live payments, email delivery, deployment, and physical-device testing were not performed. Optional CMS schema migrations remain outstanding on the original connected database.

### Artwork

public/assets/reading-room-botanical-v2.webp is generated botanical campaign artwork. The brief requested paper texture, botanical and scientific objects on the right, and a clear left area for HTML text; no generated logos, text, or book covers. Genuine covers are separate image elements.
