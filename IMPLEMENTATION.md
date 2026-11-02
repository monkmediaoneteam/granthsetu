# Reading Room platform implementation

## Scope and status

Implemented scope: specialist digital bookstore, guest cart checkout,
verified-email library, reviewed author submissions, editorial homepage modules,
and administration. Store identity remains configurable. Payouts and print sales
are excluded. Implementation is present locally; production activation is not approved.

Parallel contributors own storefront,
commerce, publishing, and authentication/data integration. No production database
migrations, deployments, real emails, charges, or production checks were performed
as part of the publishing changes recorded here.

## Implemented behavior

- Storefront: searchable catalogue, book pages, cart, checkout, receipts, library,
  author workspace, and configurable editorial modules/collections.
- Access: magic-link sign-in, verified reader ownership checks, admin roles and
  sessions, origin checks, and rate limits. Actual Better Auth integration passes
  CSRF, hashed single-use concurrent magic links, verified sessions and revocation.
- Commerce: server prices, checkout idempotency, hosted Payment Links, verified
  provider settlement, entitlements, refund revocation, reconciliation, and email
  delivery retries. Checkout has explicit configuration and policy gates.
- Delivery: purchased file URL, format, edition, and SHA-256 snapshots; checksum
  verification before delivery; licensed PDFs and download limits. Missing legacy
  snapshots fail closed and require explicit recovery rather than substitution.
- Publishing: owned profiles/drafts, declaration at submission, private quarantine,
  byte validation, signed scan callbacks, asset review, editorial/rights/commercial
  approval, version checks, atomic release, and audit records.
- Admin: content CRUD and scheduling, submission review, order export, and audited,
  bounded delivery recovery, reviewed first-party release, and audited third-party
  archive/restore without losing approvals. Purchased snapshots remain unchanged.

Publishing migration `003` adds `books.file_sha256` with `IF NOT EXISTS` before the
release trigger. Release copies the clean, reviewed manuscript's hash. The trigger
matches both file URL and SHA-256 against that manuscript while retaining ownership
declaration, editorial, rights, commercial, cover, sample, and scan requirements.

Finding 3: publishing previously accepted slugs up to 120 characters, while
download tokens support at most 101. `releaseSubmission` now rejects lengths above
101 before querying the database. Publishing tests exercise rejection at 102,
120, and 121, and a successful real PGlite release at 101. No existing slugs are
renamed or backfilled by this change.

## Isolated checks and preview

- `npm test`: offline regression runner for helpers, routes, authentication,
  recovery, and real PGlite database behavior, with provider fixtures.
- `node scripts/test-publishing.mjs`, `node scripts/test-publishing-db.mjs`, and
  `node scripts/test-publishing-routes.mjs`: focused publishing checks.
- `npx tsc --noEmit --incremental false`: TypeScript check without emitted files.
- `npm run preview:isolated -- 3100`: temporary seeded PGlite storefront preview;
  checkout, payment/email/storage credentials, and admin bootstrap are disabled.
- `npm run test:browser`: separate local-preview browser/accessibility checks;
  requires running preview and installed Playwright browsers.

The publishing tests run actual helpers and SQL triggers. They cover ownership,
review/scan gates, stale versions, audit records, atomic release, hash copying,
direct insert/update hash bypass attempts, and the slug boundary. A valid reviewed
release remains supported; blocked releases leave status, version, and audit state
unchanged.

The complete offline regression runner passed, including 41 commerce database
checks, 14 commerce helper checks, 14 commerce route checks, all publishing suites,
actual Better Auth, recovery and migration runner checks. TypeScript passed.
Earlier transient payment-recovery failures during concurrent edits and the
PGlite close/reopen authentication-test abort are resolved, not launch blockers.

The first Chromium/Firefox/WebKit pass passed all six widths (320, 390, 768, 1024,
1440, 1920), ten public routes, image loading, WCAG-tagged accessibility scans,
empty search and no-JavaScript catalogue. The expanded uninterrupted three-browser
pass also passed saved-cart persistence/removal, keyboard skip-link and FAQ,
200% zoom, landscape and one/two/nine-book long-title layout fixtures. Fixtures
use server-rendered component markup in a JavaScript-disabled context; they
test layout, not separate catalogue data implementations. The production build
passed with live credentials cleared. Production dependency audit: zero advisories.
No real-device, production exploit, live payment or live email tests were run.

The campaign background is generated photographic artwork (about 200KB WebP),
with original publication covers composited in the frontend. No generated covers,
reviews or sales claims are used. The former flat-colour filler band was removed.

## Production blockers

Complete the release verification below. Review and apply the base schema and all
ordered migrations through an approved release process, with backups,
rollback, historical checksum/snapshot recovery, and recovery alerts.

Approve seller/support information, tax and policy treatment, publication metadata,
prices, rights, private paid files, checksums, clean scans, and release flags.
Configure the canonical domain, database, strong auth/download/webhook/cron secrets,
admin access, verified email sender, private storage and allowed hosts, operating
scanner service, live payment account, and provider reconciliation/delivery alerts.
Exercise real provider behavior only through separately approved integration work.
Confirmed partial refunds currently revoke the whole order conservatively; obtain
policy approval or implement provider-confirmed per-edition refund allocation.
Daily reconciliation is insufficient for prompt recovery: verify the hosting plan
or configure a secured external scheduler for more frequent reconciliation.

Commerce remains subject to explicit release configuration. Tax is currently zero;
legal and tax approval is outstanding. The configured reconciliation cron is daily
at 03:00 UTC. `node --env-file=.env.local scripts/migrate.mjs --apply` applies the
base schema and all ordered SQL migrations. It requires `--apply` and
`DATABASE_URL` before connecting. The draft catalogue command is
`node --env-file=.env.local scripts/seed.mjs --apply-draft-catalogue`; it requires
that explicit flag and `DATABASE_URL`, applies schema/migrations, and inserts only
missing catalogue rows at price zero with no paid file or release approval.
Existing rows are skipped on slug conflict; records and purchases are not replaced.
Both commands write to the configured database. Their flags do not provide
isolation or production approval; use the isolated preview for demos and an
isolated database branch for development writes. These commands were not run as
part of this work. Local implementation acceptance is complete; production
activation remains blocked by the external gates above. No deployment or push
was performed, and the existing public storefront is unchanged.
