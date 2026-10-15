# INVENTAYU Theme Rebuild and Live Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deployed store work end to end, and rebuild its look on the `65f7044` INVENTAYU theme with less text, richer visuals and motion that links pages together, while keeping every existing marketplace function.

**Architecture:** Part 1 adds two operational scripts (`release-books`, `check-live`) and a launch checklist, then a user-run go-live task. Part 2 replaces the visual system: tokens and fonts from `65f7044`, the surface system (cards, plates, pills, reveal), and motion primitives (`Morph` shared-element transitions via React `ViewTransition`, `Book3D` covers, `flyToBag`). Part 3 rebuilds each surface (header, cards, home, product, listing, account pages) on those primitives, then deletes the Akshara leftovers and extends the browser checks. Server logic is unchanged except one read-only query (`categoryCovers`).

**Tech Stack:** Next.js 16.4 App Router (React 19.3 canary bundled, includes `ViewTransition`), TypeScript, Tailwind v4 (CSS-first `@theme`), `motion` 14, `lucide-react`, PGlite for offline DB tests, Playwright for browser checks, `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`.

**Spec:** `docs/superpowers/specs/2026-10-15-inventayu-theme-rebuild-design.md`

## Global Constraints

- The governing rule, every page: "Text minimalization and visual component richness, transitions and animations that make content engaging and let the user experience the sync. Richer, not just minimal."
- Homepage headings ≤ 6 words; homepage paragraphs ≤ 120 characters; facts as mono chips, not sentences.
- Tokens copied from `65f7044`: Geist and Geist Mono; ground `#fafaf7`, cards `#ffffff`, tint `#efede5`; ink `#0a0e0c`, soft `#4a524f`; lines `#e8e6dd` / `#d6d3c7`; brand `#2f7a4d`, deep `#1f5a3a`, glow `#5bc58a`, gold `#b9852e`; forest `#0b2416`, `#123a24`, line `#1e4d33`, cream `#f4f1e6`; radii 4 / 10 / 18px; container 1400px.
- Nothing from the Crossword, forest-retail or Akshara attempts survives: no yellow header, indigo, ribbons, script letterforms, Bricolage/Mukta/Noto fonts.
- Real covers (`/assets/book1.png`, `/assets/book2.png`) are finished 3D mockups: never draw a spine or page edges on them. Only flat covers (`data:` demo covers and missing covers) get the drawn spine and page edges.
- Each `view-transition-name` must appear at most once per page.
- Motion uses transform and opacity only; everything is off under `prefers-reduced-motion`.
- Icons come from `lucide-react`; no hand-drawn SVG icons.
- No new runtime dependencies other than the two Geist font packages; remove Bricolage, Mukta and Noto packages.
- Claude never writes to the production database; production writes are commands the user runs.
- Avoid `\u` escape sequences in source written through shell heredocs or the Edit tool (this environment rewrites them); use literal characters or `String.fromCharCode`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A real mockup cover receiving the flat-book treatment would draw a book inside a book: `isFlatCover` must be false for `/assets/*.png` and https covers (test in Task 5).
- Browsers without View Transitions (Firefox ESR, offline test runtime) must still navigate and render: `Morph` falls back to plain children (test in Task 5; Firefox pass in Task 13).
- The release script run against the wrong database must refuse before any write, and a placeholder PDF under 1 KB must never be released (tests in Task 1).
- `check-live` against a site with checkout switched off must report a failure and must never create an order (test in Task 2).
- A homepage with zero banners or one banner must show the default/only slide with no autoplay or pause control, and reduced motion must never autoplay (test in Task 9).

---

## Part 1 — Live readiness

### Task 1: Release and status script for books

**Files:**
- Create: `scripts/release-books.mjs`
- Create: `scripts/test-release-books.mjs`
- Modify: `scripts/test-all.mjs` (register the test)

