# Reading Room by INVENTAYU

## Product

Independent premium specialist digital bookstore, initially two publications,
with a reviewed growing catalogue. Identity remains configurable. Digital-only,
INR, guest checkout and verified-email personal library. No print fulfilment,
payouts, bank-detail collection, fabricated reviews, bestseller claims, or discounts.
Frontend and transactional email precede production payment activation.

## Experience

Searchable header, photographic real-book campaign, one primary product shelf,
curated collections, supplied previews and contents, genuine author profiles,
media, consented testimonials, publishing invitation, FAQ and policy footer.
Empty editorial modules remain hidden. Use genuine publication assets; campaign
background photography may be generated, but never invent or alter cover artwork.
Crossword informs campaigns, Bookswagon discovery, and MyPustak reader trust;
do not copy their branding or unrelated retail categories.

Catalogue supports title/author/ISBN search, subject, language and format filters,
sorting and clear empty/error states. Book pages show attribution, bibliography,
edition, description, supplied samples and contents, price and delivery terms.
Cart contains distinct editions, with server-priced immutable purchase snapshots.
Retain single-book checkout entry points. Pending or ambiguous payment never
announces success. Library and receipt personal data require verified ownership
or an expiring, revocable scoped guest grant, not an order ID alone.

## Publishing And Administration

Verified authors create profiles and drafts, upload private manuscripts, separate
samples and covers, declare ownership, submit for review, and see review notes
and status. Quarantine, byte validation, malware inspection and editorial review
precede release. Editorial approval alone never permits sale: rights, commercial
terms, approved price/assets and explicit administrative release are required.
Admin manages books, authors, collections, banners, editorial/media/testimonial
modules, scheduling, preview, orders, reviews and audited recovery. Use predefined
modules and draft/published states, not a generic page builder.

## Security And Commerce

Retain Next/React/TypeScript/Tailwind, Neon, hosted Razorpay Payment Links and
Resend; use established passwordless authentication and revocable roles/sessions.
Apply additive migrations; preserve purchases and editions; archive instead of
deleting history. Private storage serves manuscripts and paid files. Public
samples/covers must pass review. Authors cannot supply arbitrary fetch URLs.

Persist orders before provider creation; deduplicate retries; reconcile ambiguous
outcomes before any retry. Validate provider reference, capture, total and INR.
Separate settlement, transactional entitlement provisioning and retryable email.
Handle lost callbacks, duplicate/out-of-order events, delayed capture, interrupted
delivery and refunds. Confirmed refunds revoke download access. Download limits
are atomic; failed preparation consumes no download. Verify purchased SHA-256,
stamp PDFs fail-closed with a non-secret licence identifier, and use expiring links.
Protect ownership and roles, limit abuse, reject cross-origin mutations, escape
alerts, redact secrets and minimise retained personal information.

## Verification And Release

Test real implementation functions with isolated databases/storage and mocked
external providers; separately verify Razorpay test mode and transactional email.
Cover retry/cancellation, forged callbacks, wrong amounts, delayed events,
outages and failures between fulfilment stages. Security checks include isolation,
expired/tampered grants, concurrent downloads, refunds, malicious uploads, XSS,
CSRF, SSRF and enumeration. Target WCAG 2.2 AA, keyboard/focus, labelled errors,
contrast, touch targets, enlarged text and reduced motion.

Visual coverage: 320, 390, 768, 1024, 1440 and 1920px, portrait/landscape,
one/two/many publications, long titles, missing assets, no-JavaScript catalogue,
media and purchased-file integrity. Chromium/Firefox/WebKit automation does not
replace real-device verification.

Production gates: approved prices/files and rights, seller/support and tax/refund
sign-off, canonical domain/DNS, verified transactional sender, private storage,
scanner, webhook/cron configuration, backups and recovery alerts. Monitor paid
but undelivered orders, failed email, ambiguous payments and download errors.
Do not activate commerce with unresolved money, access or delivery blockers.

See `IMPLEMENTATION.md` for evidence and remaining external gates; implementation
and isolated test success do not constitute production launch approval.
