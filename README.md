# Reading Room by INVENTAYU

A specialist digital bookstore for Ayurveda, phytopharmaceuticals, and natural
products, with books from multiple authors and publishers. Store identity is
configurable through `NEXT_PUBLIC_STORE_NAME`. This is a standalone application;
the main INVENTAYU website is separate.

Features are implemented in this checkout. Production activation remains gated.
See `IMPLEMENTATION.md` for verification and external release requirements, and
`READING_ROOM_PRD.md` for the approved product scope. `PRD.md` is historical.

## Implemented features

- Catalogue search, book pages, cart, guest checkout, receipts, and reader library.
- Image-led campaign with genuine publication covers, mobile-visible books,
  editable editorial modules, genuine author profiles, publishing invitation and FAQ.
- Verified-email magic-link sign-in and reader/admin access checks.
- Hosted Razorpay Payment Links with server prices, idempotent checkout,
  provider-verified payment state, refund revocation, and reconciliation.
- Purchased file/edition/SHA-256 snapshots, integrity checks before delivery,
  PDF licensing, download limits, and retryable email delivery.
- Author profiles and drafts, explicit ownership declarations, private upload
  quarantine, signed scanner callbacks, editorial review, and release approval.
- Publishing release copies the clean, reviewed manuscript checksum. A database
  trigger requires matching manuscript URL/hash and existing release approvals.
  Release slugs are limited to 101 characters to fit download token claims.
- Admin content modules, collections, authors, scheduled visibility, publishing
  reviews, order exports, and audited delivery recovery.

Payouts and print sales are outside the implemented scope. Scanner callbacks are
implemented; an operating malware scanner is an external prerequisite.

## Stack

Next.js 16, React 19, Tailwind v4, Neon/Postgres, Better Auth, Razorpay, Resend,
private Vercel Blob storage, and PGlite for isolated local databases.

## Isolated development

```bash
npm ci
npm test
npm run preview:isolated
```

The preview defaults to `http://localhost:3100`. To use another available port:

```bash
npm run preview:isolated -- 3101
```

The preview creates a temporary PGlite database, applies `schema.sql` and all
ordered migrations, and seeds a browsing fixture. It disables checkout, payment
credentials, outbound email, storage credentials, and admin bootstrap credentials.
It is intended for storefront inspection; live login, uploads, and purchases are
not available. The temporary preview database is not production data.

`npm test` runs offline helper, route, and PGlite regression suites with provider
calls replaced by test fixtures. It does not load environment files or require
production credentials. A passing focused test is not final acceptance.

For browser checks, start the isolated preview, install the Playwright browsers
if needed, then run `npm run test:browser`. The browser script defaults to port
3100, accepts a localhost-only `PREVIEW_URL`, and checks Chromium, Firefox, WebKit,
responsive widths, images, accessibility, empty search, and rendering without
JavaScript. Screenshots are written under `scratch/visual-checks/`.

## Explicit database writes

These commands load `.env.local` and write to its `DATABASE_URL` target. Use an
isolated database branch for development. The flags are write opt-ins, not database
isolation; production application still requires approval and a backup.

Apply the base schema and every `.sql` migration in filename order:

```bash
node --env-file=.env.local scripts/migrate.mjs --apply
```

The migration command rejects execution without `--apply` or `DATABASE_URL` before
connecting. It executes complete SQL files through the PostgreSQL client.

Apply the schema/migrations and insert missing draft catalogue records:

```bash
node --env-file=.env.local scripts/seed.mjs --apply-draft-catalogue
```

The seed command rejects execution without `--apply-draft-catalogue` or
`DATABASE_URL` before connecting. New catalogue rows have `price_inr=0`, no paid
file URL, and no release approval, so they are unsaleable. Existing catalogue rows
are skipped on slug conflict; existing records and purchases are not replaced.
The equivalent package command is `npm run seed -- --apply-draft-catalogue`;
bare `npm run seed` is rejected. Use `npm run preview:isolated` for demos without
writing to the configured database. Neither write command deploys the application
or approves a publication for sale.

## Verification status

The full offline regression suite passed, including 41 real-database commerce
checks, authentication, publishing, checksum recovery and additive migration
reruns. TypeScript passed. The first cross-browser pass succeeded at all six
requested widths, including accessibility scans and no-JavaScript catalogue
visibility. The expanded three-browser interaction/layout checks and production
build also passed. See `IMPLEMENTATION.md` for exact scope and external gates.
These are isolated checks, not production sign-off.

## Production blockers

- Review and apply `schema.sql` and all ordered migrations using an
  approved migration process. Plan backups, rollback, and legacy order recovery;
  missing historical file/checksum snapshots block delivery.
- Approve catalogue metadata, prices, rights, actual private paid files, SHA-256
  checksums, clean scans, and explicit publication release gates.
- Confirm seller identity/address, support contacts, tax treatment, refunds,
  privacy, and delivery policies. Tax currently remains zero in the code.
- Configure the canonical domain, database, strong authentication/download
  secrets, admin access, private storage/allowed hosts, and signed scan service.
- Configure and verify the Resend sender, Razorpay live credentials and signed
  webhook, cron secret, delivery alerts, and provider recovery procedures.
- Complete approved live-service integration, real-device checks, and the release
  checklist before enabling commerce.

`vercel.json` currently schedules reconciliation daily at 03:00 UTC. Payment state
is verified with the provider; a browser redirect alone does not authorize access.
Switching keys alone does not make this checkout ready for production.