**Interfaces:**
- Produces: `hostMatches(databaseUrl: string, expected: string): boolean`; `bookStatus(sql): Promise<Row[]>`; `releaseBooks(sql, { root: string, reason: string }): Promise<{ slug: string; released: boolean; sha?: string; error?: string }[]>`. `sql` is a tagged-template function returning rows (Neon's `neon()` or the PGlite wrapper). CLI: `node --env-file=<env> scripts/release-books.mjs <expected-host-prefix> [--apply]`; without `--apply` it only prints status.

- [ ] **Step 1: Write the failing test**

`scripts/test-release-books.mjs`:

```js
// Offline: releases only real private files on the confirmed database; refuses placeholders and wrong hosts.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createIsolatedDatabase } from './isolated-db.mjs';
import { bookStatus, hostMatches, releaseBooks } from './release-books.mjs';

assert.equal(hostMatches('postgresql://u:p@ep-fragrant-forest-az04w78m-pooler.example.tech/db', 'ep-fragrant-forest'), true);
assert.equal(hostMatches('postgresql://u:p@ep-live-main.example.tech/db', 'ep-fragrant-forest'), false);
assert.equal(hostMatches('postgresql://u:p@ep-fragrant-forest.example.tech/db', 'ep'), false, 'a short prefix is not a confirmation');
assert.equal(hostMatches('not a url', 'ep-fragrant-forest'), false);

const root = await mkdtemp(path.join(tmpdir(), 'release-books-'));
await mkdir(path.join(root, 'private', 'books'), { recursive: true });
const real = Buffer.alloc(4096, 7);
await writeFile(path.join(root, 'private', 'books', 'real.pdf'), real);
await writeFile(path.join(root, 'private', 'books', 'tiny.pdf'), Buffer.alloc(696, 1));

const { db } = await createIsolatedDatabase();
const sql = async (parts, ...values) => (await db.query(parts.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), values)).rows;
try {
  await db.query(`insert into books(slug,title,price_inr,file_url,file_format) values
    ('real-book','Real',100,'private:real.pdf','PDF'), ('tiny-book','Tiny',100,'private:tiny.pdf','PDF'),
    ('missing-book','Missing',100,'private:gone.pdf','PDF'), ('remote-book','Remote',100,'https://files.example.com/x.pdf','PDF')`);
  const results = await releaseBooks(sql, { root, reason: 'Offline test release' });
  const bySlug = Object.fromEntries(results.map(r => [r.slug, r]));
  assert.equal(bySlug['real-book'].released, true);
  assert.equal(bySlug['real-book'].sha, createHash('sha256').update(real).digest('hex'));
  assert.equal(bySlug['tiny-book'].released, false);
  assert.match(bySlug['tiny-book'].error, /supply the real PDF/);
  assert.equal(bySlug['missing-book'].released, false);
  assert.ok(!('remote-book' in bySlug), 'only private: files are handled');
  const status = Object.fromEntries((await bookStatus(sql)).map(r => [r.slug, r]));
  assert.equal(status['real-book'].release_approved, true);
  assert.equal(status['real-book'].scan_status, 'clean');
  assert.equal(status['tiny-book'].release_approved, false);
  const audit = (await db.query(`select payload from events where type='admin.book.released_file'`)).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].payload.slug, 'real-book');
  assert.equal(audit[0].payload.reason, 'Offline test release');
} finally { await db.close(); }
console.log('Book release: host guard, placeholder refusal, missing files, checksum, release state and audit passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-release-books.mjs`
Expected: FAIL with `Cannot find module` for `release-books.mjs`.

- [ ] **Step 3: Write the implementation**

`scripts/release-books.mjs`:

```js
// Releases first-party books whose files live in private/books: records each file's SHA-256,
// marks the scan clean and the title released, and writes an audit event.
//   node --env-file=<env> scripts/release-books.mjs <expected-db-host-prefix>           status only
//   node --env-file=<env> scripts/release-books.mjs <expected-db-host-prefix> --apply   release
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MIN_BYTES = 1024;

export function hostMatches(databaseUrl, expected) {
  if (typeof expected !== 'string' || expected.length < 6) return false;
  try { return new URL(databaseUrl).hostname.startsWith(expected); } catch { return false; }
}

export async function bookStatus(sql) {
  return await sql`select slug, price_inr, active, release_approved, scan_status, file_url,
    left(coalesce(file_sha256, ''), 12) as sha from books order by sort, slug`;
}

export async function releaseBooks(sql, { root, reason }) {
  const results = [];
  for (const book of await sql`select slug, file_url from books where file_url like 'private:%' order by slug`) {
    const file = book.file_url.slice(8);
    if (!/^[^\\/:]+$/.test(file) || file === '.' || file === '..') { results.push({ slug: book.slug, released: false, error: 'invalid file name' }); continue; }
    let bytes;
    try { bytes = await readFile(path.join(root, 'private', 'books', file)); }
    catch { results.push({ slug: book.slug, released: false, error: `missing private/books/${file}` }); continue; }
    if (bytes.length < MIN_BYTES) { results.push({ slug: book.slug, released: false, error: `${file} is ${bytes.length} bytes; supply the real PDF` }); continue; }
    const sha = createHash('sha256').update(bytes).digest('hex');
    const rows = await sql`with changed as (
      update books set file_sha256=${sha}, scan_status='clean', release_approved=true where slug=${book.slug} returning slug
    ), audit as (insert into events(order_id,type,payload)
      select null,'admin.book.released_file',jsonb_build_object('slug',slug,'file',${file}::text,'file_sha256',${sha}::text,'reason',${reason}::text) from changed)
    select slug from changed`;
    results.push({ slug: book.slug, released: rows.length === 1, sha });
  }
  return results;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [expected] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const url = process.env.DATABASE_URL;
  if (!url || !hostMatches(url, expected)) {
    console.error('Refusing: pass the database host prefix you expect (at least 6 characters) as the first argument; DATABASE_URL does not match it.');
    process.exit(1);
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  if (process.argv.includes('--apply')) {
    for (const r of await releaseBooks(sql, { root: process.cwd(), reason: 'Release of supplied first-party files' }))
      console.log(r.released ? `released ${r.slug} (sha ${r.sha.slice(0, 12)}...)` : `NOT released ${r.slug}: ${r.error ?? 'update matched no row'}`);
  }
  console.table(await bookStatus(sql));
}
```

Register it in `scripts/test-all.mjs`: add `'scripts/test-release-books.mjs'` to the `checks` array after `'scripts/test-recovery.mjs'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx scripts/test-release-books.mjs`
Expected: PASS, printing `Book release: host guard, placeholder refusal, ...`. If the update is rejected by a publishing trigger for first-party rows, stop and report the trigger message rather than weakening the trigger.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test` — Expected: `All offline regression suites passed.`

```bash
git add scripts/release-books.mjs scripts/test-release-books.mjs scripts/test-all.mjs
git commit -m "Add a guarded release-and-status script for first-party book files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Live check script and launch checklist

**Files:**
- Create: `scripts/check-live.mjs`
- Create: `scripts/test-check-live.mjs`
- Create: `docs/LAUNCH_CHECKLIST.md`
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces: `runLiveChecks(base: string, fetchImpl?: typeof fetch): Promise<{ failures: string[]; passed: string[] }>`. CLI: `node scripts/check-live.mjs https://<site>` exits 1 when any failure.

- [ ] **Step 1: Write the failing test**

`scripts/test-check-live.mjs`:

```js
// Offline: the live check reports misconfiguration and never creates an order.
import assert from 'node:assert/strict';
import { runLiveChecks } from './check-live.mjs';

const BASE = 'https://shop.example.com';
function site({ checkout = 400, token = true, buy = true } = {}) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname + url.search, method: init.method ?? 'GET', body: init.body, headers: init.headers ?? {} });
    const html = (body) => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    if (url.pathname === '/api/checkout') return Response.json({ error: 'x' }, { status: checkout });
    if (url.pathname === '/api/search/suggest') return Response.json({ books: [{ slug: 'real-book' }], authors: [], categories: [] });
    if (url.pathname === '/admin/login') return html(token ? '<label>Admin token</label>' : '<a>Sign in with email</a>');
    if (url.pathname === '/') return html('<a href="/books/real-book">Real</a>');
    if (url.pathname === '/books/real-book') return html(buy ? '<p>₹1</p><button>Buy now</button>' : '<button>Unavailable</button>');
    return html('<main>ok</main>');
  };
  return { fetchImpl, calls };
}

const healthy = site();
const ok = await runLiveChecks(BASE, healthy.fetchImpl);
assert.deepEqual(ok.failures, []);
const checkoutCall = healthy.calls.find(c => c.path === '/api/checkout');
assert.equal(checkoutCall.method, 'POST');
assert.equal(checkoutCall.body, '{}', 'no slugs, no customer details');
assert.ok(!Object.keys(checkoutCall.headers).some(h => h.toLowerCase() === 'idempotency-key'), 'never sends an idempotency key, so no order can be created');

const broken = await runLiveChecks(BASE, site({ checkout: 503, token: false, buy: false }).fetchImpl);
assert.ok(broken.failures.some(f => /Checkout is switched off/.test(f)));
assert.ok(broken.failures.some(f => /ADMIN_TOKEN/.test(f)));
assert.ok(broken.failures.some(f => /no price or Buy now/.test(f)));
console.log('Live check: healthy site passes; checkout off, missing admin token and unsellable books are reported; no order is ever created.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-check-live.mjs`
Expected: FAIL with `Cannot find module` for `check-live.mjs`.

- [ ] **Step 3: Write the implementation**

`scripts/check-live.mjs`:

```js
// Read-only check of a deployed store. Never creates orders: the checkout probe sends an empty body
// without an idempotency key, which the route rejects (400) only after its configuration check passes.
//   node scripts/check-live.mjs https://<site>
import { pathToFileURL } from 'node:url';

const PAGES = ['/', '/search', '/cart', '/wishlist', '/login', '/publish', '/privacy', '/terms', '/refund-policy', '/delivery-policy'];

export async function runLiveChecks(base, fetchImpl = fetch) {
  const failures = [], passed = [];
  const origin = new URL(base).origin;
  const get = (p) => fetchImpl(new URL(p, origin), { redirect: 'manual' });
  for (const p of PAGES) {
    const r = await get(p);
    (r.status === 200 ? passed : failures).push(`${p} returned ${r.status}`);
  }
  const suggest = await get('/api/search/suggest?q=ay');
  const found = suggest.ok ? (await suggest.json()).books?.length ?? 0 : 0;
  (found > 0 ? passed : failures).push(found > 0 ? 'search suggestions return books' : `search suggestions returned no books (status ${suggest.status})`);
  const home = await (await get('/')).text();
  const slug = home.match(/href="\/books\/([a-z0-9][a-z0-9_-]*)"/)?.[1];
  if (!slug) failures.push('homepage links to no book page');
  else {
    const page = await (await get(`/books/${slug}`)).text();
    (/₹\d/.test(page) && /Buy now/.test(page) ? passed : failures)
      .push(/₹\d/.test(page) && /Buy now/.test(page) ? `/books/${slug} shows a price and Buy now` : `/books/${slug} has no price or Buy now (book not released or checkout off)`);
  }
  const admin = await (await get('/admin/login')).text();
  (/Admin token/.test(admin) ? passed : failures).push(/Admin token/.test(admin) ? 'admin token sign-in is available' : 'admin login has no token form: set ADMIN_TOKEN in Vercel');
  const probe = await fetchImpl(new URL('/api/checkout', origin), { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
  if (probe.status === 400) passed.push('checkout configuration is complete');
  else if (probe.status === 503) failures.push('Checkout is switched off or its configuration is incomplete (see docs/LAUNCH_CHECKLIST.md)');
  else failures.push(`checkout probe returned ${probe.status}`);
  return { failures, passed };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const base = process.argv[2];
  if (!base || !/^https:\/\//.test(base)) { console.error('Usage: node scripts/check-live.mjs https://<site>'); process.exit(1); }
  const { failures, passed } = await runLiveChecks(base);
  for (const p of passed) console.log(`PASS ${p}`);
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(failures.length ? 1 : 0);
}
```

`docs/LAUNCH_CHECKLIST.md`:

```markdown
# Launch checklist

Run in order. Claude never writes to the production database; the commands marked "you run" are yours.

## 1. Back up and migrate the live database (you run)
1. Neon console → the production project → Branches → create a branch from `main` named `backup-YYYY-MM-DD`.
2. With the production connection string in a local file `.env.production.local` (never committed):
   `node --env-file=.env.production.local scripts/migrate.mjs --apply`
3. Status (read-only): `node --env-file=.env.production.local scripts/release-books.mjs <production-host-prefix>`

## 2. Release the books (you run)
1. Put the real "Researching Research for Ayurveda" PDF at `private/books/` and point its `file_url` at it
   (`private:<file name>`). The script refuses files under 1 KB.
2. `node --env-file=.env.production.local scripts/release-books.mjs <production-host-prefix> --apply`

## 3. Vercel environment (Production)
| Variable | Value |
|---|---|
| DATABASE_URL | production Neon connection string |
| AUTH_SECRET | `openssl rand -hex 32` |
| DOWNLOAD_SECRET | `openssl rand -hex 32` |
| CRON_SECRET | `openssl rand -hex 24` |
| ADMIN_TOKEN | `openssl rand -hex 24` (opens /admin without email) |
| ADMIN_EMAIL | the admin's email |
| COMMERCE_ENABLED | `true` |
| COMMERCE_POLICIES_APPROVED | `true` once seller, tax and refund terms are signed off |
| LEGAL_ENTITY_NAME | registered seller name |
| LEGAL_ENTITY_ADDRESS | registered address |
| SUPPORT_EMAIL | support address |
| NEXT_PUBLIC_SITE_URL | `https://<your domain>` |
| RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET | test keys until KYC clears |
| RESEND_API_KEY / MAIL_FROM | e.g. `Reading Room <books@books.inventayu.com>` |
Redeploy after changing variables.

## 4. Email
Resend → Domains → add `books.inventayu.com` → add the shown DNS records at the domain host → wait for "Verified".

## 5. Razorpay
Dashboard → Webhooks → `https://<your domain>/api/webhook`, secret = RAZORPAY_WEBHOOK_SECRET, events `payment_link.paid`, `payment.captured`, `refund.processed`.

## 6. Verify
1. `node scripts/check-live.mjs https://<your domain>` — every line PASS.
2. Buy one book at ₹1 in Razorpay test mode; confirm the order page, the download and the receipt email.
```

Register `'scripts/test-check-live.mjs'` in `scripts/test-all.mjs` after `'scripts/test-release-books.mjs'`.

- [ ] **Step 4: Run tests**

Run: `node scripts/test-check-live.mjs` then `npm test`
Expected: PASS; `All offline regression suites passed.`

- [ ] **Step 5: Commit**

```bash
git add scripts/check-live.mjs scripts/test-check-live.mjs scripts/test-all.mjs docs/LAUNCH_CHECKLIST.md
git commit -m "Add a read-only live check and the launch checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Go live with the user (runs alongside Part 2)

**Files:** none (operational). Claude only runs read-only commands.

- [ ] **Step 1: Re-check the dev branch.** Ask the user to run `node --env-file=.env.local scripts/release-books.mjs ep-fragrant-forest` and paste the table. Expected: both titles listed with their current state. If they want the dev branch released: `... ep-fragrant-forest --apply`; "Researching Research" stays unreleased until its real PDF replaces `sample.pdf` (the script refuses the 696-byte placeholder).
- [ ] **Step 2: User completes `docs/LAUNCH_CHECKLIST.md` sections 1–5.** Do not block Part 2 on this; continue with Task 4 and return here when the user reports progress.
- [ ] **Step 3: Verify.** Run `node scripts/check-live.mjs https://inventayu-books.vercel.app` (or the custom domain). Expected: every line `PASS`. Report any `FAIL` line with the checklist section that fixes it.
- [ ] **Step 4: ₹1 test-mode purchase.** User buys one title; Claude confirms read-only: the order page shows "fulfilled", the download link returns a PDF, and the receipt email arrived (user confirms the inbox).

---

## Part 2 — Theme and motion foundation

### Task 4: Tokens and fonts from `65f7044`

**Files:**
- Modify (rewrite): `src/styles/tokens.css`
- Modify: `src/app/globals.css` (the `@theme` block only)
- Modify: `src/app/layout.tsx` (font imports)
- Modify: `package.json` / `package-lock.json` (via npm)
- Modify: `src/components/reading-room.test.cjs:33-38`
- Modify: `scripts/check-browser.mjs:36-37` (font assertion)

**Interfaces:**
- Produces CSS custom properties used by every later task: `--bg --bg-2 --bg-3 --ink --ink-2 --ink-soft --ink-mute --line --line-2 --brand --brand-deep --brand-glow --gold --danger --forest --forest-2 --forest-line --cream --font-sans --font-mono --radius-1 --radius-2 --radius-3 --container --ease-out --shadow-e1..e4`; classes `.wrap .section .eyebrow .section-head .section-actions .btn .btn-primary .btn-ghost .btn-outline .btn-dark .btn-light .round-btn .chip .pill-offer .link-line .text-link .field-label .field-input .skip-link .sr-only`. Transitional aliases (`--neel`, `--kumkum`, `--paper`, `--mist`, `--muted`, `--page`, `--card`, `--font-head`, `--font-body`, etc.) keep not-yet-rewritten styles working; Task 13 deletes them.

- [ ] **Step 1: Update the tests first**

In `src/components/reading-room.test.cjs`, replace lines 33–38 (the layout/tokens assertions) with:

```js
const layoutSource = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert.match(layoutSource, /@fontsource-variable\/geist"/);
assert.match(layoutSource, /@fontsource-variable\/geist-mono"/);
assert.doesNotMatch(layoutSource, /bricolage|mukta|fraunces|manrope/i);
const tokens = fs.readFileSync(path.join(root, "styles/tokens.css"), "utf8");
for (const token of ["--bg-2: #fafaf7", "--brand: #2f7a4d", "--gold: #b9852e", "--forest: #0b2416", "--ink: #0a0e0c", "--cream: #f4f1e6"]) assert.ok(tokens.includes(token), token);
assert.doesNotMatch(fs.readFileSync(path.join(root, "app/globals.css"), "utf8"), /Fraunces|Manrope|Bricolage|Mukta/);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL on the `@fontsource-variable/geist` assertion.

- [ ] **Step 3: Swap the font packages**

Run: `npm install @fontsource-variable/geist @fontsource-variable/geist-mono && npm uninstall @fontsource-variable/bricolage-grotesque @fontsource/mukta`
Expected: both installs succeed. (If either Geist package is unavailable, stop and report; the fallback is the Google Fonts `<link>` that `65f7044` used, which needs approval because it adds a network dependency.)

In `src/app/layout.tsx` replace the five lines importing `@fontsource-variable/bricolage-grotesque/standard.css` and `@fontsource/mukta/{400,500,600,700}.css` with:

```tsx
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
```

Leave the Noto imports until Task 13.

- [ ] **Step 4: Rewrite `src/styles/tokens.css`**

```css
/* INVENTAYU theme, taken from the 65f7044 storefront: warm off-white ground, emerald and gold,
   Geist for text and Geist Mono for labels and data. */
:root {
  --bg: #ffffff; --bg-2: #fafaf7; --bg-3: #efede5;
  --ink: #0a0e0c; --ink-2: #1b201e; --ink-soft: #4a524f; --ink-mute: #3f4743;
  --line: #e8e6dd; --line-2: #d6d3c7;
  --brand: #2f7a4d; --brand-deep: #1f5a3a; --brand-glow: #5bc58a; --gold: #b9852e; --danger: #b3261e;
  --forest: #0b2416; --forest-2: #123a24; --forest-line: #1e4d33; --cream: #f4f1e6;
  --font-sans: "Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", "Geist Mono", ui-monospace, "SFMono-Regular", monospace;
  --radius-1: 4px; --radius-2: 10px; --radius-3: 18px; --container: 1400px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --shadow-e1: 0 1px 2px rgb(12 38 24 / 0.05), 0 1px 3px rgb(12 38 24 / 0.04);
  --shadow-e2: 0 2px 4px rgb(12 38 24 / 0.04), 0 8px 16px -6px rgb(12 38 24 / 0.10);
  --shadow-e3: 0 4px 8px rgb(12 38 24 / 0.05), 0 18px 32px -12px rgb(12 38 24 / 0.16);
  --shadow-e4: 0 8px 16px rgb(12 38 24 / 0.06), 0 34px 60px -20px rgb(12 38 24 / 0.22);
  /* Transitional aliases for styles not yet rewritten; Task 13 removes this block. */
  --paper: var(--bg); --mist: var(--bg-2); --mist-2: var(--bg-3); --neel: var(--brand); --neel-deep: var(--brand-deep); --neel-tint: #e6f2ea;
  --muted: var(--ink-soft); --kumkum: var(--gold); --kumkum-tint: #f6ecd9; --offer: var(--gold); --offer-bg: #f6ecd9; --sale: var(--gold);
  --page: var(--bg-2); --card: var(--bg); --radius-card: 18px; --radius-btn: 12px; --shadow-lift: var(--shadow-e3); --ease: var(--ease-out);
  --font-head: var(--font-sans); --font-body: var(--font-sans);
}
@layer base {
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--bg-2); color: var(--ink); font: 400 17px/1.55 var(--font-sans); font-feature-settings: "ss01", "cv11"; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; overflow-x: clip; }
  h1, h2, h3, h4 { margin: 0; font-family: var(--font-sans); font-weight: 500; letter-spacing: -0.035em; line-height: 1.05; overflow-wrap: anywhere; }
  p, figure, dl, dd { margin: 0; }
  a { color: inherit; text-decoration: none; }
  ul, ol { margin: 0; padding: 0; list-style: none; }
  button, input, select, textarea { font: inherit; color: inherit; }
  button { cursor: pointer; }
  img { max-width: 100%; display: block; }
  ::selection { background: #d9ecc0; color: var(--forest); }
  :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 4px; }
}
@layer components {
  .wrap { width: 100%; max-width: var(--container); margin-inline: auto; padding-inline: 20px; }
  @media (min-width: 721px) { .wrap { padding-inline: 32px; } }
  .section { padding-block: 44px; }
  @media (min-width: 1024px) { .section { padding-block: 72px; } }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .eyebrow { font: 500 11px/1.5 var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute); }
  .section-head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 14px 24px; margin-bottom: 26px; }
  .section-head h2 { font-size: clamp(28px, 3.2vw, 44px); letter-spacing: -0.04em; line-height: 1; }
  .section-head p { margin-top: 8px; color: var(--ink-soft); font-size: 15px; }
  .section-actions { display: flex; align-items: center; gap: 8px; }
  .btn { position: relative; overflow: hidden; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 13px 24px; border: 1px solid transparent; border-radius: 12px; font: 500 15px/1.2 var(--font-sans); transition: transform .28s var(--ease-out), box-shadow .28s var(--ease-out), background .28s var(--ease-out), border-color .28s; }
  .btn [aria-hidden="true"]:last-child { transition: transform .3s var(--ease-out); }
  .btn:hover [aria-hidden="true"]:last-child { transform: translateX(3px); }
  .btn:active { transform: translateY(1px) scale(.99); }
  .btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .btn-primary, .btn-neel { color: #fff; background: linear-gradient(175deg, #37905b 0%, var(--brand) 55%, #276542 100%); box-shadow: var(--shadow-e2), inset 0 1px 0 rgb(255 255 255 / .16); }
  .btn-primary:hover:not(:disabled), .btn-neel:hover:not(:disabled) { background: linear-gradient(175deg, #3d9c63 0%, #2c724a 55%, #21583a 100%); box-shadow: var(--shadow-e3), inset 0 1px 0 rgb(255 255 255 / .2); }
  .btn-ghost, .btn-outline { background: var(--bg); border-color: var(--line-2); color: var(--ink); box-shadow: var(--shadow-e1); }
  .btn-ghost:hover:not(:disabled), .btn-outline:hover:not(:disabled) { border-color: var(--ink-soft); box-shadow: var(--shadow-e2); }
  .btn-dark { background: var(--forest); color: var(--cream); box-shadow: var(--shadow-e2); }
  .btn-dark:hover:not(:disabled) { background: var(--forest-2); }
  .btn-light { background: var(--cream); color: var(--forest); }
  .btn-light:hover:not(:disabled) { background: #fff; }
  .round-btn { display: inline-grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--ink); box-shadow: var(--shadow-e1); transition: box-shadow .25s, border-color .25s, transform .25s var(--ease-out); }
  .round-btn:hover:not(:disabled) { box-shadow: var(--shadow-e2); transform: translateY(-1px); }
  .round-btn:disabled { opacity: .35; cursor: default; }
  .chip { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); font: 500 11px/1 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); transition: border-color .2s, color .2s, background .2s; }
  a.chip:hover { border-color: var(--ink-soft); color: var(--ink); }
  .chip[aria-current] { background: var(--forest); border-color: var(--forest); color: var(--cream); }
  .pill-offer { display: inline-flex; padding: 3px 9px; border-radius: 999px; background: #f6ecd9; color: #7a5a1e; font: 500 11px/1.4 var(--font-mono); letter-spacing: .04em; white-space: nowrap; }
  .text-offer { color: var(--gold); }
  .link-line, .text-link { display: inline-flex; align-items: center; gap: 8px; padding-bottom: 2px; border-bottom: 1px solid currentColor; font: 500 12px/1.4 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--brand); transition: color .2s; }
  .link-line:hover, .text-link:hover { color: var(--brand-deep); }
  .field-label { display: block; margin-bottom: 8px; font: 500 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); }
  .field-input { width: 100%; min-height: 48px; padding: 12px 16px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--bg); color: var(--ink); font-size: 16px; transition: border-color .2s, box-shadow .2s; }
  .field-input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgb(47 122 77 / .12); }
  .field-input[aria-invalid="true"] { border-color: var(--danger); }
  .skip-link { position: fixed; top: -100px; left: 16px; z-index: 100; padding: 12px 18px; border-radius: 12px; background: var(--forest); color: var(--cream); }
  .skip-link:focus { top: 12px; }
  /* Transitional: the Akshara letterforms are retired; Task 13 deletes the markup and this rule. */
  .akshara { display: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
```

In `src/app/globals.css` replace the whole `@theme { ... }` block (the one commented "mapped onto the Akshara palette") with:

```css
/* Tailwind utilities used by admin and account pages, mapped onto the INVENTAYU palette. */
@theme {
  --color-bg: #ffffff; --color-bg-2: #fafaf7; --color-bg-3: #efede5;
  --color-ink: #0a0e0c; --color-ink-2: #1b201e; --color-ink-soft: #4a524f; --color-ink-mute: #3f4743;
  --color-line: #e8e6dd; --color-line-2: #d6d3c7;
  --color-brand: #2f7a4d; --color-brand-deep: #1f5a3a; --color-brand-glow: #5bc58a;
  --color-gold: #b9852e; --color-danger: #b3261e;
  --color-forest: #0b2416; --color-forest-2: #123a24; --color-forest-line: #1e4d33; --color-cream: #f4f1e6;
  --font-sans: "Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", "Geist Mono", ui-monospace, monospace;
  --radius-1: 4px; --radius-2: 10px; --radius-3: 18px;
}
```

In `scripts/check-browser.mjs` replace the font assertion line (currently checking Bricolage and Mukta) with:

```js
          assert.ok(await page.evaluate(() => document.fonts.check('500 32px "Geist Variable"') && document.fonts.check('500 12px "Geist Mono Variable"')), `${name}: local fonts loaded`);
```

- [ ] **Step 5: Run tests**

Run: `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/app/globals.css src/app/layout.tsx package.json package-lock.json src/components/reading-room.test.cjs scripts/check-browser.mjs
git commit -m "Restore the 65f7044 INVENTAYU tokens and Geist type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Surface system, reveal and motion primitives

**Files:**
- Create: `src/styles/surface.css`, `src/styles/motion.css`
- Create: `src/components/motion/Reveal.tsx`, `src/components/motion/Morph.tsx`, `src/components/motion/Book3D.tsx`, `src/components/motion/fly.ts`
- Modify: `src/components/reading-room.test.cjs` (motion assertions; its loader handles `.tsx` and path resolution)
- Modify: `src/app/globals.css` (imports), `src/app/layout.tsx` (js class + Reveal)

**Interfaces:**
- Produces CSS classes: `.field .fade-rule .surface .surface-hover .surface-lit .plate .cover-img .cover-lift .pill .dot .grad .enter .reveal .reveal.in .catalogue .book3d .book3d.flat .cover-fallback`.
- Produces `Reveal(): null` (client; marks `.reveal` elements `.in` when visible, including ones added after navigation).
- Produces `Morph({ name: string; children: ReactNode })` and `morphName(slug: string): string` (returns `cover-<slug>`).
- Produces `Book3D({ src: string | null; title: string; sizes: string; priority?: boolean; tilt?: boolean })` and `isFlatCover(src: string | null): boolean`.
- Produces `flightKeyframes(from: Box, to: Box): Keyframe[]` and `flyToBag(source: Element | null | undefined): void` where `Box = { left: number; top: number; width: number; height: number }`. `flyToBag` animates the source's first `<img>` to the element with id `bag-target` (Task 7 adds that id).

- [ ] **Step 1: Write the failing test** — append at module scope of `src/components/reading-room.test.cjs`, after the token assertions (its `load()` transpiles `.tsx` and resolves relative imports):

```js
// Motion primitives degrade safely and never draw a book inside a mockup.
const { isFlatCover } = load("components/motion/Book3D.tsx", { "motion/react": { ...require("motion/react"), useReducedMotion: () => true } });
assert.equal(isFlatCover("/assets/book1.png"), false, "real covers are finished mockups");
assert.equal(isFlatCover("https://cdn.example.com/cover.jpg"), false);
assert.equal(isFlatCover("data:image/svg+xml;utf8,%3Csvg%3E"), true);
assert.equal(isFlatCover(null), true);
const MorphModule = load("components/motion/Morph.tsx");
assert.equal(MorphModule.morphName("real-book"), "cover-real-book");
const morphed = renderToStaticMarkup(React.createElement(MorphModule.default, { name: "cover-x" }, React.createElement("img", { alt: "x", src: "/x.png" })));
assert.match(morphed, /<img alt="x" src="\/x.png"/, "without ViewTransition the children render unchanged");
const { flightKeyframes, flyToBag } = load("components/motion/fly.ts");
const frames = flightKeyframes({ left: 0, top: 500, width: 100, height: 150 }, { left: 900, top: 10, width: 20, height: 20 });
assert.equal(frames.length, 3);
assert.equal(frames[0].transform, "translate(0px, 0px) scale(1)");
assert.equal(frames[2].transform, "translate(860px, -555px) scale(0.2)");
assert.match(flightKeyframes({ left: 0, top: 0, width: 1000, height: 1000 }, { left: 0, top: 0, width: 1, height: 1 })[2].transform, /scale\(0\.08\)/, "scale is clamped");
assert.doesNotThrow(() => flyToBag(null));
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL (`ENOENT` for `components/motion/Book3D.tsx`).

- [ ] **Step 3: Write the primitives**

`src/components/motion/Morph.tsx`:

```tsx
import * as React from "react";

type ViewTransitionProps = { name: string; share?: string; default?: string; children: React.ReactNode };
// React's ViewTransition ships with the App Router's bundled React; tests and older runtimes fall back to plain children.
const ViewTransition = (React as unknown as { ViewTransition?: React.ComponentType<ViewTransitionProps> }).ViewTransition;

export const morphName = (slug: string) => `cover-${slug.replace(/[^a-z0-9-]/gi, "-")}`;

// One cover, two pages: the card cover glides into the product page cover and back.
export default function Morph({ name, children }: { name: string; children: React.ReactNode }) {
  return ViewTransition ? <ViewTransition name={name} share="morph" default="none">{children}</ViewTransition> : <>{children}</>;
}
```

`src/components/motion/Book3D.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import Cover from "../Cover";

// Supplied covers are finished 3D mockups; only flat artwork gets a drawn spine and page edges.
export const isFlatCover = (src: string | null) => !src || src.startsWith("data:");

export default function Book3D({ src, title, sizes, priority, tilt = true }: { src: string | null; title: string; sizes: string; priority?: boolean; tilt?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const set = (rx: number, ry: number) => { ref.current?.style.setProperty("--rx", `${rx}deg`); ref.current?.style.setProperty("--ry", `${ry}deg`); };
  return <span ref={ref} className={`book3d${isFlatCover(src) ? " flat" : ""}`}
    onPointerMove={(e) => {
      if (reduced || !tilt || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      set(((e.clientY - r.top) / r.height - 0.5) * -10, ((e.clientX - r.left) / r.width - 0.5) * 14);
    }}
    onPointerLeave={() => set(0, 0)}>
    <span className="book3d-body"><Cover src={src} title={title} sizes={sizes} priority={priority} /></span>
    <span className="book3d-shadow" aria-hidden="true" />
  </span>;
}
```

`src/components/motion/fly.ts`:

```ts
export type Box = { left: number; top: number; width: number; height: number };

export function flightKeyframes(from: Box, to: Box): Keyframe[] {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.round(Math.max(0.08, Math.min(1, to.width / Math.max(from.width, 1))) * 100) / 100;
  return [
    { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
    { transform: `translate(${Math.round(dx * 0.55)}px, ${Math.round(dy * 0.35 - 80)}px) scale(${Math.round(((1 + scale) / 2) * 100) / 100})`, opacity: 0.95, offset: 0.55 },
    { transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${scale})`, opacity: 0.25 },
  ];
}

// The cover the reader chose flies into the bag; the bag pulses as it lands.
export function flyToBag(source: Element | null | undefined) {
  if (typeof window === "undefined" || !source) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = document.getElementById("bag-target");
  const img = source.querySelector("img");
  if (!target || !img || typeof img.animate !== "function") return;
  const from = img.getBoundingClientRect();
  const ghost = img.cloneNode() as HTMLImageElement;
  ghost.src = img.currentSrc || img.src;
  ghost.removeAttribute("srcset");
  ghost.removeAttribute("sizes");
  Object.assign(ghost.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    margin: "0", zIndex: "80", pointerEvents: "none", objectFit: "contain" });
  ghost.setAttribute("aria-hidden", "true");
  ghost.alt = "";
  document.body.appendChild(ghost);
  ghost.animate(flightKeyframes(from, target.getBoundingClientRect()), { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)" })
    .finished.catch(() => {}).finally(() => ghost.remove());
  target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 320, delay: 560 });
}
```

`src/components/motion/Reveal.tsx`:

```tsx
"use client";

import { useEffect } from "react";

// Reveals .reveal elements once as they scroll in, staggering siblings; also watches content added later
// (client navigations, filter changes), so nothing stays hidden.
export default function Reveal() {
  useEffect(() => {
    const stagger = (el: HTMLElement) => {
      if (el.style.getPropertyValue("--i") || !el.parentElement) return;
      const index = [...el.parentElement.children].filter((c) => c.classList.contains("reveal")).indexOf(el);
      el.style.setProperty("--i", String(Math.min(Math.max(index, 0), 4)));
    };
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    const watch = (root: ParentNode) => root.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => { stagger(el); io.observe(el); });
    watch(document);
    const mo = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(".reveal:not(.in)")) { stagger(node); io.observe(node); }
        watch(node);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
```

`src/styles/surface.css`:

```css
/* Surface system from 65f7044: one easing curve, one shadow ladder, one radius ladder. */
@layer components {
  .field { position: relative; isolation: isolate; background:
    radial-gradient(120% 80% at 12% 0%, rgb(47 122 77 / 0.10) 0%, transparent 55%),
    radial-gradient(90% 70% at 92% 8%, rgb(185 133 46 / 0.10) 0%, transparent 52%),
    linear-gradient(180deg, #ffffff 0%, var(--bg-2) 76%); }
  .fade-rule { height: 1px; border: 0; background: linear-gradient(90deg, var(--line-2) 0%, var(--line) 45%, transparent 100%); }
  .surface { background: var(--bg); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow-e2);
    transition: box-shadow .45s var(--ease-out), transform .45s var(--ease-out), border-color .45s var(--ease-out); }
  .surface-hover:hover { transform: translateY(-3px); box-shadow: var(--shadow-e4); border-color: var(--line-2); }
  .surface-lit { position: relative; overflow: hidden; }
  .surface-lit::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 1px; z-index: 1;
    background: linear-gradient(90deg, transparent, rgb(47 122 77 / 0.45) 22%, rgb(185 133 46 / 0.40) 68%, transparent); }
  .plate { border-radius: 16px; background: radial-gradient(80% 60% at 50% 15%, rgb(255 255 255 / 0.9), transparent 70%),
    linear-gradient(160deg, var(--bg-3) 0%, var(--bg-2) 100%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7); }
  .pill { display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg);
    box-shadow: var(--shadow-e1); font: 500 11px/1 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 999px; background: var(--brand-glow); animation: dot-pulse 2s infinite; }
  .grad { background: linear-gradient(115deg, var(--brand) 0%, var(--brand-deep) 40%, var(--gold) 70%, var(--brand) 100%); background-size: 220% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent; animation: shimmer 1.8s var(--ease-out) .3s 1 backwards; }
  .enter > * { animation: rise .8s var(--ease-out) backwards; }
  .enter > *:nth-child(1) { animation-delay: .04s; } .enter > *:nth-child(2) { animation-delay: .12s; }
  .enter > *:nth-child(3) { animation-delay: .20s; } .enter > *:nth-child(4) { animation-delay: .28s; } .enter > *:nth-child(5) { animation-delay: .36s; }
  .js .reveal { opacity: 0; transform: translateY(20px); transition: opacity .75s var(--ease-out), transform .75s var(--ease-out); transition-delay: calc(var(--i, 0) * 80ms); }
  .js .reveal.in { opacity: 1; transform: none; }
  .catalogue { width: 100%; border-collapse: collapse; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--line-2); }
  .catalogue th, .catalogue td { padding: 9px 0; border-bottom: 1px dotted var(--line-2); font: 400 12px/1.5 var(--font-mono); letter-spacing: .02em; text-align: left; vertical-align: baseline; }
  .catalogue tr:last-child th, .catalogue tr:last-child td { border-bottom: 0; }
  .catalogue th { width: 40%; padding-right: 12px; font-weight: 500; text-transform: uppercase; color: var(--ink-mute); white-space: nowrap; }
  @keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
  @keyframes dot-pulse { 0% { box-shadow: 0 0 0 0 rgb(91 197 138 / .55); } 70% { box-shadow: 0 0 0 8px rgb(91 197 138 / 0); } 100% { box-shadow: 0 0 0 0 rgb(91 197 138 / 0); } }
}
@media (prefers-reduced-motion: reduce) {
  .enter > *, .dot, .grad { animation: none; }
  .js .reveal { opacity: 1; transform: none; transition: none; }
  .surface-hover:hover { transform: none; }
}
```

`src/styles/motion.css`:

```css
@layer components {
  .book3d { position: relative; display: block; perspective: 900px; --rx: 0deg; --ry: 0deg; }
  .book3d-body { position: relative; z-index: 1; display: block; transform: rotateX(var(--rx)) rotateY(var(--ry)); transform-style: preserve-3d; transition: transform .5s var(--ease-out); }
  .book3d-body img { display: block; width: 100%; height: auto; }
  .book3d:not(.flat) .book3d-body img { filter: drop-shadow(0 14px 22px rgb(12 38 24 / .2)); transition: filter .5s var(--ease-out); }
  .book3d:not(.flat):hover .book3d-body img { filter: drop-shadow(0 22px 34px rgb(12 38 24 / .28)); }
  .book3d.flat .book3d-body { border-radius: 3px; box-shadow: 0 18px 30px -16px rgb(12 38 24 / .45); }
  .book3d.flat .book3d-body img, .book3d.flat .cover-fallback { border-radius: 3px; }
  .book3d.flat .book3d-body::before { content: ""; position: absolute; inset: 0 auto 0 0; z-index: 2; width: 7%; border-radius: 3px 0 0 3px; pointer-events: none;
    background: linear-gradient(90deg, rgb(0 0 0 / .28), rgb(255 255 255 / .14) 55%, transparent); }
  .book3d.flat .book3d-body::after { content: ""; position: absolute; top: 2%; bottom: 2%; right: -5px; width: 6px; border-radius: 0 2px 2px 0;
    background: repeating-linear-gradient(180deg, var(--cream) 0 1px, #e3ddc9 1px 2px); transform: translateZ(-1px); }
  .book3d-shadow { position: absolute; left: 12%; right: 12%; bottom: -8px; height: 14px; border-radius: 50%; filter: blur(4px);
    background: radial-gradient(closest-side, rgb(12 38 24 / .28), transparent); transition: transform .5s var(--ease-out), opacity .5s; }
  .book3d:hover .book3d-shadow { transform: scaleX(.86); opacity: .75; }
  .cover-fallback { display: grid; place-items: center; aspect-ratio: 2 / 3; padding: 16px; background: linear-gradient(160deg, var(--forest-2), var(--forest));
    color: var(--cream); font-weight: 500; text-align: center; letter-spacing: -.01em; }
}
::view-transition-group(.morph) { animation-duration: 450ms; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
::view-transition-image-pair(.morph) { animation-name: via-blur; }
@keyframes via-blur { 30% { filter: blur(2px); } }
@media (prefers-reduced-motion: reduce) {
  .book3d-body, .book3d-shadow, .book3d-body img { transition: none; transform: none !important; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

In `src/app/globals.css`, after `@import "../styles/tokens.css";` add:

```css
@import "../styles/surface.css";
@import "../styles/motion.css";
```

In `src/app/layout.tsx`: import `Reveal from "@/components/motion/Reveal"`; inside `<html>` before `<body>` add a head script that marks JavaScript as available before paint, and mount `<Reveal />` inside the providers:

```tsx
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} /></head>
    <body><CartProvider><WishlistProvider signedIn={!!reader}>
    <a href="#main" className="skip-link" tabIndex={0}>Skip to content</a>
    <StoreHeader name={STORE.name} nav={nav} announcement={announcement} />
    <main id="main" tabIndex={-1}>{children}</main>
    <CartDrawer />
    <Reveal />
    <SiteFooter name={STORE.name} categories={categories} />
  </WishlistProvider></CartProvider></body></html>;
```

(The script string is a constant with no user data; `.reveal` content stays visible when JavaScript is off because the hiding rule is scoped to `.js`; `suppressHydrationWarning` covers the class the script adds before hydration.)

- [ ] **Step 4: Run tests**

Run: `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles/surface.css src/styles/motion.css src/components/motion src/components/reading-room.test.cjs src/app/globals.css src/app/layout.tsx
git commit -m "Add the surface system, scroll reveal, shared-element morph, 3D covers and fly-to-bag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Demo covers in the theme palette

**Files:**
- Modify: `scripts/demo-catalogue.mjs:30-53` (`COVER_COLOURS`, `COVER_SHAPES`, `demoCover`)
- Create: `scripts/test-demo-covers.mjs`
- Modify: `scripts/test-all.mjs` (register it after `'scripts/test-check-live.mjs'`)

**Interfaces:**
- Consumes: nothing new. Produces: `demoCover(title, author, seed)` returning a `data:` SVG URI that uses only theme colours.

- [ ] **Step 1: Write the failing check** — `scripts/test-demo-covers.mjs`:

```js
// Offline: preview demo covers use only the theme palette.
import assert from 'node:assert/strict';
import { demoCover } from './demo-catalogue.mjs';
const PALETTE = ['#0b2416', '#123a24', '#1f5a3a', '#2f7a4d', '#1b201e', '#3f4743', '#7a5a1e', '#b9852e', '#f4f1e6', '#e9d8ae'];
for (let seed = 0; seed < 12; seed++) {
  const svg = decodeURIComponent(demoCover('A Monsoon Ledger of Small Things', 'Ananya Rao', seed).replace('data:image/svg+xml;utf8,', ''));
  for (const colour of svg.match(/#[0-9a-fA-F]{6}/g) ?? []) assert.ok(PALETTE.includes(colour.toLowerCase()), `demo cover colour ${colour} is off-palette`);
}
console.log('Demo covers use only the theme palette.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/test-demo-covers.mjs`
Expected: FAIL `demo cover colour #C2410C is off-palette`.

- [ ] **Step 3: Replace the cover generator** in `scripts/demo-catalogue.mjs` (the `COVER_COLOURS` constant through the end of `demoCover`):

```js
// Demo covers (isolated preview only) use the theme palette: deep greens and ink with cream type and gold rules.
const COVER_COLOURS = ['#0b2416', '#123a24', '#1f5a3a', '#2f7a4d', '#1b201e', '#3f4743', '#7a5a1e'];
const COVER_SHAPES = [
  '<rect x="28" y="300" width="244" height="1" fill="#b9852e"/><rect x="28" y="306" width="120" height="1" fill="#b9852e"/>',
  '<circle cx="230" cy="340" r="78" fill="none" stroke="#b9852e" stroke-opacity=".7" stroke-width="1.5"/><circle cx="230" cy="340" r="46" fill="none" stroke="#e9d8ae" stroke-opacity=".35"/>',
  '<path d="M28 360 Q150 300 272 360" fill="none" stroke="#b9852e" stroke-width="1.5"/><path d="M28 380 Q150 320 272 380" fill="none" stroke="#e9d8ae" stroke-opacity=".4"/>',
  '<rect x="28" y="230" width="244" height="150" fill="none" stroke="#e9d8ae" stroke-opacity=".35"/><rect x="44" y="246" width="212" height="118" fill="none" stroke="#b9852e" stroke-opacity=".7"/>',
];
export function demoCover(title, author, seed = 0) {
  const words = title.split(' ');
  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last && (last + ' ' + word).length <= 14) lines[lines.length - 1] = last + ' ' + word; else lines.push(word);
  }
  const colour = COVER_COLOURS[(seed * 5) % COVER_COLOURS.length];
  const text = lines.map((line, i) => `<text x="28" y="${86 + i * 34}" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="500" letter-spacing="-1" fill="#f4f1e6">${escapeXml(line)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">`
    + `<rect width="300" height="450" fill="${colour}"/>${COVER_SHAPES[seed % COVER_SHAPES.length]}${text}`
    + `<text x="28" y="418" font-family="Menlo,Consolas,monospace" font-size="12" letter-spacing="1.5" fill="#e9d8ae">${escapeXml(author.toUpperCase())}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
```

- [ ] **Step 4: Run tests** — `node scripts/test-demo-covers.mjs && npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/demo-catalogue.mjs scripts/test-demo-covers.mjs scripts/test-all.mjs
git commit -m "Draw preview demo covers in the INVENTAYU palette

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Part 3 — Surfaces

### Task 7: Header, category previews and footer

**Files:**
- Modify (rewrite): `src/components/StoreHeader.tsx`, `src/components/CategoryBar.tsx`, `src/components/SiteFooter.tsx`, `src/styles/header.css`
- Modify: `src/lib/store-data.ts` (add `categoryCovers`), `src/app/layout.tsx` (`frameData`)
- Modify: `src/components/reading-room.test.cjs` (header test block near line 296)

**Interfaces:**
- Consumes: tokens (Task 4), `.dot` (Task 5).
- Produces: `categoryCovers(perCategory?: number): Promise<Record<string, { slug: string; title: string; cover: string }[]>>`; `StoreHeader({ name, nav, announcement, previews })`; the bag link carries `id="bag-target"` (used by `flyToBag`).

- [ ] **Step 1: Update the header test** — in the `checkHomepage` header block replace the `Header` render calls so they pass `previews` and add assertions:

```js
  const Header = load("components/StoreHeader.tsx", { "next/navigation": { usePathname: () => "/", useRouter: () => ({ push() {} }) } }).default;
  const previews = { fiction: [{ slug: "real-book", title: "Actual title", cover: "/assets/book1.png" }] };
  const header = renderToStaticMarkup(React.createElement(Header, { name: "Reading Room by INVENTAYU", nav, previews,
    announcement: { title: "Festive reads: up to 20% off", link_url: "/search?offer=1" } }));
  assert.match(header, /Festive reads: up to 20% off/);
  assert.match(header, /href="\/category\/fiction"/);
  assert.match(header, /href="\/category\/crime"/);
  assert.match(header, /<form[^>]+action="\/search"/);
  assert.match(header, /id="bag-target"/);
  assert.match(header, /Cover of Actual title/, "category panels preview real covers");
  assert.doesNotMatch(header, /अ|logo-mark/, "no Akshara mark");
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Header, { name: "x", nav, announcement: null, previews: {} })), /announcement-bar/);
```

- [ ] **Step 2: Run to verify it fails** — `node src/components/reading-room.test.cjs` — Expected: FAIL on `id="bag-target"`.

- [ ] **Step 3: Implement**

Append to `src/lib/store-data.ts`:

```ts
// Up to N covers per category for the header's hover panels; only titles the storefront may show.
export async function categoryCovers(perCategory = 3): Promise<Record<string, { slug: string; title: string; cover: string }[]>> {
  const rows = await sql`select category_slug, slug, title, cover from (
    select category_slug, slug, title, cover, row_number() over (partition by category_slug order by sort, title) as n from books
    where active and category_slug is not null and cover is not null
      and (not coalesce(third_party, false) or (release_approved and scan_status = 'clean' and rights_approved and commercial_approved and price_inr > 0 and file_url is not null))
  ) ranked where n <= ${perCategory}` as { category_slug: string; slug: string; title: string; cover: string }[];
  const out: Record<string, { slug: string; title: string; cover: string }[]> = {};
  for (const r of rows) (out[r.category_slug] ??= []).push({ slug: r.slug, title: r.title, cover: r.cover });
  return out;
}
```

In `src/app/layout.tsx` `frameData()`: import `categoryCovers`, fetch it alongside categories, return `previews`, default `{}` in the catch branch, and pass `previews={previews}` to `StoreHeader`:

```tsx
async function frameData() {
  try {
    const [categories, content, previews] = await Promise.all([getCategories(), getPublicContent(), categoryCovers()]);
    const announcement = publicModules(content.modules).find((m) => m.type === "announcement") ?? null;
    return { nav: buildNav(categories), categories, previews, announcement: announcement && { title: announcement.title, link_url: contentUrl(announcement.link_url) } };
  } catch { console.error("[layout] storefront frame data unavailable"); return { nav: { primary: [], more: [] }, categories: [], previews: {}, announcement: null }; }
}
```

`src/components/StoreHeader.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Heart, ShoppingBag, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import CategoryBar from "./CategoryBar";
import SearchBox from "./SearchBox";
import { useWishlist } from "./WishlistProvider";
import type { NavCategory } from "@/lib/navigation";

type Preview = { slug: string; title: string; cover: string };

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

export default function StoreHeader({ name, nav, announcement, previews = {} }: {
  name: string; nav: { primary: NavCategory[]; more: NavCategory[] }; announcement: { title: string; link_url: string | null } | null; previews?: Record<string, Preview[]>;
}) {
  const { slugs, ready } = useCart();
  const wishlist = useWishlist();
  const reduced = useReducedMotion();
  const scrolled = useScrolled();
  const [brand, by] = name.includes(" by ") ? [name.split(" by ")[0], name.split(" by ").slice(1).join(" by ")] : [name, ""];
  const count = ready ? slugs.length : 0;
  return <header className="site-header" data-scrolled={scrolled ? "true" : undefined}>
    {announcement && <div className="announcement-bar"><span className="dot" aria-hidden="true" />{announcement.link_url ? <Link href={announcement.link_url}>{announcement.title}</Link> : announcement.title}</div>}
    <div className="wrap header-row">
      <Link href="/" className="logo" aria-label={`${name}, home`}><span className="logo-word">{brand}</span>{by && <span className="eyebrow">By {by}</span>}</Link>
      <SearchBox />
      <nav className="header-icons" aria-label="Your account">
        <Link href="/wishlist" aria-label={`Wishlist, ${wishlist.slugs.length} ${wishlist.slugs.length === 1 ? "book" : "books"}`}><Heart size={21} strokeWidth={1.8} aria-hidden="true" />{wishlist.slugs.length > 0 && <span className="count-badge">{wishlist.slugs.length}</span>}</Link>
        <Link href="/library" aria-label="Your library"><UserRound size={21} strokeWidth={1.8} aria-hidden="true" /></Link>
        <Link href="/cart" id="bag-target" aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`}>
          <ShoppingBag size={21} strokeWidth={1.8} aria-hidden="true" />
          {count > 0 && <motion.span key={count} className="count-badge" initial={false} animate={{ scale: reduced ? 1 : [1, 1.3, 1] }} transition={{ duration: .3 }}>{count}</motion.span>}
        </Link>
      </nav>
    </div>
    <CategoryBar nav={nav} previews={previews} />
  </header>;
}
```

`src/components/CategoryBar.tsx`:

```tsx
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import Cover from "./Cover";
import type { NavCategory } from "@/lib/navigation";

type Preview = { slug: string; title: string; cover: string };

export default function CategoryBar({ nav, previews }: { nav: { primary: NavCategory[]; more: NavCategory[] }; previews: Record<string, Preview[]> }) {
  const all = [...nav.primary, ...nav.more];
  if (!all.length) return null;
  const coversFor = (c: NavCategory) => [...(previews[c.slug] ?? []), ...c.children.flatMap((child) => previews[child.slug] ?? [])].slice(0, 3);
  return <nav className="category-bar" aria-label="Categories"><div className="wrap category-row">
    <div className="mega"><button type="button" className="mega-trigger" aria-haspopup="true">All <ChevronDown size={14} aria-hidden="true" /></button>
      <div className="mega-panel mega-all">{all.map((c) => <div key={c.slug} className="mega-links"><Link className="mega-head" href={`/category/${c.slug}`}>{c.name}</Link>
        {c.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</div>)}</div></div>
    {nav.primary.map((c) => {
      const covers = coversFor(c);
      if (!c.children.length && !covers.length) return <Link key={c.slug} href={`/category/${c.slug}`}>{c.name}</Link>;
      return <div className="mega" key={c.slug}><Link className="mega-trigger" href={`/category/${c.slug}`}>{c.name} <ChevronDown size={14} aria-hidden="true" /></Link>
        <div className="mega-panel">
          <div className="mega-links"><Link className="mega-head" href={`/category/${c.slug}`}>All {c.name}</Link>{c.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</div>
          {covers.length > 0 && <div className="mega-covers">{covers.map((b) => <Link key={b.slug} href={`/books/${encodeURIComponent(b.slug)}`}><Cover src={b.cover} title={b.title} sizes="72px" /></Link>)}</div>}
        </div></div>;
    })}
    <Link href="/search?offer=1" className="deal-link">Offers</Link>
  </div></nav>;
}
```

`src/components/SiteFooter.tsx`:

```tsx
import Link from "next/link";

export default function SiteFooter({ name, categories }: { name: string; categories: { slug: string; name: string }[] }) {
  const [brand, by] = name.includes(" by ") ? [name.split(" by ")[0], name.split(" by ").slice(1).join(" by ")] : [name, ""];
  const cols: [string, [string, string][]][] = [
    ["Shop", [["All books", "/search"], ["New", "/search?sort=new"], ["Offers", "/search?offer=1"], ["Wishlist", "/wishlist"]]],
    ["Account", [["Library", "/library"], ["Bag", "/cart"], ["Sign in", "/login"]]],
    ["Help", [["Delivery", "/delivery-policy"], ["Refunds", "/refund-policy"], ["Privacy", "/privacy"], ["Terms", "/terms"]]],
    ["Authors", [["Publish with us", "/publish"], ["Workspace", "/author"]]],
  ];
  return <footer className="site-footer"><div className="wrap">
    <div className="footer-top">
      <div><Link href="/" className="logo"><span className="logo-word">{brand}</span>{by && <span className="eyebrow">By {by}</span>}</Link>
        <p className="footer-about">Digital books. Instant download. Yours to keep.</p></div>
      {cols.map(([title, links]) => <div key={title}><h2>{title}</h2><ul>{links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul></div>)}
    </div>
    {categories.length > 0 && <div className="popular"><h2>Popular</h2><ul>{categories.slice(0, 16).map((c) =>
      <li key={c.slug}><Link className="chip" href={`/category/${c.slug}`}>{c.name}</Link></li>)}</ul></div>}
    <p className="footer-legal">© {new Date().getFullYear()} {name} · Digital editions only</p>
  </div></footer>;
}
```

`src/styles/header.css` (full rewrite):

```css
@layer components {
  .site-header { position: sticky; top: 0; z-index: 40; background: rgb(255 255 255 / .96); border-bottom: 1px solid var(--line); transition: background .3s, box-shadow .3s; }
  .site-header[data-scrolled] { background: rgb(255 255 255 / .78); -webkit-backdrop-filter: saturate(1.4) blur(14px); backdrop-filter: saturate(1.4) blur(14px); box-shadow: var(--shadow-e2); }
  .announcement-bar { display: flex; justify-content: center; align-items: center; gap: 10px; padding: 8px 16px; background: var(--forest); color: #e9d8ae; font: 500 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
  .announcement-bar a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  .header-row { display: flex; align-items: center; gap: 24px; min-height: 68px; }
  .logo { display: inline-flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
  .logo-word { font-size: 20px; font-weight: 600; letter-spacing: -.03em; color: var(--ink); line-height: 1; }
  .logo .eyebrow { font-size: 9px; }
  .header-search { position: relative; display: flex; align-items: center; flex: 1; max-width: 560px; height: 46px; margin-inline: auto; padding-inline: 16px 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg-2); transition: border-color .2s, box-shadow .2s, background .2s; }
  .header-search:focus-within { background: var(--bg); border-color: var(--brand); box-shadow: 0 0 0 4px rgb(47 122 77 / .12); }
  .header-search input { flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; font-size: 15px; outline: none; }
  .header-search button { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 999px; background: transparent; color: var(--ink-soft); }
  .search-key { padding: 4px 7px; border: 1px solid var(--line-2); border-radius: 6px; font: 500 11px/1 var(--font-mono); color: var(--ink-mute); }
  .suggest-list { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 50; padding: 8px; border: 1px solid var(--line); border-radius: 16px; background: var(--bg); box-shadow: var(--shadow-e4); animation: drop .22s var(--ease-out); }
  .suggest-list li a { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 10px; }
  .suggest-list li.active a, .suggest-list li a:hover { background: var(--bg-2); }
  .suggest-cover { flex: 0 0 34px; height: 48px; overflow: hidden; border-radius: 3px; background: var(--bg-3); }
  .suggest-cover img { width: 100%; height: 100%; object-fit: cover; }
  .suggest-label { display: block; font-size: 15px; font-weight: 500; }
  .suggest-detail { display: block; font: 400 10px/1.5 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); }
  .suggest-all a { justify-content: center; font: 500 11px/1 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--brand); }
  .header-icons { display: flex; align-items: center; gap: 2px; }
  .header-icons a { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; color: var(--ink); transition: background .2s; }
  .header-icons a:hover { background: var(--bg-2); }
  .count-badge { position: absolute; top: 4px; right: 1px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--brand); color: #fff; font: 600 10px/18px var(--font-mono); text-align: center; }
  .category-bar { border-top: 1px solid var(--line); }
  .category-row { display: flex; align-items: center; gap: 2px; min-height: 42px; }
  .category-row > a, .mega-trigger { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: none; font: 500 11px/1 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); white-space: nowrap; transition: color .2s, background .2s; }
  .category-row > a:hover, .mega-trigger:hover, .mega:focus-within > .mega-trigger { color: var(--ink); background: var(--bg-2); }
  .category-row > .deal-link { color: var(--gold); margin-left: auto; }
  .mega { position: relative; }
  .mega-panel { position: absolute; top: calc(100% + 4px); left: 0; z-index: 45; display: none; grid-template-columns: minmax(150px, auto) auto; gap: 16px 28px; min-width: 320px; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--bg); box-shadow: var(--shadow-e4); animation: drop .22s var(--ease-out); }
  .mega:hover > .mega-panel, .mega:focus-within > .mega-panel { display: grid; }
  .mega-all { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); width: min(720px, 90vw); }
  .mega-links { display: grid; align-content: start; gap: 7px; }
  .mega-links a { font-size: 14px; color: var(--ink-soft); transition: color .2s; }
  .mega-links a:hover { color: var(--brand); }
  .mega-links .mega-head { font-weight: 600; color: var(--ink); }
  .mega-covers { display: flex; align-items: end; gap: 10px; }
  .mega-covers a { width: 64px; transition: transform .35s var(--ease-out); }
  .mega-covers a:hover { transform: translateY(-4px); }
  @keyframes drop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  .site-footer { margin-top: 40px; border-top: 1px solid var(--line); background: linear-gradient(180deg, var(--bg-2), var(--bg)); }
  .footer-top { display: grid; grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr)); gap: 32px; padding-block: 56px 32px; }
  .footer-about { margin-top: 12px; max-width: 30ch; color: var(--ink-soft); font-size: 15px; }
  .site-footer h2 { margin-bottom: 12px; font: 500 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); }
  .site-footer ul a { display: inline-block; padding-block: 5px; font-size: 15px; color: var(--ink-soft); transition: color .2s; }
  .site-footer ul a:hover { color: var(--brand); }
  .popular { padding-block: 22px; border-top: 1px solid var(--line); }
  .popular ul { display: flex; flex-wrap: wrap; gap: 8px; }
  .site-footer .popular a.chip { padding-block: 4px; }
  .footer-legal { padding-block: 20px 28px; border-top: 1px solid var(--line); font: 400 11px/1.5 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); }
  @media (max-width: 900px) { .footer-top { grid-template-columns: 1fr 1fr; } .footer-top > :first-child { grid-column: 1 / -1; } }
  @media (max-width: 760px) {
    .header-row { flex-wrap: wrap; gap: 8px 12px; padding-block: 10px; }
    .header-search { order: 3; flex-basis: 100%; max-width: none; }
    .search-key { display: none; }
    .category-row { overflow-x: auto; scrollbar-width: none; }
    .mega-panel { display: none !important; }
  }
}
```

- [ ] **Step 4: Run tests** — `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test` — Expected: PASS.

- [ ] **Step 5: Look at it** — restart the isolated preview (`npm run preview:isolated -- 3100`), screenshot `/` at 1440 and 390 into `scratch/t7-*.png`; confirm the header is white with Geist wordmark, mono category row, gold Offers, frosted after scrolling.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoreHeader.tsx src/components/CategoryBar.tsx src/components/SiteFooter.tsx src/styles/header.css src/lib/store-data.ts src/app/layout.tsx src/components/reading-room.test.cjs
git commit -m "Header and footer in the INVENTAYU theme, with cover previews in category panels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Book card, catalogue entry, carousel and add-to-bag flight

**Files:**
- Modify (rewrite): `src/components/BookCard.tsx`, `src/components/Carousel.tsx`, `src/components/AddToCart.tsx`, `src/styles/card.css`
- Create: `src/components/CatalogueEntry.tsx`
- Modify: `src/components/reading-room.test.cjs` (card assertions near line 99)

**Interfaces:**
- Consumes: `Book3D`, `Morph`, `morphName`, `flyToBag` (Task 5).
- Produces: `BookCard({ book, enabled, morph = true })` with root `article.book-card[data-book-card]`; `CatalogueEntry({ book, index, enabled, morph = true })`; `Carousel` keeps its props `{ title, tagline?, href?, label?, children }`; `AddToCart` keeps its props and adds optional `variant?: "card" | "page"`.

- [ ] **Step 1: Update the card test** — replace `assert.match(cardHtml, /class="product-card"/);` with:

```js
assert.match(cardHtml, /data-book-card/);
const realCoverHtml = renderToStaticMarkup(React.createElement(CardView, { book: { ...saleBook, cover: "/assets/book1.png" }, enabled: true }));
assert.match(realCoverHtml, /class="book3d"/, "real covers get the tilt without drawn edges");
assert.match(dataCover, /class="book3d flat"/, "flat demo covers get the drawn spine");
const EntryView = load("components/CatalogueEntry.tsx", {
  "./CartProvider": { useCart: () => cart }, "motion/react": { ...require("motion/react"), useReducedMotion: () => true },
  "next/navigation": { useRouter: () => ({ push() {} }) },
}).default;
const entryHtml = renderToStaticMarkup(React.createElement(EntryView, { book: saleBook, index: 1, enabled: true }));
assert.match(entryHtml, /Catalogue no\. 001/);
assert.match(entryHtml, /Buy now/);
assert.doesNotMatch(entryHtml, /<p[^>]*>[^<]{121,}<\/p>/, "entries carry no long paragraphs");
```

(Move the `dataCover` render above these lines if it currently comes after them.)

- [ ] **Step 2: Run to verify it fails** — `node src/components/reading-room.test.cjs` — Expected: FAIL on `data-book-card`.

- [ ] **Step 3: Implement**

`src/components/BookCard.tsx`:

```tsx
import Link from "next/link";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";
import Price from "./Price";
import QuickView from "./QuickView";
import WishlistButton from "./WishlistButton";
import Book3D from "./motion/Book3D";
import Morph, { morphName } from "./motion/Morph";

const href = (book: PublicBook) => `/books/${encodeURIComponent(book.slug)}`;

export default function BookCard({ book, enabled, morph = true }: { book: PublicBook; index?: number; enabled: boolean; morph?: boolean }) {
  const cover = <Book3D src={book.cover} title={book.title} sizes="(max-width: 640px) 42vw, 180px" />;
  const off = book.onSale && book.regular > 0 ? Math.round((book.saving / book.regular) * 100) : 0;
  return <article className="book-card surface surface-hover surface-lit" data-book-card>
    <div className="card-plate plate">
      <Link href={href(book)} className="card-cover" aria-label={`View ${book.title}`} tabIndex={-1}>{morph ? <Morph name={morphName(book.slug)}>{cover}</Morph> : cover}</Link>
      {book.comingSoon ? <span className="pill card-flag">Coming soon</span> : off > 0 && <span className="pill card-flag offer">{off}% off</span>}
      <WishlistButton slug={book.slug} title={book.title} />
      <QuickView book={book} enabled={enabled} />
    </div>
    <div className="card-body">
      <p className="eyebrow card-meta">{[book.file_format, book.language].filter(Boolean).join(" · ") || "Digital edition"}</p>
      <h3 className="card-title"><Link href={href(book)}>{book.title}</Link></h3>
      {book.authorship && <p className="card-author">{book.authorship}</p>}
      <div className="card-foot"><Price book={book} /><AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} /></div>
    </div>
  </article>;
}
```

`src/components/CatalogueEntry.tsx`:

```tsx
import Link from "next/link";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";
import BuyNow from "./BuyNow";
import Price from "./Price";
import Book3D from "./motion/Book3D";
import Morph, { morphName } from "./motion/Morph";

// The few-titles layout: the 65f7044 catalogue card, trimmed to what a reader decides on.
export default function CatalogueEntry({ book, index, enabled, morph = true }: { book: PublicBook; index: number; enabled: boolean; morph?: boolean }) {
  const href = `/books/${encodeURIComponent(book.slug)}`;
  const cover = <Book3D src={book.cover} title={book.title} sizes="(max-width: 760px) 60vw, 220px" priority={index === 1} />;
  const chips = [book.file_format, book.pages ? `${book.pages} pages` : null, book.language, book.edition].filter(Boolean) as string[];
  return <article className="entry surface surface-lit reveal" data-book-card>
    <Link href={href} className="entry-plate plate" tabIndex={-1} aria-label={`View ${book.title}`}>{morph ? <Morph name={morphName(book.slug)}>{cover}</Morph> : cover}</Link>
    <div className="entry-info">
      <p className="eyebrow">Catalogue no. {String(index).padStart(3, "0")}</p>
      <h3><Link href={href}>{book.title}</Link></h3>
      {book.authorship && <p className="card-author">{book.authorship}</p>}
      {chips.length > 0 && <ul className="entry-chips">{chips.map((c) => <li key={c} className="chip">{c}</li>)}</ul>}
      <Link className="link-line" href={href}>Inside the book <span aria-hidden="true">→</span></Link>
      <div className="entry-buy"><Price book={book} size="page" />
        <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} variant="page" />
        <BuyNow slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} /></div>
    </div>
  </article>;
}
```

`src/components/AddToCart.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCart } from "./CartProvider";
import { flyToBag } from "./motion/fly";

export default function AddToCart({ slug, title, enabled, saleable, saveable, variant = "card" }: { slug: string; title: string; enabled: boolean; saleable: boolean; saveable: boolean; variant?: "card" | "page" }) {
  const cart = useCart();
  const reduced = useReducedMotion();
  const added = cart.slugs.includes(slug);
  const full = cart.slugs.length >= 20;
  const canSave = saleable || (!enabled && saveable);
  const label = !canSave ? "Unavailable" : full ? "Bag is full" : enabled ? "Add to bag" : "Save to bag";
  return <div className="cart-control">
    {added ? <Link className="btn btn-ghost card-add" href="/cart"><Check size={17} aria-hidden="true" /> In your bag</Link>
      : <motion.button className={`btn ${variant === "page" ? "btn-ghost" : "btn-primary"} card-add`} type="button" disabled={!cart.ready || !canSave || full}
        whileTap={{ scale: reduced ? 1 : .96 }} transition={{ duration: .12 }}
        onClick={(e) => { flyToBag(e?.currentTarget?.closest("[data-book-card], [data-book-page]")); cart.add(slug); }} aria-label={`${label}: ${title}`}>
        <ShoppingBag size={17} aria-hidden="true" />{label}
      </motion.button>}
    <span className="sr-only" role="status">{added ? `${title} is in your bag.` : ""}</span>
    {cart.error && <p className="small text-danger" role="alert">{cart.error}</p>}
  </div>;
}
```

`src/components/Carousel.tsx` (adds mouse drag with momentum; touch keeps native scrolling):

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export default function Carousel({ title, tagline, href, label, children }: { title: string; tagline?: string; href?: string; label?: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; last: number; t: number; v: number; moved: boolean } | null>(null);
  const suppress = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [dragging, setDragging] = useState(false);
  const measure = useCallback(() => {
    const el = track.current;
    if (el) setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);
  const page = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.9, behavior: "smooth" });
  const end = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || !track.current) return;
    suppress.current = d.moved;
    if (d.moved && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) track.current.scrollBy({ left: -d.v * 240, behavior: "smooth" });
  };
  const items = Children.toArray(children);
  if (!items.length) return null;
  return <section className="carousel" aria-label={label ?? title}>
    <div className="section-head reveal"><div><h2>{title}</h2>{tagline && <p>{tagline}</p>}</div>
      <div className="section-actions">
        {!(edges.start && edges.end) && <>
          <button type="button" className="round-btn" onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous in ${title}`}><ChevronLeft size={19} aria-hidden="true" /></button>
          <button type="button" className="round-btn" onClick={() => page(1)} disabled={edges.end} aria-label={`Next in ${title}`}><ChevronRight size={19} aria-hidden="true" /></button></>}
        {href && <Link className="link-line" href={href}>See all <span aria-hidden="true">→</span></Link>}
      </div></div>
    <ul ref={track} className={`carousel-track${dragging ? " dragging" : ""}`} onScroll={measure}
      onPointerDown={(e) => { if (e.pointerType !== "mouse" || !track.current) return; drag.current = { x: e.clientX, left: track.current.scrollLeft, last: e.clientX, t: e.timeStamp, v: 0, moved: false }; }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !track.current) return;
        if (Math.abs(e.clientX - d.x) > 5) { d.moved = true; setDragging(true); }
        if (!d.moved) return;
        const dt = Math.max(1, e.timeStamp - d.t);
        d.v = (e.clientX - d.last) / dt; d.last = e.clientX; d.t = e.timeStamp;
        track.current.scrollLeft = d.left - (e.clientX - d.x);
      }}
      onPointerUp={end} onPointerLeave={end}
      onClickCapture={(e) => { if (suppress.current) { e.preventDefault(); e.stopPropagation(); suppress.current = false; } }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}</ul>
  </section>;
}
```

`src/styles/card.css` (full rewrite; keeps drawer, quick view and heart styles that live here):

```css
@layer components {
  .book-card { display: flex; flex-direction: column; height: 100%; min-width: 0; padding: 10px; border-radius: 18px; }
  .card-plate { position: relative; display: grid; place-items: center; padding: 24px 18px 28px; }
  .card-cover { display: block; width: min(150px, 76%); }
  .card-flag { position: absolute; top: 10px; left: 10px; padding: 5px 9px; font-size: 10px; box-shadow: none; }
  .card-flag.offer { color: #7a5a1e; border-color: #ecdcb8; background: #fbf4e6; }
  .card-body { display: flex; flex: 1; flex-direction: column; gap: 4px; padding: 14px 6px 4px; }
  .card-meta { font-size: 10px; }
  .card-title { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 16px; line-height: 1.3; letter-spacing: -.02em; }
  .card-title a:hover { color: var(--brand); }
  .card-author { overflow: hidden; color: var(--ink-soft); font-size: 13px; white-space: nowrap; text-overflow: ellipsis; }
  .card-foot { display: flex; flex-direction: column; gap: 10px; margin-top: auto; padding-top: 12px; }
  .card-foot .btn, .card-add { width: 100%; min-height: 42px; padding: 10px 14px; font-size: 14px; }
  .price-block { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .price-now { font-size: 20px; font-weight: 600; letter-spacing: -.03em; }
  .price-page .price-now { font-size: 38px; font-weight: 500; letter-spacing: -.045em; }
  .price-regular { color: var(--ink-mute); font-size: 14px; }
  .soon-chip { display: inline-flex; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; font: 500 11px/1.4 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); }
  .heart-btn { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 999px; background: rgb(255 255 255 / .9); color: var(--ink-soft); transition: color .2s, border-color .2s; }
  .heart-btn[aria-pressed="true"] { color: #b3261e; border-color: #f0c9c5; }
  .heart-btn.card { position: absolute; top: 8px; right: 8px; }
  .heart-btn.page { width: 44px; height: 44px; }
  .quick-view-btn { position: absolute; bottom: 10px; left: 50%; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px; background: rgb(255 255 255 / .92); font: 500 11px/1 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; opacity: 0; translate: -50% 8px; transition: opacity .3s var(--ease-out), translate .3s var(--ease-out); }
  .book-card:hover .quick-view-btn, .book-card:focus-within .quick-view-btn { opacity: 1; translate: -50% 0; }
  @media (hover: none) { .quick-view-btn { opacity: 1; translate: -50% 0; } }
  .carousel-track { display: grid; grid-auto-flow: column; grid-auto-columns: 216px; gap: 18px; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -4px; padding: 6px 4px 22px; scrollbar-width: none; cursor: grab; }
  .carousel-track::-webkit-scrollbar { display: none; }
  .carousel-track.dragging { cursor: grabbing; scroll-snap-type: none; user-select: none; }
  .carousel-track > li { scroll-snap-align: start; min-width: 0; }
  .grid-books { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px; }
  .entries { display: grid; gap: 28px; }
  .entry { display: grid; grid-template-columns: minmax(0, 280px) minmax(0, 1fr); gap: 24px 48px; padding: 28px; }
  .entry-plate { display: grid; place-items: center; padding: 30px; }
  .entry-plate .book3d { width: min(210px, 100%); }
  .entry-info { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; min-width: 0; }
  .entry-info h3 { font-size: clamp(26px, 3vw, 40px); letter-spacing: -.04em; line-height: 1.04; }
  .entry-info h3 a:hover { color: var(--brand); }
  .entry-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .entry-buy { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; align-self: stretch; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--line); }
  .entry-buy .cart-control .btn, .entry-buy > .btn { width: auto; min-width: 170px; }
  .recent-card { display: flex; flex-direction: column; gap: 10px; padding: 10px; }
  .recent-title { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 14px; font-weight: 500; }
  .cart-drawer { position: fixed; inset: 0 0 0 auto; width: min(420px, 100vw); height: 100dvh; max-height: none; margin: 0; padding: 0; border: 0; background: var(--bg); box-shadow: var(--shadow-e4); display: none; flex-direction: column; }
  .cart-drawer[open] { display: flex; animation: slide-in .38s var(--ease-out); }
  .cart-drawer::backdrop { background: rgb(11 36 22 / .35); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
  .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px; border-bottom: 1px solid var(--line); }
  .drawer-head h2 { font-size: 20px; }
  .drawer-added { display: flex; align-items: center; gap: 8px; margin: 14px 22px 0; padding: 10px 12px; border-radius: 12px; background: #e6f2ea; color: var(--brand-deep); font-size: 14px; animation: rise .4s var(--ease-out); }
  .drawer-lines { flex: 1; overflow-y: auto; padding: 8px 22px; }
  .drawer-lines li { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding-block: 14px; border-bottom: 1px solid var(--line); animation: rise .4s var(--ease-out) backwards; }
  .drawer-cover img { width: 52px; height: auto; border-radius: 3px; box-shadow: var(--shadow-e2); }
  .drawer-text { display: grid; gap: 2px; font-size: 14px; }
  .drawer-text a { font-weight: 500; }
  .drawer-text s { color: var(--ink-mute); }
  .icon-plain { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 10px; background: none; color: var(--ink-soft); }
  .icon-plain:hover { background: var(--bg-2); color: var(--danger); }
  .drawer-foot { display: grid; gap: 10px; padding: 18px 22px 22px; border-top: 1px solid var(--line); background: var(--bg-2); }
  .drawer-subtotal { display: flex; justify-content: space-between; font-size: 17px; }
  .drawer-note { font: 400 11px/1.5 var(--font-mono); letter-spacing: .04em; text-transform: uppercase; color: var(--ink-mute); }
  .drawer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .quick-view { width: min(760px, 94vw); padding: 0; border: 1px solid var(--line); border-radius: 22px; background: var(--bg); box-shadow: var(--shadow-e4); }
  .quick-view[open] { animation: pop .35s var(--ease-out); }
  .quick-view::backdrop { background: rgb(11 36 22 / .35); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
  .qv-close { position: absolute; top: 14px; right: 14px; z-index: 2; }
  .qv-grid { display: grid; grid-template-columns: 260px minmax(0, 1fr); }
  .qv-cover { display: grid; place-items: center; padding: 36px; border-radius: 22px 0 0 22px; background: linear-gradient(160deg, var(--bg-3), var(--bg-2)); }
  .qv-cover img { width: 180px; height: auto; filter: drop-shadow(0 14px 22px rgb(12 38 24 / .2)); }
  .qv-info { display: flex; flex-direction: column; gap: 12px; padding: 34px 30px; }
  .qv-info h2 { font-size: 26px; padding-right: 40px; }
  .qv-blurb { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; color: var(--ink-soft); font-size: 15px; }
  .qv-actions { display: flex; align-items: center; gap: 10px; }
  .qv-actions .cart-control { flex: 1; }
  @keyframes slide-in { from { transform: translateX(100%); } to { transform: none; } }
  @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
  @media (max-width: 760px) {
    .entry { grid-template-columns: 1fr; padding: 18px; }
    .carousel-track { grid-auto-columns: 46%; gap: 12px; }
    .qv-grid { grid-template-columns: 1fr; }
    .qv-cover { border-radius: 22px 22px 0 0; }
  }
}
```

- [ ] **Step 4: Run tests** — `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test` — Expected: PASS.

- [ ] **Step 5: Look at it** — preview `/search` at 1440 and 390; hover a card (lift, tilt, Quick view appears), click Add to bag (cover flies to the bag icon, drawer slides in). Screenshot to `scratch/t8-*.png`.

- [ ] **Step 6: Commit**

```bash
git add src/components/BookCard.tsx src/components/CatalogueEntry.tsx src/components/Carousel.tsx src/components/AddToCart.tsx src/styles/card.css src/components/reading-room.test.cjs
git commit -m "Theme cards with 3D covers, morph names, drag carousels and the add-to-bag flight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Homepage

**Files:**
- Create: `src/lib/copy.ts`, `src/components/home/HeroCampaign.tsx`, `src/components/home/CategoryTiles.tsx`, `src/components/home/Featured.tsx`, `src/components/home/LookInside.tsx`, `src/components/home/LanguageStrip.tsx`, `src/components/home/AuthorChips.tsx`, `src/components/home/PublishBand.tsx`, `src/components/home/FaqGrid.tsx`
- Delete: `src/components/home/AksharaHero.tsx`, `src/components/home/BannerCarousel.tsx`, `src/components/home/SubjectIndex.tsx`, `src/components/home/LanguageShelf.tsx`, `src/components/home/AuthorStrip.tsx`, `src/components/home/PublishBanner.tsx`
- Modify (rewrite): `src/app/page.tsx`, `src/styles/home.css`
- Modify: `src/lib/home.ts` (rail taglines; languages without glyphs)
- Modify: `src/components/reading-room.test.cjs` (replace the `BannerView` block)

**Interfaces:**
- Consumes: `Banner`, `buildHome` (`src/lib/home.ts`), `BookCard`, `CatalogueEntry`, `Carousel`, `Book3D`, `Cover`.
- Produces: `copyViolations(html: string, opts?: { maxHeadingWords?: number; maxParagraph?: number }): string[]`; `HeroCampaign({ banners: Banner[]; covers: { slug: string; title: string; cover: string | null }[] })`, `splitAccent(title: string): [string, string]`, `DEFAULT_SLIDE: Banner`; `home.languages: { name: string; count: number }[]`.

- [ ] **Step 1: Write the failing tests** — in `checkHomepage()` replace the whole `BannerView` block (from `const BannerView = ...` through the `reduced motion never autoplays` assertion) with:

```js
  const { copyViolations } = load("lib/copy.ts");
  assert.deepEqual(copyViolations("<h2>Five words fit right here</h2><p>Short line.</p>"), []);
  assert.equal(copyViolations("<h2>One two three four five six seven</h2>").length, 1);
  assert.equal(copyViolations(`<p>${"x".repeat(121)}</p>`).length, 1);
  const motionStub = { "motion/react": { ...require("motion/react"), useReducedMotion: () => true } };
  const Hero = load("components/home/HeroCampaign.tsx", motionStub);
  assert.deepEqual(Hero.splitAccent("Books worth keeping, delivered instantly"), ["Books worth keeping, ", "delivered instantly"]);
  const covers = [{ slug: "real-book", title: "Actual title", cover: "/assets/book1.png" }];
  const none = renderToStaticMarkup(React.createElement(Hero.default, { banners: [], covers }));
  assert.match(none, /delivered instantly/, "no banners shows the default slide");
  assert.doesNotMatch(none, /Next slide|Pause slides/);
  const banner = (id) => ({ id, title: `Offer ${id}`, body: null, subtitle: null, image: null, mobileImage: null, href: "/search", label: null, theme: "forest" });
  const one = renderToStaticMarkup(React.createElement(Hero.default, { banners: [banner("a")], covers }));
  assert.match(one, /Offer a/);
  assert.doesNotMatch(one, /Next slide|Pause slides/, "a single banner has no controls");
  const two = renderToStaticMarkup(React.createElement(Hero.default, { banners: [banner("a"), banner("b")], covers }));
  assert.match(two, /Next slide/);
  assert.doesNotMatch(two, /Pause slides/, "reduced motion never autoplays, so no pause control");
  const homeBook = { ...saleBook, highlights: ["Method as the subject, not an appendix"] };
  const sections = [
    React.createElement(Hero.default, { banners: [], covers }),
    React.createElement(load("components/home/CategoryTiles.tsx").default, { tiles: [{ slug: "science", name: "Science", count: 3, covers: ["/assets/book1.png"] }] }),
    React.createElement(load("components/home/Featured.tsx", { ...motionStub, "next/navigation": { useRouter: () => ({ push() {} }) } }).default, { books: [homeBook], rails: [], enabled: true }),
    React.createElement(load("components/home/LookInside.tsx").default, { books: [homeBook] }),
    React.createElement(load("components/home/PublishBand.tsx").default, { covers }),
    React.createElement(load("components/home/FaqGrid.tsx").default),
  ].map((el) => renderToStaticMarkup(el)).join("");
  assert.deepEqual(copyViolations(sections), [], "homepage copy stays short");
  assert.doesNotMatch(sections, /akshara|अ/);
```

(`saleBook` and `cart` are defined earlier in the file; if `checkHomepage` cannot see them because of scope, move their declarations to module scope.)

- [ ] **Step 2: Run to verify it fails** — `node src/components/reading-room.test.cjs` — Expected: FAIL (`ENOENT` for `lib/copy.ts`).

- [ ] **Step 3: Implement**

`src/lib/copy.ts`:

```ts
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

// The governing copy rule: short headings, one-line paragraphs. Used by component tests and browser checks.
export function copyViolations(html: string, { maxHeadingWords = 6, maxParagraph = 120 } = {}) {
  const out: string[] = [];
  for (const m of html.matchAll(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const t = text(m[2]);
    if (t.split(" ").filter(Boolean).length > maxHeadingWords) out.push(`heading over ${maxHeadingWords} words: "${t}"`);
  }
  for (const m of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = text(m[1]);
    if (t.length > maxParagraph) out.push(`paragraph over ${maxParagraph} characters: "${t.slice(0, 60)}..."`);
  }
  return out;
}
```

`src/components/home/HeroCampaign.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleCheck, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Banner } from "@/lib/home";
import Book3D from "../motion/Book3D";

type HeroCover = { slug: string; title: string; cover: string | null };

export const DEFAULT_SLIDE: Banner = { id: "default", title: "Books worth keeping, delivered instantly", subtitle: "Digital editions",
  body: "Independent authors and publishers. Pay once, read anywhere.", image: null, mobileImage: null, href: "/search", label: "Browse books", theme: "forest" };

// The last two words of a headline carry the brand gradient, so admin banners get it without markup.
export function splitAccent(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length < 3) return ["", title.trim()];
  return [`${words.slice(0, -2).join(" ")} `, words.slice(-2).join(" ")];
}

const TICKS: [string, string][] = [["Instant", "download"], ["Secure", "payment"], ["Licensed", "to you"]];

export default function HeroCampaign({ banners, covers }: { banners: Banner[]; covers: HeroCover[] }) {
  const slides = banners.length ? banners : [DEFAULT_SLIDE];
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const many = slides.length > 1;
  useEffect(() => {
    if (!many || paused || hover || reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [many, paused, hover, reduced, slides.length]);
  useEffect(() => {
    const el = root.current;
    if (reduced || !el) return;
    const pointer = (e: PointerEvent) => { el.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3)); el.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3)); };
    const scroll = () => el.style.setProperty("--sy", Math.min(1, scrollY / 600).toFixed(3));
    addEventListener("pointermove", pointer, { passive: true });
    addEventListener("scroll", scroll, { passive: true });
    return () => { removeEventListener("pointermove", pointer); removeEventListener("scroll", scroll); };
  }, [reduced]);
  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length);
  const shown = covers.filter((c) => c.cover).slice(0, 3);
  return <section ref={root} className="hero-campaign" aria-roledescription={many ? "carousel" : undefined} aria-label="Featured"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
    {slides.map((s, i) => {
      const [lead, accent] = splitAccent(s.title);
      return <div key={s.id} className="hero-slide" hidden={i !== index} role={many ? "group" : undefined}
        aria-roledescription={many ? "slide" : undefined} aria-label={many ? `${i + 1} of ${slides.length}` : undefined}>
        <picture className="hero-art" aria-hidden="true">{s.mobileImage && <source media="(max-width: 640px)" srcSet={s.mobileImage} />}
          <img src={s.image ?? "/assets/reading-room-botanical-v2.webp"} alt="" fetchPriority={i === 0 ? "high" : undefined} /></picture>
        <div className="wrap hero-grid">
          <div className="hero-copy enter">
            {s.subtitle && <span className="pill"><span className="dot" />{s.subtitle}</span>}
            <h1>{lead}<span className="grad">{accent}</span></h1>
            {s.body && <p>{s.body}</p>}
            <div className="hero-actions">{s.href && <Link className="btn btn-primary" href={s.href}>{s.label || "Browse books"} <span aria-hidden="true">→</span></Link>}
              <Link className="btn btn-ghost" href="/publish">Publish with us</Link></div>
            <ul className="ticks">{TICKS.map(([strong, rest]) => <li key={strong}><CircleCheck size={16} aria-hidden="true" /><span><strong>{strong}</strong> {rest}</span></li>)}</ul>
          </div>
          {i === index && shown.length > 0 && <div className="hero-stage" aria-hidden="true">{shown.map((c, k) =>
            <Link key={c.slug} href={`/books/${encodeURIComponent(c.slug)}`} tabIndex={-1} className={`hero-cover c${k}`}>
              <Book3D src={c.cover} title={c.title} sizes="(max-width: 900px) 34vw, 200px" priority={k === 0} /></Link>)}</div>}
        </div>
      </div>;
    })}
    {many && <div className="hero-controls">
      <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Previous slide"><ChevronLeft size={17} aria-hidden="true" /></button>
      <div className="hero-dots">{slides.map((s, i) => <button key={s.id} type="button" aria-label={`Show slide ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)} />)}</div>
      <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Next slide"><ChevronRight size={17} aria-hidden="true" /></button>
      {mounted && !reduced && <button type="button" className="round-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play slides" : "Pause slides"}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}</button>}
    </div>}
  </section>;
}
```

`src/components/home/CategoryTiles.tsx`:

```tsx
import Link from "next/link";
import Cover from "../Cover";

export default function CategoryTiles({ tiles }: { tiles: { slug: string; name: string; count: number; covers: string[] }[] }) {
  if (!tiles.length) return null;
  return <section className="wrap section">
    <div className="section-head reveal"><h2>Browse by subject</h2><Link className="link-line" href="/search">All books <span aria-hidden="true">→</span></Link></div>
    <ul className="tile-grid">{tiles.map((t) => <li key={t.slug} className="reveal"><Link className="cat-tile surface surface-hover surface-lit" href={`/category/${t.slug}`}>
      <span className="cat-fan plate" aria-hidden="true">{t.covers.slice(0, 3).map((c, i) => <span key={i}><Cover src={c} title={t.name} sizes="80px" /></span>)}</span>
      <span className="cat-name">{t.name}</span><span className="eyebrow">{t.count} {t.count === 1 ? "title" : "titles"}</span></Link></li>)}</ul>
  </section>;
}
```

`src/components/home/Featured.tsx`:

```tsx
import BookCard from "../BookCard";
import CatalogueEntry from "../CatalogueEntry";
import Carousel from "../Carousel";
import type { PublicBook } from "../book-data";
import type { Home } from "@/lib/home";

// Fewer than five titles read best as full catalogue cards; a larger shelf becomes rails.
export default function Featured({ books, rails, enabled }: { books: PublicBook[]; rails: Home["rails"]; enabled: boolean }) {
  if (!books.length) return <section className="wrap section"><p className="eyebrow">New titles on the way</p></section>;
  if (books.length < 5) return <section id="catalogue" className="wrap section">
    <div className="section-head reveal"><h2>The catalogue</h2><span className="pill">Prices in INR</span></div>
    <div className="entries">{books.map((b, i) => <CatalogueEntry key={b.slug} book={b} index={i + 1} enabled={enabled} />)}</div>
  </section>;
  const seen = new Set<string>();
  const once = (slug: string) => (seen.has(slug) ? false : (seen.add(slug), true));
  return <>{rails.map((r) => <div className="wrap section" key={r.key}><Carousel title={r.title} tagline={r.tagline} href={r.href}>
    {r.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} morph={once(b.slug)} />)}</Carousel></div>)}</>;
}
```

`src/components/home/LookInside.tsx`:

```tsx
import Link from "next/link";
import Carousel from "../Carousel";
import Cover from "../Cover";
import type { PublicBook } from "../book-data";

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default function LookInside({ books }: { books: PublicBook[] }) {
  const items = books.filter((b) => b.highlights.length).slice(0, 8);
  if (!items.length) return null;
  return <section className="look-band"><div className="wrap section"><Carousel title="Look inside" tagline="A glimpse before you buy">
    {items.map((b) => <Link key={b.slug} href={`/books/${encodeURIComponent(b.slug)}`} className="look-card">
      <span className="look-cover"><Cover src={b.cover} title={b.title} sizes="96px" /></span>
      <span className="look-text"><span className="look-title">{b.title}</span><ul>{b.highlights.slice(0, 3).map((h, i) => <li key={i}>{clip(h)}</li>)}</ul></span>
    </Link>)}</Carousel></div></section>;
}
```

`src/components/home/LanguageStrip.tsx`:

```tsx
import Link from "next/link";
import { LANGUAGE_NATIVE } from "@/lib/languages";

export default function LanguageStrip({ languages }: { languages: { name: string; count: number }[] }) {
  if (languages.length < 2) return null;
  return <section className="wrap section"><div className="section-head reveal"><h2>Read in your language</h2></div>
    <ul className="lang-row">{languages.map((l) => <li key={l.name} className="reveal"><Link className="lang-chip surface surface-hover" href={`/search?language=${encodeURIComponent(l.name)}`}>
      <span className="lang-native">{LANGUAGE_NATIVE[l.name] ?? l.name}</span><span className="eyebrow">{l.name} · {l.count}</span></Link></li>)}</ul></section>;
}
```

`src/components/home/AuthorChips.tsx`:

```tsx
import Link from "next/link";

export default function AuthorChips({ authors }: { authors: { id: string; name: string; photo_url: string | null }[] }) {
  if (!authors.length) return null;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <section className="wrap section"><div className="section-head reveal"><h2>Meet the authors</h2></div>
    <ul className="author-row">{authors.map((a) => <li key={a.id} className="reveal"><Link className="author-chip" href={`/authors/${encodeURIComponent(a.id)}`}>
      <span className="author-face">{a.photo_url ? <img src={a.photo_url} alt="" loading="lazy" /> : <span aria-hidden="true">{initials(a.name)}</span>}</span>
      <span>{a.name}</span></Link></li>)}</ul></section>;
}
```

`src/components/home/PublishBand.tsx`:

```tsx
import Link from "next/link";
import Book3D from "../motion/Book3D";

export default function PublishBand({ covers }: { covers: { slug: string; title: string; cover: string | null }[] }) {
  return <section className="wrap section"><div className="publish-band reveal">
    <div><p className="eyebrow">For authors</p><h2>Publish your book with us</h2>
      <p>Editorial review, fair terms, readers across India.</p>
      <Link className="btn btn-light" href="/publish">Start publishing <span aria-hidden="true">→</span></Link></div>
    <div className="publish-stack" aria-hidden="true">{covers.slice(0, 3).map((c) => <span key={c.slug}><Book3D src={c.cover} title={c.title} sizes="120px" tilt={false} /></span>)}</div>
  </div></section>;
}
```

`src/components/home/FaqGrid.tsx`:

```tsx
const FAQ: [string, string][] = [
  ["How do I get my book?", "Download it right after payment, from your order page or library."],
  ["Do I need an account?", "No. Check out with your email; sign in later to see your library."],
  ["What format are the books?", "Digital editions, usually PDF, licensed for your personal use."],
  ["Can I buy several titles?", "Yes. Add them to your bag and pay once."],
  ["Can I get a refund?", "If a file won't open or isn't as described, we replace or refund it."],
  ["Can I publish here?", "Yes. Submit your book for editorial review from Publish with us."],
];

export default function FaqGrid() {
  return <section id="faq" className="wrap section"><div className="section-head reveal"><h2>Good to know</h2></div>
    <div className="faq-grid">{FAQ.map(([q, a]) => <details key={q} className="faq-item surface reveal"><summary>{q}</summary><p>{a}</p></details>)}</div></section>;
}
```

In `src/lib/home.ts`:
- Remove the `LANGUAGE_GLYPHS` import and the `export { LANGUAGE_FONT, LANGUAGE_GLYPHS, LANGUAGE_NATIVE } from "./languages";` line.
- Change the languages mapping to `.map(([name, count]) => ({ name, count }));`
- Change rail taglines: bestsellers `"Most bought this season"`, new `"Fresh on the shelf"`, offers `"Lower prices, for a while"`, soon `"Wishlist now, read first"`.

`src/app/page.tsx`:

```tsx
import { getPublicContent } from "@/lib/content";
import { bestsellerSlugs, getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { buildHome } from "@/lib/home";
import { siteUrl } from "@/lib/store";
import HeroCampaign from "@/components/home/HeroCampaign";
import CategoryTiles from "@/components/home/CategoryTiles";
import Featured from "@/components/home/Featured";
import LookInside from "@/components/home/LookInside";
import LanguageStrip from "@/components/home/LanguageStrip";
import AuthorChips from "@/components/home/AuthorChips";
import PublishBand from "@/components/home/PublishBand";
import FaqGrid from "@/components/home/FaqGrid";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const now = new Date();
  const [books, categories, content, bestsellers, authors] = await Promise.all([getStoreBooks(now), getCategories(), getPublicContent(), bestsellerSlugs(), getPublishedAuthors()]);
  const home = buildHome({ books, categories, modules: content.modules, bestsellers, authors, now });
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const covers = [...(home.rails.find((r) => r.key === "bestsellers")?.books ?? []), ...books]
    .filter((b, i, all) => b.cover && all.findIndex((x) => x.slug === b.slug) === i).slice(0, 3)
    .map(({ slug, title, cover }) => ({ slug, title, cover }));
  return <>
    <HeroCampaign banners={home.banners} covers={covers} />
    <CategoryTiles tiles={home.categoryTiles.map(({ slug, name, count, covers: c }) => ({ slug, name, count, covers: c }))} />
    <Featured books={books} rails={home.rails} enabled={enabled} />
    <LookInside books={books} />
    <LanguageStrip languages={home.languages} />
    <AuthorChips authors={home.authors} />
    <PublishBand covers={covers} />
    <FaqGrid />
  </>;
}
```

`src/styles/home.css` (full rewrite):

```css
@layer components {
  .hero-campaign { position: relative; isolation: isolate; overflow: hidden; border-bottom: 1px solid var(--line); --px: 0; --py: 0; --sy: 0; }
  .hero-campaign::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background:
    radial-gradient(120% 80% at 12% 0%, rgb(47 122 77 / .14), transparent 55%), radial-gradient(90% 70% at 92% 8%, rgb(185 133 46 / .14), transparent 52%),
    linear-gradient(90deg, var(--bg-2) 0%, rgb(250 250 247 / .93) 44%, rgb(250 250 247 / .35) 100%); }
  .hero-slide[hidden] { display: none; }
  .hero-art { position: absolute; inset: 0; z-index: -2; }
  .hero-art img { width: 100%; height: 100%; object-fit: cover; opacity: .6; filter: saturate(.75) sepia(.12); }
  .hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 520px); align-items: center; gap: 40px; min-height: clamp(480px, 64vh, 660px); padding-block: 56px 76px; }
  .hero-copy h1 { margin-block: 22px 18px; font-size: clamp(40px, 5.6vw, 78px); letter-spacing: -.05em; line-height: .98; }
  .hero-copy > p { max-width: 44ch; color: var(--ink-soft); font-size: 18px; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-block: 30px 26px; }
  .ticks { display: flex; flex-wrap: wrap; gap: 10px 26px; }
  .ticks li { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); font-size: 14px; }
  .ticks svg { flex-shrink: 0; color: var(--brand); }
  .ticks strong { color: var(--ink); font-weight: 500; }
  .hero-stage { position: relative; height: 430px; }
  .hero-cover { position: absolute; width: 38%; transition: transform .9s var(--ease-out); animation: float 7s ease-in-out infinite; }
  .hero-cover.c0 { left: 31%; top: 6%; z-index: 3; transform: translate(calc(var(--px) * 18px), calc(var(--py) * 14px + var(--sy) * -40px)); }
  .hero-cover.c1 { left: 2%; top: 24%; z-index: 2; animation-delay: -2.3s; transform: translate(calc(var(--px) * 30px), calc(var(--py) * 22px + var(--sy) * -70px)) rotate(-7deg); }
  .hero-cover.c2 { right: 0; top: 30%; z-index: 1; animation-delay: -4.6s; transform: translate(calc(var(--px) * 40px), calc(var(--py) * 28px + var(--sy) * -100px)) rotate(7deg); }
  @keyframes float { 50% { translate: 0 -10px; } }
  .hero-controls { position: absolute; bottom: 18px; left: 50%; z-index: 5; display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 999px; translate: -50% 0;
    background: rgb(255 255 255 / .82); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: var(--shadow-e2); }
  .hero-controls .round-btn { width: 36px; height: 36px; box-shadow: none; }
  .hero-dots { display: flex; gap: 6px; padding-inline: 4px; }
  .hero-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: var(--line-2); transition: width .35s var(--ease-out), background .35s; }
  .hero-dots button[aria-current] { width: 24px; background: var(--brand); }
  .tile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px; }
  .cat-tile { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 14px 14px 18px; }
  .cat-fan { position: relative; display: grid; place-items: end center; height: 156px; margin-bottom: 10px; overflow: hidden; }
  .cat-fan span { position: absolute; bottom: -6px; width: 74px; transition: transform .55s var(--ease-out); box-shadow: var(--shadow-e3); }
  .cat-fan span img { display: block; width: 100%; height: auto; border-radius: 3px; }
  .cat-fan span:nth-child(1) { transform: translateX(-44px) rotate(-10deg); }
  .cat-fan span:nth-child(2) { z-index: 2; transform: translateY(-10px); }
  .cat-fan span:nth-child(3) { transform: translateX(44px) rotate(10deg); }
  .cat-tile:hover .cat-fan span:nth-child(1) { transform: translateX(-62px) translateY(-6px) rotate(-15deg); }
  .cat-tile:hover .cat-fan span:nth-child(2) { transform: translateY(-20px); }
  .cat-tile:hover .cat-fan span:nth-child(3) { transform: translateX(62px) translateY(-6px) rotate(15deg); }
  .cat-name { font-size: 17px; font-weight: 500; letter-spacing: -.02em; }
  .look-band { color: var(--cream); background: radial-gradient(70% 90% at 85% 0%, rgb(185 133 46 / .24), transparent 60%), linear-gradient(160deg, var(--forest-2), var(--forest)); }
  .look-band .section-head h2 { color: #fff; }
  .look-band .section-head p { color: #cdb98a; }
  .look-band .round-btn { border-color: var(--forest-line); background: transparent; color: var(--cream); box-shadow: none; }
  .look-band .link-line { color: #e9d8ae; }
  .look-band .carousel-track { grid-auto-columns: minmax(300px, 420px); }
  .look-card { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 18px; height: 100%; padding: 20px; border: 1px solid var(--forest-line); border-radius: 18px; background: rgb(255 255 255 / .04); transition: background .35s, transform .35s var(--ease-out); }
  .look-card:hover { background: rgb(255 255 255 / .08); transform: translateY(-3px); }
  .look-cover img { width: 92px; height: auto; border-radius: 3px; box-shadow: 0 14px 24px -12px rgb(0 0 0 / .6); }
  .look-text { display: grid; align-content: start; gap: 10px; }
  .look-title { color: #fff; font-size: 18px; font-weight: 500; letter-spacing: -.02em; }
  .look-text li { position: relative; padding-left: 16px; color: #d8e4dc; font-size: 14px; line-height: 1.45; }
  .look-text li::before { content: ""; position: absolute; top: .6em; left: 0; width: 6px; height: 6px; border-radius: 999px; background: var(--gold); }
  .lang-row { display: flex; flex-wrap: wrap; gap: 12px; }
  .lang-chip { display: inline-flex; flex-direction: column; gap: 4px; min-width: 150px; padding: 16px 20px; border-radius: 16px; }
  .lang-native { font-size: 24px; letter-spacing: -.02em; }
  .author-row { display: flex; gap: 22px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
  .author-chip { display: grid; justify-items: center; gap: 10px; width: 108px; font-size: 14px; text-align: center; }
  .author-face { display: grid; place-items: center; width: 84px; height: 84px; overflow: hidden; border-radius: 50%; background: var(--bg-3); box-shadow: var(--shadow-e2); font: 500 20px/1 var(--font-mono); color: var(--forest); transition: transform .4s var(--ease-out), box-shadow .4s; }
  .author-face img { width: 100%; height: 100%; object-fit: cover; }
  .author-chip:hover .author-face { transform: translateY(-4px); box-shadow: var(--shadow-e3); }
  .publish-band { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: center; gap: 32px; overflow: hidden; padding: clamp(28px, 5vw, 60px); border-radius: 26px; color: var(--cream);
    background: radial-gradient(60% 120% at 100% 0%, rgb(185 133 46 / .38), transparent 60%), linear-gradient(150deg, var(--forest-2), var(--forest)); }
  .publish-band .eyebrow { color: #cdb98a; }
  .publish-band h2 { margin-top: 10px; color: #fff; font-size: clamp(30px, 3.6vw, 50px); letter-spacing: -.04em; }
  .publish-band p:not(.eyebrow) { margin-block: 12px 26px; color: #cfdcd3; }
  .publish-stack { position: relative; height: 230px; }
  .publish-stack span { position: absolute; bottom: 0; width: 120px; }
  .publish-stack span:nth-child(1) { left: 0; transform: rotate(-9deg); }
  .publish-stack span:nth-child(2) { left: 90px; z-index: 2; bottom: 18px; }
  .publish-stack span:nth-child(3) { left: 180px; transform: rotate(9deg); }
  .faq-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .faq-item summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; font-weight: 500; list-style: none; cursor: pointer; }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::after { content: "+"; color: var(--brand); font: 400 22px/1 var(--font-mono); transition: rotate .3s var(--ease-out); }
  .faq-item[open] summary::after { rotate: 45deg; }
  .faq-item p { padding: 0 22px 20px; color: var(--ink-soft); font-size: 15px; animation: rise .4s var(--ease-out); }
  @media (max-width: 900px) {
    .hero-grid { grid-template-columns: 1fr; gap: 12px; padding-block: 36px 84px; min-height: 0; }
    .hero-stage { height: 290px; }
    .publish-band { grid-template-columns: 1fr; }
    .publish-stack { display: none; }
  }
  @media (max-width: 760px) { .faq-grid { grid-template-columns: 1fr; } }
}
@media (prefers-reduced-motion: reduce) {
  .hero-cover { animation: none; transform: none !important; }
  .cat-fan span, .look-card, .author-face { transition: none; }
}
```

Delete the six retired home components:

```bash
git rm src/components/home/AksharaHero.tsx src/components/home/BannerCarousel.tsx src/components/home/SubjectIndex.tsx src/components/home/LanguageShelf.tsx src/components/home/AuthorStrip.tsx src/components/home/PublishBanner.tsx
```

- [ ] **Step 4: Run tests** — `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test` — Expected: PASS. (If `tsc` reports leftover imports of the deleted files, remove those imports; nothing else should reference them.)

- [ ] **Step 5: Look at it** — preview `/` at 1440 and 390 with the demo catalogue and with only two books; screenshot `scratch/t9-*.png`. Confirm: gradient headline shimmer once, floating covers with parallax, category fans spread on hover, forest Look inside band, gold-glow publish band.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/home src/app/page.tsx src/styles/home.css src/lib/home.ts src/lib/copy.ts src/components/reading-room.test.cjs
git commit -m "Rebuild the homepage in the INVENTAYU theme with short copy and linked motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Product page

**Files:**
- Modify: `src/app/books/[slug]/page.tsx`
- Create: `src/components/product/SampleViewer.tsx`
- Modify (rewrite): `src/styles/product.css`

**Interfaces:**
- Consumes: `Book3D`, `Morph`, `morphName`, `BookCard`, `Carousel`, `Price`, `AddToCart` (`variant="page"`), `BuyNow`, `BookTabs`, `ShareButton`, `WishlistButton`, `RecentlyViewed`.
- Produces: product root `div.product-page[data-book-page]`; `SampleViewer({ href: string; title: string })`.

- [ ] **Step 1: Write the sample viewer**

`src/components/product/SampleViewer.tsx`:

```tsx
"use client";

import { BookOpen, X } from "lucide-react";
import { useRef } from "react";

// Same-site samples open in a lightbox; anything else opens in a new tab.
export default function SampleViewer({ href, title }: { href: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (!href.startsWith("/")) return <a className="btn btn-ghost sample-btn" href={href} target="_blank" rel="noopener noreferrer"><BookOpen size={17} aria-hidden="true" /> Read a sample</a>;
  return <>
    <button type="button" className="btn btn-ghost sample-btn" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog"><BookOpen size={17} aria-hidden="true" /> Read a sample</button>
    <dialog ref={dialog} className="sample-viewer" aria-label={`Sample of ${title}`} onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <button type="button" className="round-btn qv-close" onClick={() => dialog.current?.close()} aria-label="Close sample"><X size={18} aria-hidden="true" /></button>
      <iframe src={href} title={`Sample of ${title}`} />
    </dialog>
  </>;
}
```

- [ ] **Step 2: Rework the page markup** — in `src/app/books/[slug]/page.tsx`:
  - Remove the `LANGUAGE_FONT, LANGUAGE_GLYPHS` import and the `gallery-glyph` span.
  - Import `Book3D` from `@/components/motion/Book3D`, `Morph, { morphName }` from `@/components/motion/Morph`, `SampleViewer` from `@/components/product/SampleViewer`; drop the `Cover` import if unused.
  - Replace the `lucide-react` import with `import { BadgeCheck, BookOpen, Building2, Download, FileText, Globe2, Hash, Infinity as Lifetime, Layers, Lock } from "lucide-react";` (unchanged set; keep it if identical).
  - Replace everything from `<div className="product-page">` to the end of the returned JSX with:

```tsx
  return <div className="product-page" data-book-page>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(bookJsonLd(book, url, view.saleable, now)) }} />
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span>{category && <><Link href={`/category/${category.slug}`}>{category.name}</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{book.title}</span></nav>
      <article className="product-main">
        <div className="product-gallery">
          <div className="gallery-stage plate surface-lit"><Morph name={morphName(book.slug)}><Book3D src={book.cover} title={book.title} sizes="(max-width: 900px) 70vw, 320px" priority /></Morph></div>
          {sample && <SampleViewer href={sample} title={book.title} />}
        </div>
        <div className="product-info enter">
          <div className="title-row"><h1>{book.title}</h1><div className="title-actions"><WishlistButton slug={book.slug} title={book.title} variant="page" /><ShareButton title={book.title} url={url} /></div></div>
          {book.subtitle && <p className="product-subtitle">{book.subtitle}</p>}
          {book.authorship && <p className="product-author">by {book.author_slug ? <Link href={`/authors/${encodeURIComponent(book.author_slug)}`}>{book.authorship}</Link> : book.authorship}</p>}
          <ul className="tag-row">{category && <li><Link className="chip" href={`/category/${category.slug}`}>{category.name}</Link></li>}
            {view.language && <li><Link className="chip" href={`/search?language=${encodeURIComponent(view.language)}`}>{view.language}</Link></li>}
            {book.file_format && <li><span className="chip">{book.file_format}</span></li>}
            {book.pages && <li><span className="chip">{book.pages} pages</span></li>}</ul>
          <div className="buy-panel surface surface-lit">
            <Price book={view} size="page" />
            <div className="buy-row"><BuyNow slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} />
              <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} saveable={view.saveable} variant="page" /></div>
            {!enabled && <p className="notice">Ordering opens soon. Save it to your bag.</p>}
            <ul className="ticks">{[[Download, "Instant download"], [Lock, "Secure payment"], [BadgeCheck, "Licensed to you"], [Lifetime, "Lifetime library"]].map(([Icon, label]) =>
              <li key={label as string}><Icon size={16} aria-hidden="true" /><span>{label as string}</span></li>)}</ul>
          </div>
          <dl className="detail-strip">{details.filter(([, , v]) => v).map(([Icon, label, value]) => <div key={label}><dt><Icon size={14} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}</dl>
        </div>
      </article>
      <BookTabs tabs={tabs} />
      {byAuthor.length > 0 && <div className="section"><Carousel title={`More by ${book.authorship}`}>{byAuthor.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>}
      {similar.length > 0 && <div className="section"><Carousel title="Similar books" href={category ? `/category/${category.slug}` : "/search"}>{similar.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>}
      <RecentlyViewed current={book.slug} />
    </div>
  </div>;
```

  - In the `tabs` array change the details tab content's `className="spec-table"` to `className="catalogue"`.

- [ ] **Step 3: Rewrite `src/styles/product.css`**

```css
@layer components {
  .product-page { padding-bottom: 40px; background: linear-gradient(180deg, var(--bg) 0, var(--bg-2) 380px); }
  .crumbs { display: flex; flex-wrap: wrap; gap: 8px; padding-block: 18px; font: 400 11px/1.5 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); }
  .crumbs a:hover { color: var(--brand); }
  .product-main { display: grid; grid-template-columns: minmax(0, 440px) minmax(0, 1fr); gap: 32px 56px; align-items: start; }
  .product-gallery { position: sticky; top: 130px; display: grid; gap: 14px; }
  .gallery-stage { display: grid; place-items: center; padding: 48px 40px 56px; border: 1px solid var(--line); border-radius: 22px; }
  .gallery-stage .book3d { width: min(300px, 80%); }
  .sample-btn { justify-self: center; }
  .product-info { display: flex; flex-direction: column; gap: 16px; min-width: 0; padding-top: 6px; }
  .title-row { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
  .product-info h1 { font-size: clamp(32px, 4.2vw, 58px); letter-spacing: -.05em; line-height: 1; }
  .title-actions { display: flex; flex-shrink: 0; gap: 8px; }
  .product-subtitle { color: var(--ink-soft); font-size: 19px; }
  .product-author a { color: var(--brand); border-bottom: 1px solid currentColor; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .buy-panel { display: grid; gap: 18px; padding: 24px; }
  .buy-row { display: flex; flex-wrap: wrap; gap: 12px; }
  .buy-row > .btn, .buy-row .cart-control .btn { min-width: 190px; width: auto; }
  .notice { padding: 10px 14px; border-radius: 12px; background: #f6ecd9; color: #6b4a12; font-size: 14px; }
  .detail-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: var(--line); }
  .detail-strip div { padding: 14px 16px; background: var(--bg); }
  .detail-strip dt { display: flex; align-items: center; gap: 6px; font: 500 10px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); }
  .detail-strip dd { margin-top: 4px; font-size: 15px; font-weight: 500; overflow-wrap: anywhere; }
  .book-tabs { margin-top: 56px; }
  .tab-list { display: flex; gap: 4px; width: fit-content; max-width: 100%; padding: 4px; overflow-x: auto; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); box-shadow: var(--shadow-e1); }
  .tab-list button { padding: 10px 18px; border: 0; border-radius: 999px; background: none; font: 500 11px/1 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); white-space: nowrap; transition: background .3s var(--ease-out), color .3s; }
  .tab-list button[aria-selected="true"] { background: var(--forest); color: var(--cream); }
  .tab-panel { max-width: 76ch; padding: 28px 4px; animation: rise .5s var(--ease-out); }
  .prose p { margin-bottom: 16px; color: var(--ink-soft); line-height: 1.7; }
  .contents-list { display: grid; gap: 12px; counter-reset: item; }
  .contents-list li { display: grid; grid-template-columns: 40px 1fr; counter-increment: item; }
  .contents-list li::before { content: counter(item, decimal-leading-zero); color: var(--gold); font: 500 12px/1.9 var(--font-mono); }
  .sample-viewer { width: min(920px, 94vw); height: min(86vh, 1000px); padding: 0; border: 0; border-radius: 18px; background: var(--bg); box-shadow: var(--shadow-e4); }
  .sample-viewer[open] { animation: pop .35s var(--ease-out); }
  .sample-viewer::backdrop { background: rgb(11 36 22 / .45); }
  .sample-viewer iframe { width: 100%; height: 100%; border: 0; }
  @media (max-width: 900px) {
    .product-main { grid-template-columns: 1fr; }
    .product-gallery { position: static; }
    .gallery-stage { padding: 28px; }
  }
}
```

- [ ] **Step 4: Run tests** — `npx tsc --noEmit --incremental false && npm test` — Expected: PASS.

- [ ] **Step 5: Look at it** — in Chromium on the preview, open `/search`, click a cover: the cover should glide into the product page cover (the shared-element morph); press Back: it glides back. Screenshot the product page at 1440 and 390 to `scratch/t10-*.png`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/books/[slug]/page.tsx" src/components/product/SampleViewer.tsx src/styles/product.css
git commit -m "Product page in the INVENTAYU theme with the morphing cover and a sample lightbox

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Search and category listing

**Files:**
- Modify: `src/components/Listing.tsx` (banner markup only)
- Modify (rewrite): `src/styles/listing.css`

**Interfaces:**
- Consumes: `BookCard` (morph defaults true; each book appears once per listing page).

- [ ] **Step 1: Update the banner markup** — in `src/components/Listing.tsx` replace the `listing-banner` div with:

```tsx
    <div className="listing-banner" style={{ ["--tile" as string]: banner?.colour ?? "var(--brand)" }}>
      <div className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav>
        <h1 className="enter">{title}</h1>{intro && <p>{intro}</p>}{children}</div>
      {banner?.image && <img src={banner.image} alt="" className="listing-art" />}
    </div>
```

  and replace the sort `<span>Sort by</span>` with `<span className="eyebrow">Sort</span>`.

- [ ] **Step 2: Rewrite `src/styles/listing.css`**

```css
@layer components {
  .listing-banner { position: relative; overflow: hidden; padding-block: 8px 36px; border-bottom: 1px solid var(--line); background:
    radial-gradient(90% 140% at 100% 0%, color-mix(in srgb, var(--tile) 20%, transparent), transparent 60%), radial-gradient(120% 80% at 0% 0%, rgb(47 122 77 / .08), transparent 55%), var(--bg); }
  .listing-banner h1 { font-size: clamp(34px, 4.6vw, 64px); letter-spacing: -.05em; line-height: 1; }
  .listing-banner p { max-width: 56ch; margin-top: 10px; color: var(--ink-soft); }
  .listing-art { position: absolute; right: 4%; bottom: -24px; width: 220px; opacity: .9; }
  .subcategory-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .listing-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); align-items: start; gap: 36px; padding-block: 32px; }
  .filters { position: sticky; top: 130px; display: grid; gap: 18px; }
  .filter-group summary { padding-block: 6px; font: 500 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); list-style: none; cursor: pointer; }
  .filter-group summary::-webkit-details-marker { display: none; }
  .filter-group ul { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 6px; }
  .filter-option { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 4px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); font-size: 13px; transition: border-color .2s, background .2s, color .2s; }
  .filter-option:hover { border-color: var(--ink-soft); }
  .filter-option[aria-current] { background: var(--forest); border-color: var(--forest); color: var(--cream); }
  .filter-option .check { display: none; }
  .filter-option .count { font: 500 10px/1 var(--font-mono); color: var(--ink-mute); }
  .filter-option[aria-current] .count { color: #cdb98a; }
  .results-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 16px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
  .results-bar > p { font: 500 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); }
  .sort-row { display: inline-flex; align-items: center; gap: 2px; max-width: 100%; padding: 3px 3px 3px 12px; overflow-x: auto; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); box-shadow: var(--shadow-e1); }
  .sort-row .chip { border: 0; background: transparent; }
  .sort-row .chip[aria-current] { background: var(--forest); color: var(--cream); }
  .active-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 18px; }
  .clear-link { font: 500 11px/1.4 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--brand); border-bottom: 1px solid currentColor; }
  .empty-results { display: grid; justify-items: center; gap: 12px; padding: 56px 24px; border: 1px dashed var(--line-2); border-radius: 20px; text-align: center; }
  .empty-results h2 { font-size: 26px; }
  .pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 32px; font: 500 11px/1 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
  @media (max-width: 900px) {
    .listing-layout { grid-template-columns: 1fr; }
    .filters { position: static; }
    .filter-group ul { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
    .listing-art { display: none; }
  }
}
```

- [ ] **Step 3: Run tests** — `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test` — Expected: PASS (`Remove filter EPUB` and `No books match these filters` still match).

- [ ] **Step 4: Look at it** — preview `/search` and a category; toggle a facet in Chromium: matching cards glide to their new positions (each card's cover has its own morph name). Screenshot `scratch/t11-*.png`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Listing.tsx src/styles/listing.css
git commit -m "Listing pages in the INVENTAYU theme with mono facets and gliding results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Bag, checkout, wishlist, library, login, publish and admin surfaces

**Files:**
- Create: `src/styles/account.css`
- Modify: `src/app/globals.css` (import `account.css`; delete the two legacy `@layer components` blocks and the media queries after the `@theme` block, keeping only `.small`, `.muted`, `.preserve-lines`, `.title`, `.title-lg`, `.title-md` utilities used by admin)
- Modify: `src/app/checkout/page.tsx` (step indicator), `src/app/checkout/CheckoutForm.tsx` (summary thumbnails), `src/app/cart/CartContents.tsx` (cover via `Cover`), `src/app/publish/page.tsx` (copy and markup), `src/app/wishlist/page.tsx` (copy)
- Modify: `src/components/CartDrawer.tsx` (loading skeleton)

**Interfaces:**
- Consumes: tokens, surface classes, `Cover`.

- [ ] **Step 1: Checkout step indicator and summary covers**

In `src/app/checkout/page.tsx` replace the `page-heading` div with:

```tsx
  return <div className="wrap section"><div className="page-heading"><h1>Checkout</h1>
    <ol className="checkout-steps" aria-label="Checkout steps"><li aria-current="step">Your details</li><li>Secure payment</li><li>Download</li></ol></div>
```

In `src/app/checkout/CheckoutForm.tsx` import `Cover from "@/components/Cover"` and change each summary line to:

```tsx
<div className="summary-line with-cover" key={book.slug}><span className="summary-cover"><Cover src={book.cover} title={book.title} sizes="40px" /></span><span>{book.title}</span><span>{book.saleable && book.price > 0 ? rupees(book.price) : "Not yet on sale"}</span></div>
```

In `src/app/cart/CartContents.tsx` replace the `Image` element inside the first `Link` with `<Cover src={book.cover} title={book.title} sizes="88px" />` (import `Cover`; remove the `next/image` import).

In `src/app/publish/page.tsx` replace the returned JSX with:

```tsx
  return <div className="wrap page-shell">
    <section className="publish-band reveal"><div><p className="eyebrow">For authors</p><h1>Publish your digital edition</h1>
      <p>Editorial review, fair terms, readers across India.</p>
      <Link className="btn btn-light" href={start}>{reader ? "Open your workspace" : "Sign in to start"} <span aria-hidden="true">→</span></Link></div></section>
    <section className="section"><div className="section-head"><h2>How it works</h2></div>
      <ol className="steps">{["Create your profile", "Upload files", "Editorial and rights review", "Release and sell"].map((s) => <li key={s} className="surface reveal">{s}</li>)}</ol></section>
    <section className="section"><div className="section-head"><h2>What we accept</h2></div>
      <ul className="entry-chips">{["PDF or EPUB", "Your own work or digital rights", "Cover 1600px tall or more", "Optional free sample"].map((s) => <li key={s} className="chip">{s}</li>)}</ul>
      <p className="tax-note">Approval alone does not release a title; rights, terms and clean files are required. <Link className="text-link" href="/terms">Terms</Link></p></section>
  </div>;
```

In `src/app/wishlist/page.tsx` change the heading block to `<div className="page-heading"><h1>Your wishlist</h1><p>Saved for later.</p></div>`.

In `src/components/CartDrawer.tsx` replace the loading branch `<p className="drawer-note" role="status">Loading your bag…</p>` with a skeleton:

```tsx
<ul className="drawer-lines" aria-busy="true">{[0, 1].map((i) => <li key={i} className="skeleton-row"><span className="skeleton skeleton-cover" /><span className="skeleton skeleton-line" /></li>)}
  <li className="sr-only" role="status">Loading your bag</li></ul>
```

Transactional emails need no change: `src/lib/email.ts` `BRAND` already uses the theme values (`#0A0E0C`, `#2F7A4D`, `#B9852E`, `#FAFAF7`, `#E8E6DD`); confirm by reading it.

- [ ] **Step 2: Write `src/styles/account.css`**

```css
@layer components {
  .page-shell { padding-block: 32px 56px; }
  .page-heading { margin-bottom: 28px; }
  .page-heading h1 { font-size: clamp(32px, 4.4vw, 56px); letter-spacing: -.05em; line-height: 1; }
  .page-heading p { margin-top: 10px; color: var(--ink-soft); }
  .panel { padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--bg); box-shadow: var(--shadow-e2); }
  .card { padding: 28px; border: 1px solid var(--line); border-radius: 18px; background: var(--bg); }
  .empty-state { display: grid; justify-items: center; gap: 12px; padding: 56px 24px; border: 1px dashed var(--line-2); border-radius: 20px; text-align: center; color: var(--ink-soft); }
  .empty-state h2, .empty-state h1 { color: var(--ink); font-size: 28px; }
  .breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; font: 400 11px/1.5 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); }
  .cart-layout, .checkout-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); align-items: start; gap: 28px; }
  .cart-row { display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; align-items: center; gap: 18px; margin-bottom: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 18px; background: var(--bg); box-shadow: var(--shadow-e1); animation: rise .45s var(--ease-out) backwards; }
  .cart-row img { width: 76px; height: auto; border-radius: 3px; filter: drop-shadow(0 8px 14px rgb(12 38 24 / .18)); }
  .cart-row h2 { font-size: 18px; letter-spacing: -.02em; }
  .icon-button { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-soft); }
  .icon-button:hover { background: var(--bg-2); color: var(--danger); }
  .order-summary { position: sticky; top: 130px; padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--bg); box-shadow: var(--shadow-e2); }
  .order-summary h2 { margin-bottom: 14px; font-size: 20px; }
  .summary-line { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-block: 10px; border-bottom: 1px dotted var(--line-2); font-size: 14px; }
  .summary-line.with-cover { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; }
  .summary-cover img { width: 40px; height: auto; border-radius: 2px; box-shadow: var(--shadow-e2); }
  .summary-total { border-bottom: 0; font-size: 18px; font-weight: 600; }
  .order-summary > .btn, .checkout-form > .btn { width: 100%; margin-top: 16px; }
  .checkout-steps { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; counter-reset: step; }
  .checkout-steps li { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); counter-increment: step; font: 500 11px/1 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); }
  .checkout-steps li::before { content: counter(step); display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: var(--bg-3); color: var(--ink); }
  .checkout-steps li[aria-current] { border-color: var(--forest); color: var(--ink); }
  .checkout-steps li[aria-current]::before { background: var(--forest); color: var(--cream); }
  .checkout-form { display: grid; gap: 18px; padding: 26px; border: 1px solid var(--line); border-radius: 20px; background: var(--bg); box-shadow: var(--shadow-e2); }
  .checkout-policy { font-size: 12px; color: var(--ink-mute); }
  .checkout-policy a, .underline { text-decoration: underline; text-underline-offset: 3px; }
  .purchase-paused { padding: 12px 14px; border-radius: 12px; background: #f6ecd9; color: #6b4a12; font-size: 14px; }
  .steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; counter-reset: step; }
  .steps li { padding: 20px; counter-increment: step; font-weight: 500; }
  .steps li::before { content: counter(step, decimal-leading-zero); display: block; margin-bottom: 14px; color: var(--gold); font: 500 12px/1 var(--font-mono); }
  .tax-note { margin-top: 18px; font-size: 13px; color: var(--ink-mute); }
  .prose-legal { max-width: 75ch; }
  .prose-legal h2 { margin-block: 28px 10px; font-size: 22px; }
  .prose-legal p, .prose-legal li { margin-bottom: 12px; color: var(--ink-soft); line-height: 1.7; }
  .prose-legal ul { padding-left: 20px; list-style: disc; }
  .author-hero { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 36px; padding-bottom: 32px; border-bottom: 1px solid var(--line); }
  .author-hero:not(:has(img)) { grid-template-columns: 1fr; }
  .author-hero h1 { margin-block: 8px 14px; font-size: clamp(34px, 4.4vw, 56px); letter-spacing: -.05em; }
  .author-photo { width: 180px; height: 180px; border-radius: 50%; object-fit: cover; box-shadow: var(--shadow-e3); }
  .section-title { margin-bottom: 20px; font-size: 28px; }
  .publish-band h1 { margin-top: 10px; color: #fff; font-size: clamp(30px, 3.8vw, 52px); letter-spacing: -.045em; }
  .skeleton { display: block; border-radius: 6px; background: linear-gradient(90deg, var(--bg-3) 0%, #f6f4ee 50%, var(--bg-3) 100%); background-size: 200% 100%; animation: skeleton 1.2s linear infinite; }
  .skeleton-row { display: grid !important; grid-template-columns: 52px minmax(0, 1fr); }
  .skeleton-cover { width: 52px; height: 74px; }
  .skeleton-line { height: 14px; align-self: center; }
  @keyframes skeleton { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (max-width: 900px) {
    .cart-layout, .checkout-layout { grid-template-columns: 1fr; }
    .order-summary { position: static; }
    .checkout-layout .order-summary { order: -1; }
    .steps { grid-template-columns: 1fr 1fr; }
    .author-hero { grid-template-columns: 1fr; }
  }
}
```

In `src/app/globals.css`: add `@import "../styles/account.css";` after the `product.css` import; delete everything after the `@theme { ... }` block and replace it with:

```css
@layer components {
  .small { font-size: 13px; }
  .muted, .subtitle { color: var(--ink-soft); }
  .preserve-lines { white-space: pre-line; }
  .title { font-weight: 500; letter-spacing: -.035em; line-height: 1.02; }
  .title-lg { font-size: clamp(26px, 3vw, 40px); }
  .title-md { font-size: clamp(20px, 2.1vw, 27px); letter-spacing: -.025em; }
  .price { font-size: 22px; font-weight: 600; white-space: nowrap; }
  .gold-rule { height: 2px; width: 44px; border: 0; background: var(--gold); }
  .text-danger { color: var(--danger); }
}
```

- [ ] **Step 3: Run tests** — `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test` — Expected: PASS (`Your next chapter starts here.`, `Checkout unavailable`, `Payment unavailable` assertions unchanged).

- [ ] **Step 4: Look at it** — preview `/cart`, `/checkout`, `/wishlist`, `/library` (redirect to login), `/login`, `/publish`, `/admin/login`; screenshot `scratch/t12-*.png` at 1440 and 390.

- [ ] **Step 5: Commit**

```bash
git add src/styles/account.css src/app/globals.css src/app/checkout src/app/cart/CartContents.tsx src/app/publish/page.tsx src/app/wishlist/page.tsx src/components/CartDrawer.tsx
git commit -m "Theme the bag, checkout steps, wishlist, account, publish and admin surfaces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Remove the leftovers and extend the browser checks

**Files:**
- Modify: `src/styles/tokens.css` (delete the transitional alias lines and the `.akshara` rule)
- Modify: `src/app/layout.tsx` (delete the six Noto imports)
- Modify: `src/lib/languages.ts` (delete `LANGUAGE_GLYPHS` and `LANGUAGE_FONT`; keep `LANGUAGE_NATIVE`)
- Modify: any file still using `--neel`, `--kumkum`, `--paper`, `--mist`, `--muted`, `--font-head`, `--font-body`, `akshara`, `LANGUAGE_FONT`, `LANGUAGE_GLYPHS` (find with the grep below)
- Modify: `package.json` / `package-lock.json` (uninstall Noto packages)
- Modify: `scripts/check-browser.mjs`, `src/components/reading-room.test.cjs`, `DESIGN.md`

- [ ] **Step 1: Add the leftover guard test** — append to `src/components/reading-room.test.cjs` at module scope (after the token assertions):

```js
const styleSources = fs.readdirSync(path.join(root, "styles")).map((f) => fs.readFileSync(path.join(root, "styles", f), "utf8")).join("\n")
  + fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
assert.doesNotMatch(styleSources, /--neel|--kumkum|--paper|--mist|--font-head|--font-body|akshara|Bricolage|Mukta|Noto/, "no Akshara-era styles remain");
assert.doesNotMatch(fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"), /noto-sans/);
```

- [ ] **Step 2: Run to verify it fails** — `node src/components/reading-room.test.cjs` — Expected: FAIL `no Akshara-era styles remain`.

- [ ] **Step 3: Remove the leftovers**

Run: `npm uninstall @fontsource/noto-sans-bengali @fontsource/noto-sans-devanagari @fontsource/noto-sans-gujarati @fontsource/noto-sans-kannada @fontsource/noto-sans-tamil @fontsource/noto-sans-telugu`

Delete the Noto import lines (and their comment) from `src/app/layout.tsx`; delete the alias block and the `.akshara` rule from `src/styles/tokens.css`; delete `LANGUAGE_GLYPHS` and `LANGUAGE_FONT` from `src/lib/languages.ts`.

Find remaining uses and replace each with the theme token (`--neel`→`--brand`, `--neel-deep`→`--brand-deep`, `--kumkum`→`--gold`, `--paper`/`--card`→`--bg`, `--mist`/`--page`→`--bg-2`, `--muted`→`--ink-soft`, `--font-head`/`--font-body`→`--font-sans`) or delete the dead markup:

```bash
grep -rnE "\-\-neel|\-\-kumkum|\-\-paper|\-\-mist|\-\-muted|\-\-font-head|\-\-font-body|\-\-card|\-\-page|akshara|LANGUAGE_FONT|LANGUAGE_GLYPHS" src
```

Expected after edits: no output.

- [ ] **Step 4: Extend `scripts/check-browser.mjs`** — in the `route === '/'` block replace the hero and reduced-motion assertions with:

```js
          const hero = await page.locator('.hero-campaign h1').first().boundingBox();
          if (!hero || hero.y >= (width < 768 ? 800 : 1000)) failures.push(`${name}: no first-viewport hero at ${width}`);
          if (!(await page.locator('.hero-campaign .hero-cover').count())) failures.push(`${name}: hero has no covers at ${width}`);
          assert.equal(await page.locator('.hero-controls [aria-label="Pause slides"]').count(), 0, `${name}: reduced motion shows no autoplay control`);
          await page.locator('[data-book-card]').first().hover();
          await page.waitForTimeout(300);
          assert.ok(await page.locator('[data-book-card]').first().evaluate(el => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(el).transform)), `${name}: reduced motion respected`);
          const copy = await page.locator('main').evaluate(el => el.innerHTML);
          const { copyViolations } = await import('../src/lib/copy.ts');
          for (const v of copyViolations(copy)) failures.push(`${name}: homepage copy ${v}`);
          await page.mouse.move(0, 0);
```

and before the browser is closed (after the route loop, inside the engine loop), add a motion check that runs with motion allowed, Chromium only:

```js
    if (name === 'chromium') {
      const moving = await browser.newContext({ reducedMotion: 'no-preference' });
      const live = await moving.newPage();
      await live.goto(base + '/search', { waitUntil: 'networkidle' });
      assert.ok(await live.evaluate(() => typeof document.startViewTransition === 'function'), 'view transitions available in Chromium');
      const add = live.locator('[data-book-card] button.card-add:not([disabled])').first();
      if (await add.count()) {
        await add.click();
        await expect.poll(() => live.evaluate(() => [...document.querySelectorAll('body > img[aria-hidden="true"]')].some(i => i.style.position === 'fixed')), { timeout: 2000 }).toBeTruthy();
      }
      await live.locator('[data-book-card] .card-title a').first().click();
      await live.waitForURL(/\/books\//);
      await expect(live.locator('.product-page .book3d').first()).toBeVisible();
      await moving.close();
    }
```

Run `scripts/check-browser.mjs` with `node --import tsx` from now on (it imports a `.ts` module): update the `test:browser` script in `package.json` to `"node --import tsx scripts/check-browser.mjs"`.

- [ ] **Step 5: Update `DESIGN.md`** — replace its Direction, Design Decisions and Shopping Sequence sections with a summary of this spec: base theme `65f7044`; the governing rule; tokens; Book3D/morph/fly motion; scaling rule (<5 titles → catalogue cards); what was removed.

- [ ] **Step 6: Run everything**

Run: `node src/components/reading-room.test.cjs && npx tsc --noEmit --incremental false && npm test`
Then with `npm run preview:isolated -- 3100` running in another terminal: `BROWSERS=chromium npm run test:browser`, then `BROWSERS=firefox,webkit npm run test:browser`.
Expected: all pass. If the known checkout timing flake appears once, rerun; report it if it repeats.

- [ ] **Step 7: Screenshot review** — capture `/`, `/search`, a product page, `/cart`, `/checkout`, `/library`→login and `/admin/login` at 390 and 1440 (demo catalogue) plus `/` with two books, into `scratch/final-*.png`; compare side by side with `scratch/old-65f7044-home-1440.jpg`. Share them with the user before declaring the visual work done.

- [ ] **Step 8: Commit**

```bash
git add -A src package.json package-lock.json scripts/check-browser.mjs DESIGN.md
git commit -m "Remove Akshara leftovers; browser checks cover copy length, morph and the bag flight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Ship

**Files:** none beyond the PR.

- [ ] **Step 1:** Confirm Task 3 is complete (`check-live` all PASS on the current production deployment, or the user accepts shipping before that).
- [ ] **Step 2:** Push the branch and open a PR to `main` titled "INVENTAYU theme rebuild and live readiness" listing the screenshots and the checklist status. Do not merge; the user merges and Vercel deploys.
- [ ] **Step 3:** After the user's deploy, run `node scripts/check-live.mjs https://<site>` again and report the result.
