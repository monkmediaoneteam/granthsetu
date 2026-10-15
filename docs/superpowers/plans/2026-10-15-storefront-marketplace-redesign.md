# Storefront Marketplace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Reading Room into a Crossword/Bookswagon-style multi-category digital book marketplace with a working admin, admin-managed banners and per-title offers that flow through server-priced checkout.

**Architecture:** Additive migration `007-marketplace.sql` adds categories, sale fields, release dates, a wishlist table and module end dates. One pricing function (`currentPrice`) feeds every display surface and the checkout route. Pure, unit-tested modules (`listing.ts`, `search.ts`, `money.ts`) hold the logic; pages and client components stay thin. The isolated preview is seeded with a 60-title demo catalogue so the design is built and reviewed at marketplace scale.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before using an unfamiliar API), React 19, TypeScript, Tailwind 4 + plain CSS files, PGlite for isolated/offline databases, Neon in production, Better Auth magic links, Razorpay Payment Links, Resend, lucide-react, motion, Playwright + axe for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-15-storefront-marketplace-redesign-design.md`

## Global Constraints

- Digital-only, INR, money in integer paise; never floats for stored money.
- Checkout stays server-priced; order items are immutable snapshots; payment validation keeps comparing against the stored `orders.total`.
- No fabricated reviews, ratings, bestseller claims or testimonials. "Bestsellers" = real paid/fulfilled orders, last 90 days.
- Real covers are never altered; demo covers and demo rows exist only in the isolated preview (`facts._demo = 'true'`).
- Migrations are additive and idempotent (they re-run on every apply): `if not exists`, guarded `do $$ … $$` blocks; nothing dropped or renamed.
- Every mutating route: `checkOrigin(req)` first, then `isAdmin()` / `getReader()`, bounded body via `readLimitedForm`/`readLimitedBody`, audit row for admin writes.
- Struck-through price = the title's genuine regular `price_inr`; sale price must be `> 0` and `< price_inr` (DB constraint).
- Type: Plus Jakarta Sans (headings 700–800) and Inter (text, prices) via `@fontsource-variable/*`; no serif anywhere.
- Colours: header/buttons/footer yellow `#FFD93D`, ink `#111111`, page `#F7F7F7`, offer pill green `#16A34A` on `#DCFCE7`, sale panel coral `#F04E37`.
- Copy: sentence case, short retail voice, never names a specific book in site-wide copy.
- Motion only on hover/press/drawer/carousel; all disabled under `prefers-reduced-motion: reduce`; banner autoplay 6s with a visible pause button.
- Environment gotcha: shell heredocs and the Edit tool here rewrite backslash-u escapes. Never write a backslash-u escape in source; use `String.fromCharCode(…)` and check bytes after writing (`python -c "print([hex(ord(c)) for c in open(p,encoding='utf8').read() if ord(c)>127][:5])"`).
- Run after every task: `npm test` and `npx tsc --noEmit --incremental false`. Both must pass before commit.
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Sale window boundaries at checkout:** a sale ending at `2026-10-20T00:00:00+05:30` must not apply at that instant (end is exclusive) and must apply one millisecond before; times compare as absolute instants, not local dates. Pinned in Task A3 and Task C6.
2. **Price shown vs charged when a sale ends mid-session:** the cart drawer and checkout page must re-read server prices; the order snapshot records the price at order creation and retries with the same idempotency key keep it. Pinned in Task C6.
3. **Wishlist with archived or deleted books:** merge silently drops slugs that are not visible books; the wishlist page never 500s on an archived title. Pinned in Task C2.
4. **Search suggestions with hostile input:** `q` of 1 char, 500 chars, `%`, `_`, `'`, `<script>` returns 200 with escaped JSON or an empty result, never an error or SQL wildcard expansion. Pinned in Task C1.
5. **Banner carousel with zero or one slide and reduced motion:** zero slides renders nothing, one slide renders no arrows/dots/pause, reduced motion never autoplays. Pinned in Task B4.

---

# Part A — Admin and data

### Task A1: Local admin access in the isolated preview

**Already done (do not repeat):** development magic links shipped in commit `4e22a14`. `src/lib/auth.ts` exports `deliverMagicLink(email: string, url: string): Promise<void>` (positional arguments). Outside production it `console.info`s `[auth] Development sign-in link for <email>: <url>` and swallows a missing `RESEND_API_KEY` or a rejected Resend response with a `console.warn`; in production it never logs the link and throws when the key is missing or delivery fails. Its test is `scripts/test-magic-link.mjs`, registered in `scripts/test-all.mjs` after `scripts/test-auth.mjs`. `.claude/launch.json` has a `dev` entry (`npm run dev`, port 3000) next to `isolated-preview`. No later task calls `deliverMagicLink`.

This task only makes admin reachable in the isolated preview, which currently blanks `ADMIN_TOKEN` and `ADMIN_EMAIL`.

**Files:**
- Modify: `scripts/dev-preview.mjs`

**Interfaces:**
- Produces: the preview prints `Admin token (this run only): <64 hex>` and honours an `ADMIN_TOKEN` env override (used by Task A10's `scripts/check-admin.mjs`).

- [ ] **Step 1: Implement**

In `scripts/dev-preview.mjs` (`randomBytes` is already imported), before `spawn`, add:

```js
const adminToken = process.env.ADMIN_TOKEN || randomBytes(32).toString('hex');
if (!/^[a-f0-9]{64}$/.test(adminToken)) throw new Error('ADMIN_TOKEN for the preview must be 64 lowercase hex characters.');
```

Change `ADMIN_TOKEN: ''` to `ADMIN_TOKEN: adminToken` in the spawned environment (leave `ADMIN_EMAIL: ''`). After the existing `console.log`, add:

```js
console.log(`Admin token (this run only): ${adminToken}  ->  http://localhost:${port}/admin/login`);
console.log('Sign-in links are printed in this terminal because email is disabled.');
```

- [ ] **Step 2: Verify**

Run: `npm test && npx tsc --noEmit --incremental false`
Expected: PASS (including the existing `scripts/test-magic-link.mjs`).

Run `npm run preview:isolated -- 3100` in the background. Expected: the terminal prints `Admin token (this run only): <64 hex>`. Open `http://localhost:3100/admin/login`, paste the token, sign in. Expected: redirected to `/admin`. Then run `ADMIN_TOKEN=abc npm run preview:isolated -- 3101`. Expected: it exits with "ADMIN_TOKEN for the preview must be 64 lowercase hex characters."

- [ ] **Step 3: Commit**

```bash
git add scripts/dev-preview.mjs
git commit -m "Print a per-run admin token in the isolated preview"
```

---

### Task A2: Migration 007 (categories, offers, release dates, wishlist, module end dates)

**Files:**
- Create: `migrations/007-marketplace.sql`
- Create: `scripts/test-marketplace-db.mjs`
- Modify: `scripts/test-all.mjs`
- Modify: `src/lib/db.ts` (Book type)

**Interfaces:**
- Produces tables/columns used by every later task: `categories(slug, name, parent_slug, image_url, colour, sort, status)`, `books.category_slug`, `books.sale_price_inr`, `books.sale_starts_at`, `books.sale_ends_at`, `books.release_date`, `wishlist(reader_id, book_slug, created_at)`, `content_modules.ends_at`, module types `announcement`, `promo`, `genre-switcher`.
- Produces `Book` type fields: `category_slug?: string | null; sale_price_inr?: number | null; sale_starts_at?: string | null; sale_ends_at?: string | null; release_date?: string | null;`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-marketplace-db.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const apply = async () => {
  await db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort())
    await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
};
try {
  await apply();
  await db.query(`insert into books(slug,title,price_inr,subject) values('legacy','Legacy',10000,'Research methodology')`);
  await apply(); // idempotent re-run copies subjects again without duplicates
  const category = (await db.query(`select slug,name from categories where slug='research-methodology'`)).rows[0];
  assert.deepEqual(category, { slug: 'research-methodology', name: 'Research methodology' });
  assert.equal((await db.query(`select category_slug from books where slug='legacy'`)).rows[0].category_slug, 'research-methodology');

  await db.query(`update books set sale_price_inr=5000 where slug='legacy'`);
  for (const bad of [0, 10000, 15000]) await assert.rejects(db.query(`update books set sale_price_inr=${bad} where slug='legacy'`));
  await assert.rejects(db.query(`update books set sale_starts_at='2026-10-20', sale_ends_at='2026-10-19' where slug='legacy'`));

  await db.query(`insert into wishlist(reader_id,book_slug) values('r1','legacy')`);
  await assert.rejects(db.query(`insert into wishlist(reader_id,book_slug) values('r1','legacy')`));
  await assert.rejects(db.query(`insert into wishlist(reader_id,book_slug) values('r1','missing')`));

  for (const type of ['announcement', 'promo', 'genre-switcher', 'banner'])
    await db.query(`insert into content_modules(id,type,title,ends_at) values($1,$1,'x',now())`, [type]);
  await assert.rejects(db.query(`insert into content_modules(id,type,title) values('bad','popup','x')`));
} finally { await db.close(); }
console.log('Marketplace migration checks passed: idempotent re-run, subject backfill, sale constraints, wishlist keys, module types.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-marketplace-db.mjs`
Expected: FAIL (`relation "categories" does not exist`).

- [ ] **Step 3: Write the migration**

Create `migrations/007-marketplace.sql`:

```sql
-- Marketplace: categories, per-title offers, release dates, wishlist, scheduled module end.
-- Additive and idempotent: re-applied on every migrate run.
create table if not exists categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 80),
  parent_slug text references categories(slug),
  image_url text,
  colour text check (colour is null or colour ~ '^#[0-9a-fA-F]{6}$'),
  sort integer not null default 0,
  status text not null default 'published' check (status in ('draft','published','archived')),
  updated_at timestamptz not null default now()
);
alter table books add column if not exists category_slug text references categories(slug);
alter table books add column if not exists sale_price_inr integer;
alter table books add column if not exists sale_starts_at timestamptz;
alter table books add column if not exists sale_ends_at timestamptz;
alter table books add column if not exists release_date date;
do $$ begin
  alter table books drop constraint if exists books_sale_price_check;
  alter table books add constraint books_sale_price_check check (
    sale_price_inr is null or (sale_price_inr > 0 and sale_price_inr < price_inr));
  alter table books drop constraint if exists books_sale_window_check;
  alter table books add constraint books_sale_window_check check (
    sale_starts_at is null or sale_ends_at is null or sale_starts_at < sale_ends_at);
end $$;
create index if not exists books_category_idx on books(category_slug);

-- Existing free-text subjects become categories; nothing is dropped.
insert into categories(slug, name)
select distinct trim(both '-' from regexp_replace(lower(subject), '[^a-z0-9]+', '-', 'g')), subject
from books where subject is not null and trim(subject) <> ''
on conflict (slug) do nothing;
update books set category_slug = trim(both '-' from regexp_replace(lower(subject), '[^a-z0-9]+', '-', 'g'))
where category_slug is null and subject is not null and trim(subject) <> '';

create table if not exists wishlist (
  reader_id text not null,
  book_slug text not null references books(slug),
  created_at timestamptz not null default now(),
  primary key (reader_id, book_slug)
);

alter table content_modules add column if not exists ends_at timestamptz;
do $$ begin
  alter table content_modules drop constraint if exists content_modules_type_check;
  alter table content_modules add constraint content_modules_type_check check (type in
    ('hero','banner','text','collection','testimonial','author','media','announcement','promo','genre-switcher'));
end $$;
```

Note: `subject` is added by `004-catalogue.sql`, so 007 runs after it in sorted order.

In `src/lib/db.ts`, add to `Book` after `file_sha256?`:

```ts
  category_slug?: string | null;
  sale_price_inr?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
  release_date?: string | null;
```

Register `'scripts/test-marketplace-db.mjs'` in `scripts/test-all.mjs` after `'scripts/test-migrations.mjs'`.

- [ ] **Step 4: Run tests**

Run: `node scripts/test-marketplace-db.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. If `content_modules_type_check` is not the generated constraint name in PGlite, find it with `select conname from pg_constraint where conrelid='content_modules'::regclass` and drop that name too inside the `do` block (`drop constraint if exists <name>`), keeping the new name.

- [ ] **Step 5: Commit**

```bash
git add migrations/007-marketplace.sql scripts/test-marketplace-db.mjs scripts/test-all.mjs src/lib/db.ts
git commit -m "Add marketplace migration: categories, offers, release dates, wishlist, module end dates"
```

---

### Task A3: `currentPrice` and the public book shape

**Files:**
- Modify: `src/lib/money.ts`
- Modify: `src/components/book-data.ts`
- Create: `scripts/test-pricing.mjs`
- Modify: `scripts/test-all.mjs`
- Modify: `src/components/reading-room.test.cjs`

**Interfaces:**
- Produces in `src/lib/money.ts`:

```ts
export type Priced = { price_inr: number; sale_price_inr?: number | null;
  sale_starts_at?: string | Date | null; sale_ends_at?: string | Date | null };
export type CurrentPrice = { price: number; regular: number; onSale: boolean; saving: number };
export function currentPrice(book: Priced, now?: Date): CurrentPrice;
export const percentOff: (p: CurrentPrice) => number; // whole percent, 0 when not on sale
```

- Produces `PublicBook` (in `src/components/book-data.ts`) = previous fields plus
  `category_slug: string | null; release_date: string | null; price: number; regular: number; onSale: boolean; saving: number; comingSoon: boolean;`
  `price_inr` stays (equals `regular`).

- [ ] **Step 1: Write the failing test**

Create `scripts/test-pricing.mjs`:

```js
import assert from 'node:assert/strict';
import { load } from './test-commerce.mjs';

const { currentPrice, percentOff } = load('src/lib/money.ts');
const at = iso => new Date(iso);
const book = { price_inr: 29900, sale_price_inr: 25200 };
assert.deepEqual(currentPrice(book, at('2026-10-15T00:00:00Z')), { price: 25200, regular: 29900, onSale: true, saving: 4700 });
assert.equal(percentOff(currentPrice(book)), 16);
assert.deepEqual(currentPrice({ price_inr: 29900 }), { price: 29900, regular: 29900, onSale: false, saving: 0 });

const windowed = { ...book, sale_starts_at: '2026-10-18T00:00:00+05:30', sale_ends_at: '2026-10-20T00:00:00+05:30' };
assert.equal(currentPrice(windowed, at('2026-10-17T18:29:59.999Z')).onSale, false); // 1ms before start
assert.equal(currentPrice(windowed, at('2026-10-17T18:30:00.000Z')).onSale, true);  // start inclusive
assert.equal(currentPrice(windowed, at('2026-10-19T18:29:59.999Z')).onSale, true);  // 1ms before end
assert.equal(currentPrice(windowed, at('2026-10-19T18:30:00.000Z')).onSale, false); // end exclusive

// Corrupt rows never undercut or overcharge: invalid sale prices are ignored.
for (const sale of [0, -1, 29900, 40000, 1.5, null, undefined, NaN])
  assert.equal(currentPrice({ price_inr: 29900, sale_price_inr: sale }).price, 29900);
assert.equal(currentPrice({ ...book, sale_starts_at: 'not a date' }).onSale, false);
console.log('Pricing checks passed: sale windows (inclusive start, exclusive end), invalid sales ignored, percent off.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-pricing.mjs`
Expected: FAIL `currentPrice is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/money.ts`:

```ts
export type Priced = { price_inr: number; sale_price_inr?: number | null;
  sale_starts_at?: string | Date | null; sale_ends_at?: string | Date | null };
export type CurrentPrice = { price: number; regular: number; onSale: boolean; saving: number };

const instant = (value: string | Date | null | undefined) =>
  value == null ? null : value instanceof Date ? value.getTime() : Date.parse(value);

/** The single source of the price a reader sees and is charged. Start inclusive, end exclusive. */
export function currentPrice(book: Priced, now: Date = new Date()): CurrentPrice {
  const regular = book.price_inr;
  const sale = book.sale_price_inr;
  const start = instant(book.sale_starts_at), end = instant(book.sale_ends_at), t = now.getTime();
  const valid = typeof sale === "number" && Number.isSafeInteger(sale) && sale > 0 && sale < regular
    && (start === null || (Number.isFinite(start) && start <= t))
    && (end === null || (Number.isFinite(end) && t < end));
  return valid ? { price: sale, regular, onSale: true, saving: regular - sale } : { price: regular, regular, onSale: false, saving: 0 };
}

export const percentOff = (p: CurrentPrice) => p.onSale ? Math.floor((p.saving / p.regular) * 100) : 0;
```

Replace `src/components/book-data.ts` `PublicBook` and `publicBook` with:

```ts
import type { Book } from "@/lib/db";
import { isSaleable } from "@/lib/catalogue";
import { currentPrice } from "@/lib/money";

export type ReadingBook = Book;

export function visibleBook(book: Book) {
  return book.active && (!book.third_party || isSaleable(book));
}

export type PublicBook = Pick<ReadingBook,
  "slug" | "title" | "subtitle" | "description" | "authorship" | "cover" |
  "price_inr" | "file_format" | "pages" | "year" | "subject" | "language" | "edition" | "author_slug" | "isbn"
> & { highlights: string[]; saleable: boolean; saveable: boolean; category_slug: string | null; release_date: string | null;
  price: number; regular: number; onSale: boolean; saving: number; comingSoon: boolean };

const day = (value: unknown) => value == null ? null : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

// Only public bibliographic and price fields cross the client boundary, never file URLs.
export function publicBook(book: ReadingBook, now: Date = new Date()): PublicBook {
  const { slug, title, subtitle, description, authorship, cover, price_inr,
    file_format, pages, year, subject, language, edition, author_slug, isbn } = book;
  const release = day(book.release_date);
  return { slug, title, subtitle, description, authorship, cover, price_inr,
    file_format, pages, year, subject: subject || book.facts?.Subject || null,
    language: language || book.facts?.Language || null, edition: edition || book.facts?.Edition || null, author_slug, isbn,
    highlights: Array.isArray(book.highlights) ? book.highlights : [],
    saleable: isSaleable(book), saveable: visibleBook(book),
    category_slug: book.category_slug ?? null, release_date: release,
    ...currentPrice(book, now), comingSoon: !!release && release > now.toISOString().slice(0, 10) };
}
```

In `src/components/reading-room.test.cjs`, generalise the `load` dependency resolver so component tests in later tasks can load files with relative and `@/` imports (today it only knows a few hard-coded names and falls back to `require`, which fails for source files). Replace the body of `dependency` inside `load` with:

```js
  const dependency = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === "@/components/CartProvider" || name === "./CartProvider") return { ...load("components/CartProvider.tsx"), useCart: () => cart };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? name.slice(2) : path.relative(root, path.resolve(path.dirname(filename), name)).split(path.sep).join("/");
      for (const ext of [".tsx", ".ts"]) if (fs.existsSync(path.join(root, base + ext))) return load(base + ext, overrides);
    }
    return require(name);
  };
```

This removes the old special cases for `@/lib/catalogue`, `@/lib/money`, `@/lib/store` and `./MotionBookLink`: the generic branch loads the real files. `lib/catalogue.ts` imports only `./access-policy`, `./store` and (from Task B6) `./money`, none of which touch the database. Run `node src/components/reading-room.test.cjs` right after this change and before adding new assertions: it must still pass.

After the existing `publicBook` assertions add:

```js
const onSale = publicBook({ ...record, sale_price_inr: 120000 });
assert.equal(onSale.price, 120000);
assert.equal(onSale.regular, 150000);
assert.equal(onSale.onSale, true);
assert.equal(publicBook({ ...record, release_date: "2999-01-01" }).comingSoon, true);
assert.equal(publicBook({ ...record, release_date: "2000-01-01" }).comingSoon, false);
```

Register `'scripts/test-pricing.mjs'` in `scripts/test-all.mjs` after `'scripts/test-csv.mjs'`.

**Trap:** several pages call `.map(publicBook)`. With the new `now` parameter, `Array.prototype.map` would pass the element index (a number) as `now` and `now.toISOString()` would throw. Fix every call site now:

Run: `grep -rn "map(publicBook)" src`
Expected hits include `src/app/cart/page.tsx`, `src/app/checkout/page.tsx`, `src/app/authors/[id]/page.tsx`, `src/app/books/[slug]/page.tsx`, `src/app/catalogue/page.tsx`, `src/app/page.tsx`. Replace each `.map(publicBook)` with `.map((book) => publicBook(book))`, then re-run the grep and expect no output. Add a guard test to `reading-room.test.cjs`:

```js
assert.doesNotThrow(() => [record].map((book) => publicBook(book)));
assert.equal(publicBook(record, new Date("2026-10-15T00:00:00Z")).comingSoon, false);
```

- [ ] **Step 4: Run tests**

Run: `node --import tsx scripts/test-pricing.mjs && node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/components/book-data.ts scripts/test-pricing.mjs scripts/test-all.mjs src/components/reading-room.test.cjs
git commit -m "Add currentPrice as the single price rule and carry it on public books"
```

---

### Task A4: Server-only store data (categories, bestsellers, authors) and rate limiting

**Files:**
- Create: `src/lib/store-data.ts`
- Create: `src/lib/rate-limit.ts`
- Modify: `src/lib/admin-auth.ts` (reuse the limiter)
- Create: `scripts/test-store-data.mjs`
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces in `src/lib/store-data.ts` (server-only; imports `sql`):

```ts
export type Category = { slug: string; name: string; parent_slug: string | null; image_url: string | null; colour: string | null; sort: number };
export async function getCategories(): Promise<Category[]>;              // published, ordered by sort, name
export async function getStoreBooks(now?: Date): Promise<PublicBook[]>;  // visible books mapped through publicBook
export async function bestsellerSlugs(days?: number, limit?: number): Promise<string[]>; // paid|fulfilled orders
export async function getPublishedAuthors(): Promise<{ id: string; name: string; photo_url: string | null }[]>;
```

- Produces in `src/lib/rate-limit.ts`:

```ts
export async function consumeLimit(key: string, max: number, windowSeconds: number): Promise<boolean>; // true = allowed
export function clientKey(req: Request, scope: string): string; // sha256 of scope + forwarded-for (or 'local')
```

- [ ] **Step 1: Write the failing test**

Create `scripts/test-store-data.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { load } from './test-commerce.mjs';

const db = new PGlite();
await db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const n of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort())
  await db.exec(readFileSync(new URL(`../migrations/${n}`, import.meta.url), 'utf8'));
const sql = async (parts, ...v) => (await db.query(parts.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), v)).rows;
const getBooks = async () => sql`select * from books where active order by sort, title`;
const store = load('src/lib/store-data.ts', { '@/lib/db': { sql, getBooks }, './db': { sql, getBooks } });
const limit = load('src/lib/rate-limit.ts', { './db': { sql } });

await db.exec(`insert into categories(slug,name,sort) values('science','Science',2),('fiction','Fiction',1),('hidden','Hidden',0)`);
await db.exec(`update categories set status='draft' where slug='hidden'`);
assert.deepEqual((await store.getCategories()).map(c => c.slug), ['fiction', 'science']);

await db.exec(`insert into books(slug,title,price_inr,file_url,release_approved,scan_status,sale_price_inr)
  values('a','A',10000,'private:a.pdf',true,'clean',8000),('b','B',10000,'private:b.pdf',true,'clean',null)`);
const books = await store.getStoreBooks(new Date('2026-10-15T00:00:00Z'));
assert.equal(books.find(b => b.slug === 'a').price, 8000);
assert.equal('file_url' in books[0], false);

const order = (id, status, slugs, ago = '1 day') => db.query(
  `insert into orders(id,email,items,subtotal,total,status,created_at) values($1,'x@example.com',$2::jsonb,1,1,$3,now()-$4::interval)`,
  [id, JSON.stringify(slugs.map(slug => ({ slug, title: slug, price: 1 }))), status, ago]);
await order('o1', 'fulfilled', ['b']); await order('o2', 'paid', ['b', 'a']); await order('o3', 'created', ['a']);
await order('o4', 'payment_failed', ['a']); await order('o5', 'fulfilled', ['a'], '200 days');
assert.deepEqual(await store.bestsellerSlugs(90, 10), ['b', 'a']);

assert.equal(await limit.consumeLimit('k', 2, 60), true);
assert.equal(await limit.consumeLimit('k', 2, 60), true);
assert.equal(await limit.consumeLimit('k', 2, 60), false);
assert.notEqual(limit.clientKey(new Request('http://x', { headers: { 'x-vercel-forwarded-for': '1.1.1.1' } }), 's'),
  limit.clientKey(new Request('http://x'), 's'));
await db.close();
console.log('Store data checks passed: published categories, priced public books, real-order bestsellers, rate limits.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-store-data.mjs`
Expected: FAIL (cannot find `src/lib/store-data.ts`).

- [ ] **Step 3: Implement**

Create `src/lib/rate-limit.ts`:

```ts
import crypto from "node:crypto";
import { sql } from "./db";

export function clientKey(req: Request, scope: string) {
  const who = req.headers.get("x-vercel-forwarded-for") || "local";
  return crypto.createHash("sha256").update(`${scope}:${who}`).digest("hex");
}

/** Fixed-window counter in request_limits. Returns false once the window is exhausted. */
export async function consumeLimit(key: string, max: number, windowSeconds: number) {
  const rows = await sql`insert into request_limits (key, count, expires_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds})) on conflict (key) do update set
    count = case when request_limits.expires_at < now() then 1 else request_limits.count + 1 end,
    expires_at = case when request_limits.expires_at < now() then now() + make_interval(secs => ${windowSeconds}) else request_limits.expires_at end
    returning count` as { count: number }[];
  return rows[0].count <= max;
}
```

In `src/lib/admin-auth.ts` replace the inline `attempts` query and its check with:

```ts
  const allowed = await consumeLimit(clientKey(new Request('http://admin', { headers: requestHeaders }), 'admin'), 5, 3600);
  if (!allowed || !crypto.timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(expected)))) return false;
```

and import `{ consumeLimit, clientKey } from './rate-limit'`; delete the now-unused `key` constant.

Create `src/lib/store-data.ts`:

```ts
// Server-only by convention: it imports the database client. (The `server-only` package is not installed; do not add it.)
import { sql, getBooks } from "./db";
import { publicBook, visibleBook, type PublicBook } from "@/components/book-data";

export type Category = { slug: string; name: string; parent_slug: string | null; image_url: string | null; colour: string | null; sort: number };

export async function getCategories(): Promise<Category[]> {
  return await sql`select slug,name,parent_slug,image_url,colour,sort from categories
    where status='published' order by sort, name` as Category[];
}

export async function getStoreBooks(now: Date = new Date()): Promise<PublicBook[]> {
  return (await getBooks()).filter(visibleBook).map((book) => publicBook(book, now));
}

/** Real paid or fulfilled orders only; never a claim the data cannot support. */
export async function bestsellerSlugs(days = 90, limit = 12): Promise<string[]> {
  const rows = await sql`select item->>'slug' as slug, count(*)::int as n
    from orders, jsonb_array_elements(items) item
    where status in ('paid','fulfilled') and created_at > now() - make_interval(days => ${days})
    group by 1 order by n desc, slug limit ${limit}` as { slug: string }[];
  return rows.map((row) => row.slug);
}

export async function getPublishedAuthors() {
  return await sql`select id,name,photo_url from author_profiles
    where status='published' and (publish_at is null or publish_at <= now()) order by name` as { id: string; name: string; photo_url: string | null }[];
}
```

Register `'scripts/test-store-data.mjs'` in `scripts/test-all.mjs` after `'scripts/test-marketplace-db.mjs'`.

- [ ] **Step 4: Run tests**

Run: `node --import tsx scripts/test-store-data.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS (admin sign-in tests in `test-auth.mjs` still pass with the shared limiter).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store-data.ts src/lib/rate-limit.ts src/lib/admin-auth.ts scripts/test-store-data.mjs scripts/test-all.mjs
git commit -m "Add server store data (categories, bestsellers from real orders) and a shared rate limiter"
```

---

### Task A5: Demo catalogue for the isolated preview

**Files:**
- Create: `scripts/demo-catalogue.mjs`
- Modify: `scripts/isolated-db.mjs`
- Create: `scripts/test-demo-catalogue.mjs`
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces: `export function demoCatalogue(now?: Date): { categories, authors, books, orders, modules }` and `export async function seedDemo(db): Promise<void>` (PGlite instance).
- Consumes: migration 007 columns (Task A2).

- [ ] **Step 1: Write the failing test**

Create `scripts/test-demo-catalogue.mjs`:

```js
import assert from 'node:assert/strict';
import { createIsolatedDatabase } from './isolated-db.mjs';
import { demoCatalogue } from './demo-catalogue.mjs';

const data = demoCatalogue(new Date('2026-10-15T00:00:00Z'));
assert.ok(data.categories.length >= 12);
assert.ok(data.books.length >= 60);
assert.equal(new Set(data.books.map(b => b.slug)).size, data.books.length);
for (const book of data.books) {
  assert.match(book.cover, /^data:image\/svg\+xml;utf8,/);
  assert.equal(book.facts._demo, 'true');
  assert.ok(book.sale_price_inr == null || book.sale_price_inr < book.price_inr);
}
assert.ok(data.books.some(b => b.sale_price_inr), 'some titles are on offer');
assert.ok(data.books.some(b => b.release_date > '2026-10-15'), 'some titles are coming soon');
assert.ok(new Set(data.books.map(b => b.language)).size >= 4, 'several languages for the language shelf');

const { db } = await createIsolatedDatabase({ seed: true });
try {
  const count = (await db.query(`select count(*)::int n from books where facts->>'_demo'='true'`)).rows[0].n;
  assert.ok(count >= 60);
  const banners = (await db.query(`select count(*)::int n from content_modules where type='banner' and status='published'`)).rows[0].n;
  assert.ok(banners >= 2);
  const real = (await db.query(`select count(*)::int n from books where coalesce(facts->>'_demo','') <> 'true'`)).rows[0].n;
  assert.ok(real >= 2, 'the real titles are still seeded');
} finally { await db.close(); }
console.log('Demo catalogue checks passed: 60+ unique demo titles, offers, coming soon, languages, banners, real titles kept.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-demo-catalogue.mjs`
Expected: FAIL (cannot find module `./demo-catalogue.mjs`).

- [ ] **Step 3: Implement**

Create `scripts/demo-catalogue.mjs`:

```js
// Isolated-preview demo data only. Covers are generated typography, clearly fictional titles.
// Never imported by production code or scripts/seed.mjs.
import crypto from 'node:crypto';

const CATEGORIES = [
  ['fiction', 'Fiction', '#F04E37'], ['mystery-thriller', 'Mystery and thriller', '#1F2937'],
  ['romance', 'Romance', '#DB2777'], ['science', 'Science', '#2563EB'], ['health-wellness', 'Health and wellness', '#16A34A'],
  ['ayurveda', 'Ayurveda', '#15803D'], ['business', 'Business', '#B45309'], ['self-help', 'Self-help', '#7C3AED'],
  ['history', 'History', '#92400E'], ['children', 'Children', '#F59E0B'], ['biography', 'Biography', '#0F766E'],
  ['technology', 'Technology', '#0EA5E9'],
];
const TITLES = {
  fiction: ['The Monsoon Ledger', 'A House on Juhu Lane', 'Paper Boats', 'The Ninth Platform', 'Salt and Saffron'],
  'mystery-thriller': ['Midnight at Colaba', 'The Silent Courier', 'Cipher of the Ghats', 'Dead Reckoning', 'The Ledger Room'],
  romance: ['Letters from Shimla', 'Second Monsoon', 'The Tea Garden', 'Under the Same Stars', 'A Winter in Mussoorie'],
  science: ['The Restless Atom', 'Small Wonders', 'Maps of the Mind', 'The Carbon Story', 'Light Years Away'],
  'health-wellness': ['Everyday Strength', 'The Sleep Reset', 'Mindful Kitchen', 'Breathe Better', 'Walk Your Way'],
  ayurveda: ['Foundations of Rasayana', 'Seasons and the Body', 'Herbs of the Western Ghats', 'Dinacharya Daily', 'The Six Tastes'],
  business: ['Built in Bengaluru', 'The Frugal Founder', 'Pricing with Purpose', 'Teams That Ship', 'The Long Game'],
  'self-help': ['Small Steps', 'The Focus Habit', 'Quiet Confidence', 'Unhurried', 'Begin Again'],
  history: ['Empires of the Deccan', 'The Silk Road Diaries', 'Ports of the Malabar', 'Letters from 1857', 'Stone and Script'],
  children: ['Moti the Brave Elephant', 'The Kite That Flew Home', 'Counting Mangoes', 'Riya and the Rain', 'Stars Over Ladakh'],
  biography: ['A Life in Ink', 'The Engineer of Dams', 'Notes of a Physician', 'Voices of the Valley', 'The Quiet Reformer'],
  technology: ['Code for Everyone', 'Data, Plainly', 'The Secure Web', 'Machines That Learn', 'Designing for People'],
};
const AUTHORS = ['Ananya Rao', 'Vikram Mehta', 'Meera Iyer', 'Arjun Kapoor', 'Kavya Nair', 'Rohan Desai', 'Ishita Sen', 'Farhan Qureshi', 'Leela Menon', 'Dev Malhotra'];
const LANGUAGES = ['English', 'English', 'English', 'Hindi', 'Marathi', 'Tamil', 'Gujarati', 'Telugu'];
const slugify = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeXml = value => value.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

export function demoCover(title, author, colour) {
  const words = title.split(' ');
  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last && (last + ' ' + word).length <= 14) lines[lines.length - 1] = last + ' ' + word; else lines.push(word);
  }
  const text = lines.map((line, i) => `<text x="30" y="${120 + i * 44}" font-family="Arial,Helvetica,sans-serif" font-size="36" font-weight="800" fill="#ffffff">${escapeXml(line)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">`
    + `<rect width="300" height="450" fill="${colour}"/><rect x="0" y="0" width="14" height="450" fill="#000" opacity=".18"/>`
    + `<circle cx="250" cy="390" r="90" fill="#fff" opacity=".12"/>${text}`
    + `<text x="30" y="410" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#ffffff" opacity=".9">${escapeXml(author)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function demoCatalogue(now = new Date()) {
  const day = offset => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const categories = CATEGORIES.map(([slug, name, colour], sort) => ({ slug, name, colour, sort }));
  const authors = AUTHORS.map(name => ({ id: `demo-${slugify(name)}`, name, bio: `${name} writes for readers who like their ideas clear and their stories honest. (Demo author.)` }));
  const books = [];
  let n = 0;
  for (const [slug, , colour] of CATEGORIES) {
    for (const title of TITLES[slug]) {
      const author = authors[n % authors.length];
      const price = [19900, 24900, 29900, 34900, 44900, 59900][n % 6];
      books.push({
        slug: `demo-${slugify(title)}`, title, category_slug: slug, authorship: author.name, author_slug: author.id,
        description: `${title} is a demo listing used to preview the store at full scale. It is not a real book.`,
        cover: demoCover(title, author.name, colour), price_inr: price,
        sale_price_inr: n % 3 === 0 ? Math.round(price * 0.8 / 100) * 100 : null,
        release_date: n % 11 === 0 ? day(10 + n) : day(-30 - n), language: LANGUAGES[n % LANGUAGES.length],
        file_format: n % 4 === 0 ? 'EPUB' : 'PDF', pages: 120 + (n * 37) % 400, year: 2020 + (n % 6),
        publisher: 'Demo Press', facts: { _demo: 'true' }, sort: 100 + n,
      });
      n++;
    }
  }
  const orders = books.slice(0, 15).map((book, i) => ({
    id: `demo-order-${i}`, items: [{ slug: book.slug, title: book.title, price: book.price_inr }],
    total: book.price_inr, count: 15 - i,
  }));
  const modules = [
    { id: 'demo-announcement', type: 'announcement', title: 'Festive reads: up to 20% off selected titles', link_url: '/search?offer=1', sort: 0 },
    { id: 'demo-banner-1', type: 'banner', title: 'Festive reading week', body: 'Up to 20% off across fiction, science and more', link_url: '/search?offer=1', link_label: 'Shop offers', payload: { subtitle: 'Limited time', theme: 'coral' }, sort: 1 },
    { id: 'demo-banner-2', type: 'banner', title: 'New this month', body: 'Fresh titles from independent authors', link_url: '/search?sort=new', link_label: 'See new arrivals', payload: { subtitle: 'Just in', theme: 'sky' }, sort: 2 },
    { id: 'demo-banner-3', type: 'banner', title: 'Publish with us', body: 'Reach readers across India in digital editions', link_url: '/publish', link_label: 'Start publishing', payload: { subtitle: 'For authors', theme: 'yellow' }, sort: 3 },
    { id: 'demo-promo-1', type: 'promo', title: 'Ayurveda essentials', link_url: '/category/ayurveda', payload: { size: 'large', category_slug: 'ayurveda', theme: 'green' }, sort: 4 },
    { id: 'demo-promo-2', type: 'promo', title: 'Thrillers to stay up for', link_url: '/category/mystery-thriller', payload: { size: 'small', theme: 'ink' }, sort: 5 },
    { id: 'demo-promo-3', type: 'promo', title: 'Big ideas in science', link_url: '/category/science', payload: { size: 'small', theme: 'sky' }, sort: 6 },
    { id: 'demo-promo-4', type: 'promo', title: 'Stories for little readers', link_url: '/category/children', payload: { size: 'small', theme: 'yellow' }, sort: 7 },
    { id: 'demo-genres', type: 'genre-switcher', title: 'Find your genre', payload: { category_slugs: ['fiction', 'mystery-thriller', 'romance', 'science', 'business'] }, sort: 8 },
  ];
  return { categories, authors, books, orders, modules };
}

export async function seedDemo(db) {
  const data = demoCatalogue();
  const sha = crypto.createHash('sha256').update('demo').digest('hex');
  for (const c of data.categories)
    await db.query(`insert into categories(slug,name,colour,sort) values($1,$2,$3,$4) on conflict (slug) do nothing`, [c.slug, c.name, c.colour, c.sort]);
  for (const a of data.authors)
    await db.query(`insert into author_profiles(id,name,bio,status) values($1,$2,$3,'published') on conflict (id) do nothing`, [a.id, a.name, a.bio]);
  for (const b of data.books)
    await db.query(`insert into books(slug,title,category_slug,authorship,author_slug,description,cover,price_inr,sale_price_inr,release_date,
        language,file_format,pages,year,publisher,facts,sort,file_url,file_sha256,release_approved,scan_status,subject)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,'private:demo.pdf',$18,true,'clean',
        (select name from categories where slug=$3)) on conflict (slug) do nothing`,
    [b.slug, b.title, b.category_slug, b.authorship, b.author_slug, b.description, b.cover, b.price_inr, b.sale_price_inr, b.release_date,
      b.language, b.file_format, b.pages, b.year, b.publisher, JSON.stringify(b.facts), b.sort, sha]);
  for (const o of data.orders)
    for (let i = 0; i < o.count; i++)
      await db.query(`insert into orders(id,email,items,subtotal,total,status,created_at) values($1,'demo@example.com',$2::jsonb,$3,$3,'fulfilled',now() - ($4 || ' days')::interval)
        on conflict (id) do nothing`, [`${o.id}-${i}`, JSON.stringify(o.items), o.total, String(i + 1)]);
  for (const m of data.modules)
    await db.query(`insert into content_modules(id,type,title,body,link_url,link_label,payload,sort,status)
      values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'published') on conflict (id) do nothing`,
    [m.id, m.type, m.title, m.body || null, m.link_url || null, m.link_label || null, JSON.stringify(m.payload || {}), m.sort]);
}
```

In `scripts/isolated-db.mjs`, add `import { seedDemo } from './demo-catalogue.mjs';` and at the end of the `if (seed) { … }` block, after the author insert:

```js
    await seedDemo(db);
```

Register `'scripts/test-demo-catalogue.mjs'` after `'scripts/test-store-data.mjs'` in `scripts/test-all.mjs`.

Note: `next/image` refuses `data:` SVG sources only when optimisation is on; Task B3's `Cover` component renders `data:` and `https:` covers with `unoptimized`.

- [ ] **Step 4: Run tests**

Run: `node scripts/test-demo-catalogue.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/demo-catalogue.mjs scripts/isolated-db.mjs scripts/test-demo-catalogue.mjs scripts/test-all.mjs
git commit -m "Seed a 60-title demo catalogue into the isolated preview only"
```

---

### Task A6: CMS module types, end dates and payload fields

**Files:**
- Modify: `src/lib/content.ts`
- Modify: `src/components/content-data.ts`
- Modify: `src/app/admin/platform/ModuleFields.tsx`
- Modify: `src/app/api/admin/platform/content/route.ts`
- Modify: `scripts/test-publishing.mjs` (content validation cases)

**Interfaces:**
- Produces: `moduleTypes` includes `'announcement' | 'promo' | 'genre-switcher'`; `ContentModule` gains `ends_at: string | null`; payload keys add `theme` (`'coral'|'sky'|'yellow'|'green'|'ink'|'lilac'`), `size` (`'large'|'small'`), `category_slug`, `category_slugs` (string[] ≤ 8).
- Produces: `publicModules(modules, now?)` filters out modules whose `ends_at <= now` in addition to existing rules; `getPublicContent()` SQL adds `and (ends_at is null or ends_at > now())`.

- [ ] **Step 1: Write the failing test**

In `scripts/test-publishing.mjs`, find where `validateContent` is exercised (search `validateContent(`) and add after the last existing assertion that uses it:

```js
const content = load('src/lib/content.ts', { './db': { sql() { throw new Error('no db'); } } });
const promo = content.validateContent('modules', { title: 'Science week', type: 'promo', status: 'published',
  payload: { size: 'large', theme: 'sky', category_slug: 'science' }, ends_at: '2026-10-20T00:00:00+05:30' });
assert.equal(promo.type, 'promo');
assert.equal(promo.ends_at, '2026-10-20T00:00:00+05:30');
assert.throws(() => content.validateContent('modules', { title: 'x', type: 'promo', payload: { theme: 'neon' } }), /theme/);
assert.throws(() => content.validateContent('modules', { title: 'x', type: 'promo', payload: { size: 'huge' } }), /size/);
assert.throws(() => content.validateContent('modules', { title: 'x', type: 'genre-switcher', payload: { category_slugs: Array(9).fill('a') } }), /categor/);
assert.throws(() => content.validateContent('modules', { title: 'x', publish_at: '2026-10-21T00:00:00Z', ends_at: '2026-10-20T00:00:00Z' }), /end/);
const helpers = load('src/components/content-data.ts', { '@/lib/content': content });
const base = { id: 'm', type: 'banner', title: 't', status: 'published', publish_at: null, sort: 0, payload: {} };
assert.equal(helpers.publicModules([{ ...base, ends_at: '2026-10-14T00:00:00Z' }], new Date('2026-10-15T00:00:00Z')).length, 0);
assert.equal(helpers.publicModules([{ ...base, ends_at: '2026-10-16T00:00:00Z' }], new Date('2026-10-15T00:00:00Z')).length, 1);
```

If `load` is not already imported in that file, import it: `import { load } from './test-commerce.mjs';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-publishing.mjs`
Expected: FAIL `Invalid module type.`

- [ ] **Step 3: Implement**

In `src/lib/content.ts`:

```ts
export type ContentModule = {
  // keep existing fields, add:
  ends_at: string | null;
};
export const moduleTypes = ["hero", "banner", "text", "collection", "testimonial", "author", "media", "announcement", "promo", "genre-switcher"] as const;
const themes = ["coral", "sky", "yellow", "green", "ink", "lilac"];
```

(Edit the existing `ContentModule` type to include `ends_at: string | null;` rather than redeclaring it.)

In `validateContent`, after the `publishAt` lines add:

```ts
  const endsAt = input.ends_at ? textField(input.ends_at, 40) : null;
  if (endsAt && !Number.isFinite(Date.parse(endsAt))) throw new ContentError("Invalid end date.");
  if (endsAt && publishAt && Date.parse(endsAt) <= Date.parse(publishAt)) throw new ContentError("The end date must be after the publish date.");
```

Replace the payload key allowlist and loop with:

```ts
  const allowedKeys = ["subtitle", "quote", "attribution", "collection_slug", "author_id", "book_slugs", "video_url", "theme", "size", "category_slug", "category_slugs"];
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || JSON.stringify(payload).length > 10000 || Object.keys(payload).some(k => !allowedKeys.includes(k))) throw new ContentError("Invalid module data.");
  for (const [key, value] of Object.entries(payload)) {
    if (key === "video_url") safeUrl(value);
    else if (key === "theme") { if (!themes.includes(String(value))) throw new ContentError("Invalid theme."); }
    else if (key === "size") { if (!["large", "small"].includes(String(value))) throw new ContentError("Invalid tile size."); }
    else if (key === "category_slug") { if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new ContentError("Invalid category."); }
    else if (key === "category_slugs") {
      if (!Array.isArray(value) || value.length > 8 || value.some(s => typeof s !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) throw new ContentError("Choose up to 8 categories.");
    } else if (key === "book_slugs") {
      if (!Array.isArray(value) || value.length > 100 || value.some(s => typeof s !== "string" || !/^[a-z0-9-]{1,120}$/.test(s))) throw new ContentError("Invalid module book selection.");
    } else textField(value, 4000);
  }
```

Return `ends_at: endsAt` from `validateContent`. In `saveContent`'s modules branch add `ends_at` to the insert column list, `${c.ends_at}::timestamptz` to values, and `ends_at=excluded.ends_at` to the update set. In `getPublicContent` select `ends_at::text` and add `and (ends_at is null or ends_at > now())` to the modules query.

In `src/components/content-data.ts`, change `publicModules` to:

```ts
export function publicModules(modules: ContentModule[], now = new Date()) {
  return modules.filter((module) => isPublicRecord(module, now.getTime()) && (!module.ends_at || Date.parse(module.ends_at) > now.getTime()))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
}
```

(Keep whatever ordering the existing implementation uses if it differs; the change is the `ends_at` filter and the `now` parameter.)

In `src/app/api/admin/platform/content/route.ts`, extend the payload fallback keys:

```ts
        ["subtitle", "attribution", "collection_slug", "author_id", "video_url", "theme", "size", "category_slug"].filter(key => form.get(key)).map(key => [key, form.get(key)])
```

and after building `input.payload`, add:

```ts
      if (form.getAll("category_slugs").length) (input.payload as Record<string, unknown>).category_slugs = form.getAll("category_slugs").map(String);
```

In `src/app/admin/platform/ModuleFields.tsx`, add the new types to the select list and fields:

```tsx
      {["hero", "banner", "announcement", "promo", "genre-switcher", "text", "collection", "author"].map(value => <option key={value} value={value}>{value}</option>)}
```

```tsx
    {["banner", "promo"].includes(selected) && <label className="text-sm">Colour theme<select name="theme" className="field-input mt-1" defaultValue={String(payload.theme ?? "yellow")}>
      {["yellow", "coral", "sky", "green", "ink", "lilac"].map(theme => <option key={theme} value={theme}>{theme}</option>)}</select></label>}
    {selected === "promo" && <label className="text-sm">Tile size<select name="size" className="field-input mt-1" defaultValue={String(payload.size ?? "small")}><option value="large">Large (shows live books)</option><option value="small">Small</option></select></label>}
    {selected === "promo" && <label className="text-sm">Category for live books<select name="category_slug" className="field-input mt-1" defaultValue={String(payload.category_slug ?? "")}><option value="">None</option>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>}
    {selected === "genre-switcher" && <fieldset className="text-sm"><legend>Categories (up to 8)</legend>{categories.map(c => <label key={c.slug} className="mr-4 inline-flex gap-2"><input type="checkbox" name="category_slugs" value={c.slug} defaultChecked={Array.isArray(payload.category_slugs) && payload.category_slugs.includes(c.slug)} />{c.name}</label>)}</fieldset>}
```

Add `categories: { slug: string; name: string }[]` to `ModuleFields` props, and in `src/app/admin/platform/[section]/page.tsx` load `const categories = selected === "modules" ? await sql\`select slug,name from categories order by sort,name\` as { slug: string; name: string }[] : [];`, pass it through `options` and `Editor` into `ModuleFields`. Add an "Ends at (with timezone)" field next to "Publish at" for modules: `{isModule && field("ends_at", "Ends at (with timezone)", { placeholder: "2026-10-20T00:00:00+05:30", maxLength: 40 })}`.

- [ ] **Step 4: Run tests**

Run: `node --import tsx scripts/test-publishing.mjs && node scripts/test-publishing-db.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content.ts src/components/content-data.ts src/app/admin/platform scripts/test-publishing.mjs src/app/api/admin/platform/content/route.ts
git commit -m "Add announcement, promo and genre-switcher modules with scheduled end dates"
```

---

### Task A7: Admin shell and navigation

**Files:**
- Modify: `src/components/AdminShell.tsx`
- Modify: `src/app/admin/platform/layout.tsx`
- Modify: `src/app/admin/page.tsx`, `src/app/admin/books/page.tsx` (new `active` keys only)

**Interfaces:**
- Produces: `AdminShell` prop `active: AdminSection` where
  `export type AdminSection = "overview" | "orders" | "books" | "categories" | "authors" | "collections" | "banners" | "modules" | "reviews" | "delivery";`
- Nav map (label → href): Dashboard `/admin`, Orders `/admin/orders`, Books `/admin/books`, Categories `/admin/categories`, Authors `/admin/platform/authors`, Collections `/admin/platform/collections`, Banners `/admin/platform/modules?type=banner`, Homepage sections `/admin/platform/modules`, Reviews `/admin/platform/reviews`, Delivery recovery `/admin/platform/delivery`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/reading-room.test.cjs` inside `checkHomepage` (end of function):

```js
  const Shell = load("components/AdminShell.tsx").default;
  const shell = renderToStaticMarkup(React.createElement(Shell, { active: "orders", title: "Orders" }, "body"));
  for (const href of ["/admin/orders", "/admin/categories", "/admin/platform/collections", "/admin/platform/modules?type=banner", "/admin/platform/delivery"])
    assert.ok(shell.includes(`href="${href.replace("&", "&amp;")}"`), href);
  assert.match(shell, /aria-current="page"[^>]*>[^<]*Orders/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL on `/admin/orders`.

- [ ] **Step 3: Implement**

Replace the `nav` array and `active` prop type in `src/components/AdminShell.tsx`:

```tsx
export type AdminSection = "overview" | "orders" | "books" | "categories" | "authors" | "collections" | "banners" | "modules" | "reviews" | "delivery";
const nav: { key: AdminSection; label: string; href: string }[] = [
  { key: "overview", label: "Dashboard", href: "/admin" },
  { key: "orders", label: "Orders", href: "/admin/orders" },
  { key: "books", label: "Books", href: "/admin/books" },
  { key: "categories", label: "Categories", href: "/admin/categories" },
  { key: "authors", label: "Authors", href: "/admin/platform/authors" },
  { key: "collections", label: "Collections", href: "/admin/platform/collections" },
  { key: "banners", label: "Banners", href: "/admin/platform/modules?type=banner" },
  { key: "modules", label: "Homepage sections", href: "/admin/platform/modules" },
  { key: "reviews", label: "Submissions", href: "/admin/platform/reviews" },
  { key: "delivery", label: "Delivery recovery", href: "/admin/platform/delivery" },
];
```

Use `Link` from `next/link` for items and set `aria-current={n.key === active ? "page" : undefined}` on the active link (replace the existing `<a>`).

Make `src/app/admin/platform/layout.tsx` render inside the shell. Because a layout cannot read the active child segment from params, add a tiny client component:

```tsx
// src/app/admin/platform/PlatformShell.tsx
"use client";
import { usePathname, useSearchParams } from "next/navigation";
import AdminShell, { type AdminSection } from "@/components/AdminShell";

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(), params = useSearchParams();
  const section = path.split("/")[3] || "modules";
  const active: AdminSection = section === "modules" && params.get("type") === "banner" ? "banners"
    : (["authors", "collections", "modules", "reviews", "delivery"] as const).find((s) => s === section) ?? "modules";
  const titles: Record<string, string> = { authors: "Authors", collections: "Collections", banners: "Banners", modules: "Homepage sections", reviews: "Submissions", delivery: "Delivery recovery" };
  return <AdminShell active={active} title={titles[active]}>{children}</AdminShell>;
}
```

If `AdminShell` is a server component importing server-only modules, keep it import-safe for the client (it only imports `STORE`; fine). `layout.tsx` becomes:

```tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import PlatformShell from "./PlatformShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform CMS", robots: { index: false, follow: false } };
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return <Suspense><PlatformShell>{children}</PlatformShell></Suspense>;
}
```

In `src/app/admin/platform/[section]/page.tsx`, when `section === "modules"` and `searchParams.type` is set, filter `records` to that type and preselect it in the "New" editor (`record={{ type }}`). Add `searchParams: Promise<{ type?: string }>` to the page props.

- [ ] **Step 4: Run tests**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminShell.tsx src/app/admin src/components/reading-room.test.cjs
git commit -m "Give admin one shell with sections for orders, catalogue, content and recovery"
```

---

### Task A8: Admin books (create, full fields, pricing without un-release) and categories

**Files:**
- Modify: `src/app/api/admin/book/route.ts`
- Modify: `src/app/admin/books/page.tsx`
- Create: `src/app/admin/books/BookForm.tsx`
- Create: `src/app/admin/categories/page.tsx`
- Create: `src/app/api/admin/categories/route.ts`
- Create: `src/lib/admin-catalogue.ts`
- Create: `scripts/test-admin-catalogue.mjs`
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces in `src/lib/admin-catalogue.ts`:

```ts
export function parseSale(form: FormData, regularPaise: number): { sale_price_inr: number | null; sale_starts_at: string | null; sale_ends_at: string | null };
export function parseCategory(form: FormData): { slug: string; name: string; parent_slug: string | null; image_url: string | null; colour: string | null; sort: number; status: "draft" | "published" | "archived" };
export function releaseChecklist(book: Book): { label: string; ok: boolean }[];
```

- Book route actions: `create` (fields `slug`, `title`; inserts `active=false`, `price_inr=0`), `save` (existing plus `category_slug`, `release_date`, `language`, `edition`, `file_format`, `author_slug`), `pricing` (`slug`, `sale_price`, `sale_starts_at`, `sale_ends_at`; does not touch `release_approved`).

- [ ] **Step 1: Write the failing test**

Create `scripts/test-admin-catalogue.mjs`:

```js
import assert from 'node:assert/strict';
import { load } from './test-commerce.mjs';

const a = load('src/lib/admin-catalogue.ts', { './submissions': { PublishingError: class extends Error { constructor(m, s = 400) { super(m); this.status = s; } } } });
const form = entries => { const f = new FormData(); for (const [k, v] of Object.entries(entries)) f.set(k, v); return f; };

assert.deepEqual(a.parseSale(form({ sale_price: '' }), 29900), { sale_price_inr: null, sale_starts_at: null, sale_ends_at: null });
assert.deepEqual(a.parseSale(form({ sale_price: '252', sale_starts_at: '2026-10-18T00:00', sale_ends_at: '2026-10-20T00:00' }), 29900),
  { sale_price_inr: 25200, sale_starts_at: '2026-10-18T00:00:00+05:30', sale_ends_at: '2026-10-20T00:00:00+05:30' });
for (const bad of ['299', '300', '0', '-5', 'abc', '1.234'])
  assert.throws(() => a.parseSale(form({ sale_price: bad }), 29900), /sale price/i, bad);
assert.throws(() => a.parseSale(form({ sale_price: '100', sale_starts_at: '2026-10-20T00:00', sale_ends_at: '2026-10-18T00:00' }), 29900), /end/i);

assert.deepEqual(a.parseCategory(form({ slug: 'science', name: 'Science', colour: '#2563EB', sort: '3', status: 'published' })),
  { slug: 'science', name: 'Science', parent_slug: null, image_url: null, colour: '#2563EB', sort: 3, status: 'published' });
assert.throws(() => a.parseCategory(form({ slug: 'Bad Slug', name: 'x' })), /slug/i);
assert.throws(() => a.parseCategory(form({ slug: 'ok', name: 'x', colour: 'red' })), /colour/i);
assert.throws(() => a.parseCategory(form({ slug: 'ok', name: 'x', parent_slug: 'ok' })), /own parent/i);

const list = a.releaseChecklist({ active: true, price_inr: 0, file_url: null, release_approved: false, scan_status: 'pending', third_party: false });
assert.deepEqual(list.map(i => i.ok), [true, false, false, false, false]);
console.log('Admin catalogue checks passed: sale parsing (IST), category validation, release checklist.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-admin-catalogue.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/lib/admin-catalogue.ts`:

```ts
import type { Book } from "./db";
import { PublishingError } from "./submissions";

const text = (form: FormData, name: string, max: number) => {
  const value = form.get(name);
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max) throw new PublishingError(`Invalid ${name}.`);
  return value.trim();
};
// Admin enters India time in datetime-local inputs; store it as an explicit +05:30 instant.
const istInstant = (value: string, name: string) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new PublishingError(`Invalid ${name}.`);
  return `${value}:00+05:30`;
};

export function parseSale(form: FormData, regularPaise: number) {
  const raw = text(form, "sale_price", 20);
  const starts = istInstant(text(form, "sale_starts_at", 20), "sale start");
  const ends = istInstant(text(form, "sale_ends_at", 20), "sale end");
  if (!raw) return { sale_price_inr: null, sale_starts_at: null, sale_ends_at: null };
  const paise = Math.round(Number(raw) * 100);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(paise) || paise <= 0 || paise >= regularPaise)
    throw new PublishingError("The sale price must be above zero and below the regular price.");
  if (starts && ends && Date.parse(starts) >= Date.parse(ends)) throw new PublishingError("The sale end must be after its start.");
  return { sale_price_inr: paise, sale_starts_at: starts, sale_ends_at: ends };
}

export function parseCategory(form: FormData) {
  const slug = text(form, "slug", 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new PublishingError("Use a lowercase category slug.");
  const name = text(form, "name", 80);
  if (!name) throw new PublishingError("A category name is required.");
  const parent = text(form, "parent_slug", 80) || null;
  if (parent === slug) throw new PublishingError("A category cannot be its own parent.");
  const colour = text(form, "colour", 7) || null;
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) throw new PublishingError("Use a colour like #2563EB.");
  const image = text(form, "image_url", 2000) || null;
  if (image && !(image.startsWith("/") && !image.startsWith("//")) && !image.startsWith("https://")) throw new PublishingError("Use a site path or an HTTPS image URL.");
  const sort = Number(text(form, "sort", 7) || 0);
  if (!Number.isSafeInteger(sort) || Math.abs(sort) > 100000) throw new PublishingError("Invalid sort order.");
  const status = text(form, "status", 10) || "published";
  if (!["draft", "published", "archived"].includes(status)) throw new PublishingError("Invalid status.");
  return { slug, name, parent_slug: parent, image_url: image, colour, sort, status: status as "draft" | "published" | "archived" };
}

export function releaseChecklist(book: Pick<Book, "active" | "price_inr" | "file_url" | "release_approved" | "scan_status" | "third_party" | "rights_approved" | "commercial_approved">) {
  return [
    { label: "Visible in the store", ok: book.active },
    { label: "Regular price set", ok: book.price_inr > 0 },
    { label: "Paid file attached", ok: !!book.file_url },
    { label: "File scan clean", ok: book.scan_status === "clean" },
    { label: "Released for sale", ok: book.release_approved === true },
    ...(book.third_party ? [{ label: "Rights and commercial terms approved", ok: !!book.rights_approved && !!book.commercial_approved }] : []),
  ];
}
```

In `src/app/api/admin/book/route.ts`:
1. Change the allowed-fields logic:

```ts
    const allowed = action === 'release' ? ['action', 'slug', 'submission_id', 'reason', 'confirmed']
      : action === 'archive' || action === 'restore' ? ['action', 'slug', 'reason', 'confirmed']
      : action === 'create' ? ['action', 'slug', 'title']
      : action === 'pricing' ? ['action', 'slug', 'sale_price', 'sale_starts_at', 'sale_ends_at']
      : ['action', 'slug', 'title', 'subtitle', 'price_inr', 'publisher', 'isbn', 'pages', 'year', 'cover', 'description', 'long_description', 'authorship', 'facts', 'highlights', 'active',
         'category_slug', 'release_date', 'language', 'edition', 'file_format', 'author_slug'];
    if (!['save', 'release', 'archive', 'restore', 'create', 'pricing'].includes(String(action)) || …
```

2. Add branches before the final `else` (save):

```ts
    } else if (action === 'create') {
      const title = textField(form.get('title'), 200, true);
      const rows = await sql`with created as (
        insert into books(slug,title,price_inr,active,release_approved) values(${slug},${title},0,false,false)
        on conflict (slug) do nothing returning slug
      ), audit as (insert into events(order_id,type,payload) select null,'admin.book.created',jsonb_build_object('slug',slug) from created)
      select slug from created`;
      if (!rows.length) throw new PublishingError('A book with that slug already exists.', 409);
    } else if (action === 'pricing') {
      const current = await sql`select price_inr from books where slug=${slug}` as { price_inr: number }[];
      if (!current.length) throw new PublishingError('Book not found.', 404);
      const sale = parseSale(form, current[0].price_inr);
      // Offers change only what is charged, not the file or rights, so the release stands.
      await sql`with changed as (
        update books set sale_price_inr=${sale.sale_price_inr}, sale_starts_at=${sale.sale_starts_at}::timestamptz, sale_ends_at=${sale.sale_ends_at}::timestamptz
        where slug=${slug} returning slug
      ), audit as (insert into events(order_id,type,payload) select null,'admin.book.pricing',jsonb_build_object('slug',slug,'sale_price_inr',${sale.sale_price_inr}::int,'starts',${sale.sale_starts_at}::text,'ends',${sale.sale_ends_at}::text) from changed)
      select slug from changed`;
```

3. In the save branch, validate and write the new fields:

```ts
      const categorySlug = textField(form.get('category_slug'), 80) || null;
      if (categorySlug && !(await sql`select 1 from categories where slug=${categorySlug}`).length) throw new PublishingError('Choose an existing category.');
      const releaseDate = textField(form.get('release_date'), 10) || null;
      if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new PublishingError('Invalid release date.');
      const language = textField(form.get('language'), 60) || null;
      const edition = textField(form.get('edition'), 120) || null;
      const fileFormat = textField(form.get('file_format'), 10) || 'PDF';
      if (!['PDF', 'EPUB'].includes(fileFormat)) throw new PublishingError('Choose PDF or EPUB.');
      const authorSlug = textField(form.get('author_slug'), 120) || null;
      if (authorSlug && !(await sql`select 1 from author_profiles where id=${authorSlug}`).length) throw new PublishingError('Choose an existing author profile.');
```

and add to the `update books set` list: `category_slug = ${categorySlug}, release_date = ${releaseDate}::date, language = ${language}, edition = ${edition}, file_format = ${fileFormat}, author_slug = ${authorSlug},`. If the new regular price would make an existing sale invalid, clear it in the same update: `sale_price_inr = case when sale_price_inr < ${pricePaise} then sale_price_inr else null end,`.

4. Add `revalidatePath('/search')` and `revalidatePath('/category/[slug]', 'page')` after the existing `revalidatePath` calls. Import `parseSale` from `@/lib/admin-catalogue`.

Create `src/app/api/admin/categories/route.ts`:

```ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { checkOrigin } from "@/lib/reader-auth";
import { PublishingError, readLimitedForm } from "@/lib/submissions";
import { parseCategory } from "@/lib/admin-catalogue";

export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  try {
    const c = parseCategory(await readLimitedForm(req, 20000));
    if (c.parent_slug && !(await sql`select 1 from categories where slug=${c.parent_slug}`).length) throw new PublishingError("Choose an existing parent category.");
    await sql`with saved as (
      insert into categories(slug,name,parent_slug,image_url,colour,sort,status) values(${c.slug},${c.name},${c.parent_slug},${c.image_url},${c.colour},${c.sort},${c.status})
      on conflict (slug) do update set name=excluded.name,parent_slug=excluded.parent_slug,image_url=excluded.image_url,colour=excluded.colour,sort=excluded.sort,status=excluded.status,updated_at=now()
      returning slug
    ), audit as (insert into events(order_id,type,payload) select null,'admin.category.saved',jsonb_build_object('slug',slug) from saved)
    select slug from saved`;
    revalidatePath("/"); revalidatePath("/admin/categories");
    return NextResponse.redirect(new URL("/admin/categories?saved=1", req.url), 303);
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Category save failed");
    return NextResponse.json({ error: "Could not save the category." }, { status: 503 });
  }
}
```

(Archiving is `status=archived`; there is no delete, per the archive-not-delete rule.)

Create `src/app/admin/categories/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories", robots: { index: false, follow: false } };
type Row = { slug: string; name: string; parent_slug: string | null; image_url: string | null; colour: string | null; sort: number; status: string; books: number };

export default async function Categories({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { saved } = await searchParams;
  const rows = await sql`select c.*, (select count(*)::int from books b where b.category_slug=c.slug) books
    from categories c order by c.sort, c.name` as Row[];
  const form = (c?: Row) => <form action="/api/admin/categories" method="post" className="grid gap-3 sm:grid-cols-4">
    <label className="text-sm">Name<input name="name" required maxLength={80} className="field-input mt-1" defaultValue={c?.name} /></label>
    <label className="text-sm">Slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" readOnly={!!c} className="field-input mt-1" defaultValue={c?.slug} /></label>
    <label className="text-sm">Parent<select name="parent_slug" className="field-input mt-1" defaultValue={c?.parent_slug ?? ""}><option value="">None</option>
      {rows.filter((r) => r.slug !== c?.slug).map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></label>
    <label className="text-sm">Colour<input name="colour" type="color" className="field-input mt-1 h-[46px]" defaultValue={c?.colour ?? "#FFD93D"} /></label>
    <label className="text-sm sm:col-span-2">Image URL<input name="image_url" maxLength={2000} className="field-input mt-1" defaultValue={c?.image_url ?? ""} /></label>
    <label className="text-sm">Order<input name="sort" type="number" className="field-input mt-1" defaultValue={c?.sort ?? 0} /></label>
    <label className="text-sm">Status<select name="status" className="field-input mt-1" defaultValue={c?.status ?? "published"}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
    <button className="btn btn-primary sm:col-span-4 justify-self-start" type="submit">{c ? "Save category" : "Add category"}</button>
  </form>;
  return <AdminShell active="categories" title="Categories" subtitle="Categories drive the header, category pages, homepage tiles and filters.">
    {saved && <p role="status" className="mb-6 text-sm">Saved.</p>}
    <section className="mb-10 rounded-lg border border-line bg-white p-5"><h2 className="mb-4 font-semibold">New category</h2>{form()}</section>
    {rows.map((c) => <details key={c.slug} className="mb-3 rounded-lg border border-line bg-white p-4">
      <summary className="flex cursor-pointer items-center gap-3"><span className="inline-block h-4 w-4 rounded" style={{ background: c.colour ?? "#ddd" }} />
        <span className="font-medium">{c.name}</span><span className="text-sm text-ink-soft">{c.books} books · {c.status}</span></summary>
      <div className="pt-4">{form(c)}</div></details>)}
  </AdminShell>;
}
```

Create `src/app/admin/books/BookForm.tsx` (server component rendering the edit form for first-party books; it replaces the existing first-party `<form>` markup in `src/app/admin/books/page.tsx`):

```tsx
import type { Book } from "@/lib/db";
import { currentPrice } from "@/lib/money";
import { releaseChecklist } from "@/lib/admin-catalogue";

const input = "field-input mt-1";
const toLocal = (value: string | null | undefined) => {
  if (!value) return "";
  const ist = new Date(Date.parse(value) + 330 * 60000).toISOString(); // display in India time
  return ist.slice(0, 16);
};

export default function BookForm({ book, categories, authors }: { book: Book; categories: { slug: string; name: string }[]; authors: { id: string; name: string }[] }) {
  const price = currentPrice(book);
  const field = (name: keyof Book | string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    <label className="text-sm">{label}<input name={name} className={input} defaultValue={String((book as Record<string, unknown>)[name] ?? "")} {...props} /></label>;
  return <section className="rounded-lg border border-line bg-white p-6">
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-xl font-semibold">{book.title}</h2>
      <a className="text-sm underline" href={`/books/${encodeURIComponent(book.slug)}`} target="_blank" rel="noopener noreferrer">View in store</a>
    </div>
    <ul className="mb-6 flex flex-wrap gap-2" aria-label="Release checklist">{releaseChecklist(book).map((item) =>
      <li key={item.label} className={`rounded-full px-3 py-1 text-xs font-medium ${item.ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{item.ok ? "Done" : "Missing"}: {item.label}</li>)}</ul>

    <form action="/api/admin/book" method="post" className="mb-8 grid gap-4 rounded-lg bg-bg-2 p-4 sm:grid-cols-4">
      <input type="hidden" name="action" value="pricing" /><input type="hidden" name="slug" value={book.slug} />
      <p className="text-sm sm:col-span-4"><strong>Offer.</strong> Regular price ₹{(book.price_inr / 100).toFixed(2)}{price.onSale ? ` · on sale now at ₹${(price.price / 100).toFixed(2)}` : ""}. Changing the offer does not affect the release.</p>
      <label className="text-sm">Sale price (₹)<input name="sale_price" inputMode="decimal" className={input} defaultValue={book.sale_price_inr ? (book.sale_price_inr / 100).toFixed(2) : ""} /></label>
      <label className="text-sm">Starts (India time)<input name="sale_starts_at" type="datetime-local" className={input} defaultValue={toLocal(book.sale_starts_at)} /></label>
      <label className="text-sm">Ends (India time)<input name="sale_ends_at" type="datetime-local" className={input} defaultValue={toLocal(book.sale_ends_at)} /></label>
      <button className="btn btn-primary self-end" type="submit">Save offer</button>
    </form>

    <form action="/api/admin/book" method="post" className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="action" value="save" /><input type="hidden" name="slug" value={book.slug} />
      {field("title", "Title", { required: true, maxLength: 200 })}
      {field("subtitle", "Subtitle", { maxLength: 200 })}
      {field("authorship", "Author line", { maxLength: 500 })}
      <label className="text-sm">Author profile<select name="author_slug" className={input} defaultValue={book.author_slug ?? ""}><option value="">None</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="text-sm">Category<select name="category_slug" className={input} defaultValue={book.category_slug ?? ""}><option value="">None</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
      {field("language", "Language", { maxLength: 60 })}
      <label className="text-sm">Format<select name="file_format" className={input} defaultValue={book.file_format ?? "PDF"}><option>PDF</option><option>EPUB</option></select></label>
      {field("edition", "Edition", { maxLength: 120 })}
      {field("price_inr", "Regular price (₹)", { required: true, inputMode: "decimal", defaultValue: (book.price_inr / 100).toFixed(2) })}
      <label className="text-sm">Release date<input name="release_date" type="date" className={input} defaultValue={book.release_date ? String(book.release_date).slice(0, 10) : ""} /></label>
      {field("publisher", "Publisher", { maxLength: 200 })}
      {field("isbn", "ISBN", { maxLength: 32 })}
      {field("pages", "Pages", { inputMode: "numeric" })}
      {field("year", "Year", { inputMode: "numeric" })}
      {field("cover", "Cover URL", { maxLength: 2000 })}
      <label className="text-sm sm:col-span-2">Short description<textarea name="description" rows={3} className={input} defaultValue={book.description ?? ""} /></label>
      <label className="text-sm sm:col-span-2">About the book<textarea name="long_description" rows={6} className={input} defaultValue={book.long_description ?? ""} /></label>
      <label className="text-sm">Contents and highlights (one per line)<textarea name="highlights" rows={5} className={input} defaultValue={(book.highlights || []).join("\n")} /></label>
      <label className="text-sm">Details (Key: Value per line)<textarea name="facts" rows={5} className={input} defaultValue={Object.entries(book.facts || {}).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}: ${v}`).join("\n")} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={book.active} /> Visible in the store</label>
      <p className="text-sm text-ink-soft sm:col-span-2">Saving these details requires a new release before the book can be sold again (this protects buyers from silent file or price changes).</p>
      <button className="btn btn-primary justify-self-start" type="submit">Save details</button>
    </form>
  </section>;
}
```

Note: `field(…, { defaultValue })` for `price_inr` overrides the generic default via the spread; keep the spread after `defaultValue` in `field` so explicit props win.

In `src/app/admin/books/page.tsx`: load `categories` (`select slug,name from categories where status<>'archived' order by sort,name`) and `authors` (`select id,name from author_profiles order by name`), render a "New book" form at the top:

```tsx
<form action="/api/admin/book" method="post" className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
  <input type="hidden" name="action" value="create" />
  <label className="text-sm">Title<input name="title" required maxLength={200} className="field-input mt-1" /></label>
  <label className="text-sm">Slug<input name="slug" required maxLength={101} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field-input mt-1" /></label>
  <button className="btn btn-primary" type="submit">Create draft book</button>
</form>
```

Add a search box (`<form method="get"><input name="q" …></form>`) and filter `books` by `q` in title/slug/authorship; change the `AdminShell active="books"`; replace each first-party book's inline form with `<BookForm book={b} categories={categories} authors={authors} />` wrapped in `<details>` whose summary shows title, category, price and checklist status so the page stays scannable with 60+ books. Keep the third-party archive/restore block as it is.

Register `'scripts/test-admin-catalogue.mjs'` in `scripts/test-all.mjs` after `'scripts/test-demo-catalogue.mjs'`.

- [ ] **Step 4: Run tests**

Run: `node --import tsx scripts/test-admin-catalogue.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-catalogue.ts src/app/api/admin/book/route.ts src/app/admin/books src/app/admin/categories src/app/api/admin/categories scripts/test-admin-catalogue.mjs scripts/test-all.mjs
git commit -m "Admin: create books, edit full details, set offers without un-releasing, manage categories"
```

---

### Task A9: Collections book picker and admin orders

**Files:**
- Create: `src/app/admin/platform/BookPicker.tsx`
- Modify: `src/app/admin/platform/[section]/page.tsx` (use `BookPicker` for collections)
- Create: `src/app/admin/orders/page.tsx`
- Create: `src/app/admin/orders/[id]/page.tsx`
- Create: `src/lib/admin-orders.ts`
- Create: `scripts/test-admin-orders.mjs`
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces in `src/lib/admin-orders.ts`:

```ts
export type OrderFilter = { q: string; status: string; from: string; to: string; page: number };
export function parseOrderFilter(params: Record<string, string | string[] | undefined>): OrderFilter;
export async function listOrders(filter: OrderFilter, pageSize?: number): Promise<{ rows: AdminOrderRow[]; total: number }>;
export type AdminOrderRow = { id: string; name: string | null; email: string; total: number; status: string; created_at: string; items: { title: string; price: number; list_price?: number }[] };
```

- [ ] **Step 1: Write the failing test**

Create `scripts/test-admin-orders.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { load } from './test-commerce.mjs';

const db = new PGlite();
await db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const n of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort())
  await db.exec(readFileSync(new URL(`../migrations/${n}`, import.meta.url), 'utf8'));
const sql = async (parts, ...v) => (await db.query(parts.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), v)).rows;
const orders = load('src/lib/admin-orders.ts', { './db': { sql } });

for (let i = 0; i < 30; i++)
  await db.query(`insert into orders(id,email,name,items,subtotal,total,status,created_at) values($1,$2,$3,'[]',100,100,$4,$5)`,
    [`order-${i}`, i % 2 ? 'asha@example.com' : 'ravi@example.com', i % 2 ? 'Asha' : 'Ravi', i % 3 ? 'fulfilled' : 'created', `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`]);

const f = orders.parseOrderFilter({ q: ' ASHA ', status: 'fulfilled', page: '2' });
assert.deepEqual(f, { q: 'asha', status: 'fulfilled', from: '', to: '', page: 2 });
assert.equal(orders.parseOrderFilter({ status: 'drop table', page: '-4' }).status, '');
assert.equal(orders.parseOrderFilter({ page: 'x' }).page, 1);

const all = await orders.listOrders(orders.parseOrderFilter({}), 10);
assert.equal(all.total, 30);
assert.equal(all.rows.length, 10);
const asha = await orders.listOrders(orders.parseOrderFilter({ q: 'asha', status: 'fulfilled' }), 50);
assert.ok(asha.rows.every(r => r.email === 'asha@example.com' && r.status === 'fulfilled'));
const wildcard = await orders.listOrders(orders.parseOrderFilter({ q: '%' }), 50);
assert.equal(wildcard.total, 0, 'a percent sign is a literal, not a wildcard');
const ranged = await orders.listOrders(orders.parseOrderFilter({ from: '2026-10-05', to: '2026-10-06' }), 50);
assert.ok(ranged.rows.every(r => r.created_at >= '2026-10-05' && r.created_at < '2026-10-07'));
await db.close();
console.log('Admin order checks passed: filters, literal search, date range, pagination.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-admin-orders.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/lib/admin-orders.ts`:

```ts
import { sql } from "./db";

export type OrderFilter = { q: string; status: string; from: string; to: string; page: number };
export type AdminOrderRow = { id: string; name: string | null; email: string; total: number; status: string; created_at: string;
  items: { title: string; price: number; list_price?: number }[] };
const STATUSES = ["created", "paid", "fulfilled", "payment_failed", "refunded"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";

export function parseOrderFilter(params: Record<string, string | string[] | undefined>): OrderFilter {
  const page = Number(one(params.page));
  return { q: one(params.q).trim().toLowerCase().slice(0, 120), status: STATUSES.includes(one(params.status)) ? one(params.status) : "",
    from: date(one(params.from)), to: date(one(params.to)), page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
}

// Search is a literal substring match on id, email or name; LIKE wildcards in input are escaped.
export async function listOrders(f: OrderFilter, pageSize = 25) {
  const like = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;
  const status = f.status || null, from = f.from || null, to = f.to || null;
  // The neon tagged template cannot nest fragments, so the same predicate appears in both queries.
  const rows = await sql`select id,name,email,total,status,created_at::text,items from orders
    where (${like}::text is null or lower(id) like ${like} or lower(email) like ${like} or lower(coalesce(name,'')) like ${like})
      and (${status}::text is null or status = ${status}) and (${from}::date is null or created_at >= ${from}::date)
      and (${to}::date is null or created_at < ${to}::date + 1)
    order by created_at desc limit ${pageSize} offset ${(f.page - 1) * pageSize}` as AdminOrderRow[];
  const counted = await sql`select count(*)::int as n from orders
    where (${like}::text is null or lower(id) like ${like} or lower(email) like ${like} or lower(coalesce(name,'')) like ${like})
      and (${status}::text is null or status = ${status}) and (${from}::date is null or created_at >= ${from}::date)
      and (${to}::date is null or created_at < ${to}::date + 1)` as { n: number }[];
  return { rows, total: counted[0].n };
}
```

Create `src/app/admin/orders/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { listOrders, parseOrderFilter } from "@/lib/admin-orders";
import { rupees } from "@/lib/money";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders", robots: { index: false, follow: false } };
const PAGE = 25;

export default async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const filter = parseOrderFilter(await searchParams);
  const { rows, total } = await listOrders(filter, PAGE);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (page: number) => `/admin/orders?${new URLSearchParams({ ...(filter.q && { q: filter.q }), ...(filter.status && { status: filter.status }),
    ...(filter.from && { from: filter.from }), ...(filter.to && { to: filter.to }), page: String(page) })}`;
  return <AdminShell active="orders" title="Orders" subtitle={`${total} orders`} actions={<a className="btn btn-ghost" href="/api/admin/export">Export CSV</a>}>
    <form className="mb-6 flex flex-wrap items-end gap-3" role="search">
      <label className="text-sm">Search<input name="q" defaultValue={filter.q} placeholder="Order ID, email or name" className="field-input mt-1" /></label>
      <label className="text-sm">Status<select name="status" defaultValue={filter.status} className="field-input mt-1"><option value="">Any</option>
        {["created", "paid", "fulfilled", "payment_failed", "refunded"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
      <label className="text-sm">From<input type="date" name="from" defaultValue={filter.from} className="field-input mt-1" /></label>
      <label className="text-sm">To<input type="date" name="to" defaultValue={filter.to} className="field-input mt-1" /></label>
      <button className="btn btn-primary" type="submit">Filter</button>
    </form>
    <div className="overflow-x-auto rounded-lg border border-line bg-white"><table className="w-full text-sm">
      <thead><tr className="text-left text-ink-soft">{["Order", "Customer", "Items", "Total", "Status", "Date"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.map((o) => <tr key={o.id} className="border-t border-line">
        <td className="p-3"><Link className="underline" href={`/admin/orders/${encodeURIComponent(o.id)}`}>{o.id.slice(0, 10)}…</Link></td>
        <td className="p-3">{o.name || "—"}<br /><span className="text-ink-soft">{o.email}</span></td>
        <td className="p-3">{o.items.map((i) => i.title).join(", ")}</td>
        <td className="p-3">{rupees(o.total)}</td><td className="p-3">{o.status.replace("_", " ")}</td>
        <td className="p-3">{new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>)}</tbody>
    </table>{!rows.length && <p className="p-6 text-sm">No orders match these filters.</p>}</div>
    <nav className="mt-4 flex gap-3 text-sm" aria-label="Pages">{filter.page > 1 && <Link href={href(filter.page - 1)}>Previous</Link>}
      <span>Page {filter.page} of {pages}</span>{filter.page < pages && <Link href={href(filter.page + 1)}>Next</Link>}</nav>
  </AdminShell>;
}
```

Create `src/app/admin/orders/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getOrder, sql } from "@/lib/db";
import { rupees } from "@/lib/money";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";
export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const order = await getOrder((await params).id);
  if (!order) notFound();
  const events = await sql`select type, created_at::text from events where order_id=${order.id} order by created_at desc limit 50` as { type: string; created_at: string }[];
  return <AdminShell active="orders" title={`Order ${order.id.slice(0, 10)}…`} subtitle={`${order.status.replace("_", " ")} · ${order.email}`}>
    <section className="mb-8 rounded-lg border border-line bg-white p-5"><h2 className="mb-3 font-semibold">Items (as purchased)</h2>
      <ul className="grid gap-2 text-sm">{order.items.map((i) => <li key={i.slug} className="flex justify-between gap-4"><span>{i.title}{i.edition ? ` · ${i.edition}` : ""}</span>
        <span>{"list_price" in i && typeof i.list_price === "number" && i.list_price > i.price ? <><s className="mr-2 text-ink-soft">{rupees(i.list_price)}</s>{rupees(i.price)}</> : rupees(i.price)}</span></li>)}</ul>
      <p className="mt-4 text-sm">Subtotal {rupees(order.subtotal)} · Tax {rupees(order.tax)} · <strong>Total {rupees(order.total)}</strong></p></section>
    <section className="rounded-lg border border-line bg-white p-5"><h2 className="mb-3 font-semibold">History</h2>
      <ul className="grid gap-1 text-sm">{events.map((e, n) => <li key={n}>{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {e.type}</li>)}</ul></section>
  </AdminShell>;
}
```

`OrderItem` in `src/lib/db.ts` gets `list_price?: number;` (also used in Task C6).

Create `src/app/admin/platform/BookPicker.tsx`:

```tsx
"use client";
import { useState } from "react";

export default function BookPicker({ books, selected }: { books: { slug: string; title: string }[]; selected: string[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  return <fieldset className="min-w-0"><legend className="mb-2 text-sm">Books ({selected.length} selected)</legend>
    <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter books" aria-label="Filter books" className="field-input mb-3" />
    <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">{books.map((book) =>
      <label key={book.slug} hidden={!!needle && !book.title.toLowerCase().includes(needle)} className="flex items-start gap-2 text-sm">
        <input className="mt-1" type="checkbox" name="book_slugs" value={book.slug} defaultChecked={selected.includes(book.slug)} /><span className="min-w-0 break-words">{book.title}</span></label>)}</div>
  </fieldset>;
}
```

Hidden checkboxes stay in the form, so filtering never drops a selection on save. In `[section]/page.tsx` replace the collections `<fieldset>…</fieldset>` with `<BookPicker books={books} selected={Array.isArray(record.book_slugs) ? record.book_slugs as string[] : []} />`.

Register `'scripts/test-admin-orders.mjs'` in `scripts/test-all.mjs`.

- [ ] **Step 4: Run tests**

Run: `node --import tsx scripts/test-admin-orders.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-orders.ts src/app/admin/orders src/app/admin/platform scripts/test-admin-orders.mjs scripts/test-all.mjs src/lib/db.ts
git commit -m "Admin: searchable orders with detail view, and a filterable collection book picker"
```

---

### Task A10: Admin browser check

**Files:**
- Create: `scripts/check-admin.mjs`
- Modify: `package.json` (script `test:admin`)

**Interfaces:**
- Consumes: preview started with a known token: `ADMIN_TOKEN=<64 hex> npm run preview:isolated -- 3100` (Task A1 honours the env override).

- [ ] **Step 1: Write the check**

Create `scripts/check-admin.mjs`:

```js
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.PREVIEW_URL || 'http://localhost:3100';
const token = process.env.ADMIN_TOKEN;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Admin checks must target the isolated preview.');
assert.match(token || '', /^[a-f0-9]{64}$/, 'Start the preview with ADMIN_TOKEN=<64 hex> and pass the same value here.');
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
try {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel('Admin token').fill(token);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base}/admin`);
  for (const [link, heading] of [['Orders', 'Orders'], ['Books', 'Books'], ['Categories', 'Categories'], ['Authors', 'Authors'],
    ['Collections', 'Collections'], ['Banners', 'Banners'], ['Homepage sections', 'Homepage sections'], ['Submissions', 'Submissions'], ['Delivery recovery', 'Delivery recovery']]) {
    await page.getByRole('navigation').getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  // Create a category, a draft book, set an offer, and confirm the store reflects it.
  await page.goto(`${base}/admin/categories`);
  await page.getByLabel('Name').first().fill('Poetry');
  await page.getByLabel('Slug').first().fill('poetry');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText('Poetry')).toBeVisible();
  await page.goto(`${base}/admin/books`);
  await page.getByLabel('Title').first().fill('Admin check title');
  await page.getByLabel('Slug').first().fill('admin-check-title');
  await page.getByRole('button', { name: 'Create draft book' }).click();
  await expect(page.getByText('Admin check title')).toBeVisible();
  const demo = page.locator('details', { hasText: 'The Monsoon Ledger' });
  await demo.locator('summary').click();
  await demo.getByLabel('Sale price (₹)').fill('150');
  await demo.getByRole('button', { name: 'Save offer' }).click();
  await page.goto(`${base}/books/demo-the-monsoon-ledger`);
  await expect(page.getByText('₹150')).toBeVisible();
  // Schedule a banner that ended yesterday; it must not appear.
  await page.goto(`${base}/admin/platform/modules?type=banner`);
  await page.getByText('New module').click();
  await page.getByLabel('Title').first().fill('Expired banner check');
  await page.getByLabel('Status').first().selectOption('published');
  await page.getByLabel('Ends at (with timezone)').first().fill(new Date(Date.now() - 86400000).toISOString());
  await page.getByRole('button', { name: 'Save' }).first().click();
  await page.goto(base);
  await expect(page.getByText('Expired banner check')).toHaveCount(0);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
console.log('Admin browser check passed: sign-in, every section, category, draft book, offer reflected in store, expired banner hidden.');
```

Add to `package.json` scripts: `"test:admin": "node scripts/check-admin.mjs"`.

- [ ] **Step 2: Run against a fresh preview**

Run (two terminals):

```bash
ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") && echo $ADMIN_TOKEN > scratch/admin-token.txt && ADMIN_TOKEN=$ADMIN_TOKEN npm run preview:isolated -- 3100
```

```bash
ADMIN_TOKEN=$(cat scratch/admin-token.txt) npm run test:admin
```

Expected: "Admin browser check passed…". Fix any labels that differ from the selectors above in the page, not in the test, unless the test's label is wrong for the spec. (The store price assertion depends on Part B rendering sale prices; until Task B6 lands, the existing book page shows `₹150` only if it renders `currentPrice`. If running this before Part B, temporarily comment out the three lines from `await page.goto(\`${base}/books/demo-the-monsoon-ledger\`)` and re-enable them in Task B6 Step 5.)

- [ ] **Step 3: Commit**

```bash
git add scripts/check-admin.mjs package.json
git commit -m "Add an admin browser check covering every section and an offer round-trip"
```

---

# Part B — Storefront (direction A, bright retail)

Part B replaces the storefront frame and pages. `scripts/check-browser.mjs` still asserts the old homepage (hero, FAQ, Fraunces) until Task C7 rewrites it, so during Part B verify with `npm test`, `tsc` and screenshots, not `npm run test:browser`.

Screenshot routine used by every Part B task (preview running on 3100):

```bash
node -e "const {chromium}=require('@playwright/test');(async()=>{const b=await chromium.launch();const p=await b.newPage();for(const [w,h] of [[1440,900],[390,844]]){await p.setViewportSize({width:w,height:h});for(const r of process.argv.slice(1)){await p.goto('http://localhost:3100'+r,{waitUntil:'networkidle'});await p.screenshot({path:'scratch/b-'+(r.replace(/\W+/g,'_')||'home')+'-'+w+'.png',fullPage:true});}}await b.close();})()" / /search /category/science /books/demo-the-monsoon-ledger
```

Compare each screenshot with `scratch/ref-cw-0.jpg` … `ref-cw-3.jpg` (Crossword) and `scratch/reference-crossword-detail.png` / `reference-bookswagon-detail.png`. A task is not done until its screenshots show the pattern named in the task.

### Task B1: Visual tokens, fonts and base styles

**Files:**
- Modify: `package.json` (fonts)
- Modify: `src/app/layout.tsx` (font imports)
- Create: `src/styles/tokens.css`
- Modify: `src/app/globals.css` (import order; old tokens replaced)

**Interfaces:**
- Produces CSS custom properties used by every later stylesheet: `--yellow #FFD93D`, `--yellow-strong #F5C400`, `--ink #111111`, `--ink-2 #3F3F46`, `--muted #71717A`, `--line #E4E4E7`, `--page #F7F7F7`, `--card #FFFFFF`, `--offer #15803D`, `--offer-bg #DCFCE7`, `--sale #F04E37`, `--sky #BAE6FD`, `--lilac #DDD6FE`, `--green #166534`, `--radius-card 12px`, `--radius-btn 8px`, `--shadow-lift 0 12px 28px rgb(0 0 0 / 12%)`, `--font-head "Plus Jakarta Sans Variable"`, `--font-body "Inter Variable"`.
- Produces utility classes: `.wrap`, `.section`, `.btn`, `.btn-yellow`, `.btn-dark`, `.btn-outline`, `.chip`, `.pill-offer`, `.sr-only`, `.field-input`, `.field-label`, `.eyebrow`, `.section-head` (title + tagline + actions row).

- [ ] **Step 1: Swap font packages**

Run: `npm uninstall @fontsource-variable/fraunces @fontsource-variable/manrope && npm install @fontsource-variable/plus-jakarta-sans @fontsource-variable/inter`
Expected: both installed; `package.json` no longer lists Fraunces or Manrope.

- [ ] **Step 2: Write the failing test**

Add to `src/components/reading-room.test.cjs` (top level, after the `load` helper):

```js
const layoutSource = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert.match(layoutSource, /@fontsource-variable\/plus-jakarta-sans/);
assert.match(layoutSource, /@fontsource-variable\/inter/);
assert.doesNotMatch(layoutSource, /fraunces|manrope/i);
const tokens = fs.readFileSync(path.join(root, "styles/tokens.css"), "utf8");
for (const token of ["--yellow: #FFD93D", "--ink: #111111", "--page: #F7F7F7", "--offer: #15803D"]) assert.ok(tokens.includes(token), token);
assert.doesNotMatch(fs.readFileSync(path.join(root, "app/globals.css"), "utf8"), /Fraunces|Manrope|font-display/);
```

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL on the first assertion.

- [ ] **Step 3: Implement**

In `src/app/layout.tsx` replace the two fontsource imports with:

```ts
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
```

Create `src/styles/tokens.css`:

```css
:root {
  --yellow: #FFD93D; --yellow-strong: #F5C400; --ink: #111111; --ink-2: #3F3F46; --muted: #71717A;
  --line: #E4E4E7; --page: #F7F7F7; --card: #FFFFFF; --offer: #15803D; --offer-bg: #DCFCE7;
  --sale: #F04E37; --sky: #BAE6FD; --lilac: #DDD6FE; --green: #166534;
  --radius-card: 12px; --radius-btn: 8px; --shadow-lift: 0 12px 28px rgb(0 0 0 / 12%);
  --font-head: "Plus Jakarta Sans Variable", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
}
@layer base {
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.55 var(--font-body); -webkit-font-smoothing: antialiased; }
  h1, h2, h3, h4 { margin: 0; font-family: var(--font-head); font-weight: 750; letter-spacing: -0.01em; line-height: 1.15; overflow-wrap: anywhere; }
  p, figure { margin: 0; }
  a { color: inherit; text-decoration: none; }
  ul { margin: 0; padding: 0; list-style: none; }
  button, input, select, textarea { font: inherit; color: inherit; }
  button { cursor: pointer; }
  img { max-width: 100%; display: block; }
  :focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
}
@layer components {
  .wrap { width: 100%; max-width: 1360px; margin-inline: auto; padding-inline: 16px; }
  @media (min-width: 768px) { .wrap { padding-inline: 32px; } }
  .section { padding-block: 32px; }
  @media (min-width: 1024px) { .section { padding-block: 48px; } }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .eyebrow { font: 600 12px/1.4 var(--font-body); text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .section-head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px 24px; margin-bottom: 20px; }
  .section-head h2 { font-size: clamp(24px, 2.4vw, 34px); }
  .section-head p { color: var(--ink-2); margin-top: 4px; }
  .section-actions { display: flex; align-items: center; gap: 10px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 1.5px solid transparent;
    border-radius: var(--radius-btn); font: 650 14px/1.2 var(--font-body); transition: transform .15s, background .15s, box-shadow .15s; }
  .btn:active { transform: scale(.97); }
  .btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .btn-yellow { background: var(--yellow); color: var(--ink); }
  .btn-yellow:hover { background: var(--yellow-strong); }
  .btn-dark { background: var(--ink); color: #fff; }
  .btn-dark:hover { background: #2a2a2a; }
  .btn-outline { background: var(--card); border-color: var(--ink); color: var(--ink); }
  .btn-outline:hover { background: var(--ink); color: #fff; }
  .btn-primary { background: var(--ink); color: #fff; }
  .btn-ghost { background: var(--card); border-color: var(--line); }
  .round-btn { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); transition: background .15s; }
  .round-btn:hover:not(:disabled) { background: var(--ink); color: #fff; }
  .round-btn:disabled { opacity: .35; cursor: default; }
  .chip { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 12px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 550; }
  .chip:hover, .chip[aria-current] { border-color: var(--ink); }
  .chip[aria-current] { background: var(--ink); color: #fff; }
  .pill-offer { display: inline-flex; padding: 2px 8px; border-radius: 6px; background: var(--offer-bg); color: var(--offer); font: 700 12px/1.5 var(--font-body); white-space: nowrap; }
  .field-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  .field-input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-btn); background: var(--card); font-size: 16px; }
  .field-input:focus { border-color: var(--ink); outline: none; box-shadow: 0 0 0 3px rgb(17 17 17 / 12%); }
  .skip-link { position: fixed; top: -100px; left: 16px; z-index: 100; padding: 12px 18px; background: var(--ink); color: #fff; border-radius: var(--radius-btn); }
  .skip-link:focus { top: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

In `src/app/globals.css`: delete the `@theme { … }` block's font and colour entries that reference Fraunces/Manrope and the old green palette, keep `@import "tailwindcss";` first, then add `@import "../styles/tokens.css";`. Keep a reduced `@theme` mapping only what admin pages use via Tailwind utilities:

```css
@theme {
  --color-line: #E4E4E7; --color-ink: #111111; --color-ink-soft: #52525B; --color-bg-2: #F4F4F5; --color-brand: #111111; --color-danger: #B91C1C;
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
}
```

Delete from `globals.css` every rule that Task B2–B6 replaces (header, hero, subject-navigation, book-card, shelf, look-inside, feature, publishing-invitation, faq, catalogue-layout/facets, book-detail/buy-panel, author-card/author-hero, footer). Keep cart, checkout, order, legal (`.prose-legal`), `.catalogue` table and `.purchase-paused` rules for Task B7, but replace every `var(--font-display)` with `var(--font-head)` and `var(--color-brand)` with `var(--ink)`.

- [ ] **Step 4: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Start the preview and take the screenshot routine for `/`: text renders in Plus Jakarta Sans/Inter with no serif anywhere.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/styles/tokens.css src/app/globals.css src/components/reading-room.test.cjs
git commit -m "Replace serif type and muted palette with retail tokens (Plus Jakarta Sans, Inter, yellow and ink)"
```

---

### Task B2: Header, category bar with mega menu, and footer

**Files:**
- Modify: `src/components/StoreHeader.tsx`
- Create: `src/components/CategoryBar.tsx`
- Create: `src/components/SiteFooter.tsx`
- Create: `src/lib/navigation.ts`
- Create: `src/styles/header.css`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/components/reading-room.test.cjs`

**Interfaces:**
- Produces in `src/lib/navigation.ts` (pure):

```ts
export type NavCategory = { slug: string; name: string; children: { slug: string; name: string }[] };
export function buildNav(categories: { slug: string; name: string; parent_slug: string | null; sort: number }[], top?: number): { primary: NavCategory[]; more: NavCategory[] };
```

  `primary` = first `top` (default 7) root categories by `sort` with their children; `more` = remaining roots.
- `StoreHeader` props: `{ name: string; nav: { primary: NavCategory[]; more: NavCategory[] }; announcement: { title: string; link_url: string | null } | null }`.
- `SiteFooter` props: `{ name: string; categories: { slug: string; name: string }[] }`.
- Layout loads data with a guarded loader so a database error never takes down every page:

```ts
async function frameData() {
  try {
    const [categories, content] = await Promise.all([getCategories(), getPublicContent()]);
    const announcement = publicModules(content.modules).find((m) => m.type === "announcement") ?? null;
    return { nav: buildNav(categories), categories, announcement: announcement && { title: announcement.title, link_url: contentUrl(announcement.link_url) } };
  } catch { console.error("[layout] storefront frame data unavailable"); return { nav: { primary: [], more: [] }, categories: [], announcement: null }; }
}
```

- [ ] **Step 1: Write the failing test**

Add to `src/components/reading-room.test.cjs` (top level):

```js
const { buildNav } = load("lib/navigation.ts");
const cats = [
  { slug: "fiction", name: "Fiction", parent_slug: null, sort: 1 }, { slug: "crime", name: "Crime", parent_slug: "fiction", sort: 1 },
  { slug: "science", name: "Science", parent_slug: null, sort: 0 },
  ...Array.from({ length: 8 }, (_, i) => ({ slug: `c${i}`, name: `Cat ${i}`, parent_slug: null, sort: 10 + i })),
];
const nav = buildNav(cats, 7);
assert.deepEqual(nav.primary.slice(0, 2).map(c => c.slug), ["science", "fiction"]);
assert.deepEqual(nav.primary[1].children.map(c => c.slug), ["crime"]);
assert.equal(nav.primary.length, 7);
assert.equal(nav.more.length, 3);
assert.ok(!nav.primary.some(c => c.slug === "crime"), "children never appear as top-level items");
```

And a render check (inside `checkHomepage`, before its end):

```js
  const Header = load("components/StoreHeader.tsx", { "next/navigation": { usePathname: () => "/" } }).default;
  const header = renderToStaticMarkup(React.createElement(Header, { name: "Reading Room by INVENTAYU", nav,
    announcement: { title: "Festive reads: up to 20% off", link_url: "/search?offer=1" } }));
  assert.match(header, /Festive reads: up to 20% off/);
  assert.match(header, /href="\/category\/fiction"/);
  assert.match(header, /href="\/category\/crime"/);
  assert.match(header, /<form[^>]+action="\/search"/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Header, { name: "x", nav, announcement: null })), /announcement-bar/);
```

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL (`lib/navigation.ts` missing).

- [ ] **Step 2: Implement**

Create `src/lib/navigation.ts`:

```ts
export type NavCategory = { slug: string; name: string; children: { slug: string; name: string }[] };
type Row = { slug: string; name: string; parent_slug: string | null; sort: number };

export function buildNav(categories: Row[], top = 7) {
  const order = (a: Row, b: Row) => a.sort - b.sort || a.name.localeCompare(b.name);
  const roots = categories.filter((c) => !c.parent_slug).sort(order).map((root) => ({ slug: root.slug, name: root.name,
    children: categories.filter((c) => c.parent_slug === root.slug).sort(order).map(({ slug, name }) => ({ slug, name })) }));
  return { primary: roots.slice(0, top), more: roots.slice(top) };
}
```

Replace `src/components/StoreHeader.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Heart, Search, ShoppingBag, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCart } from "./CartProvider";
import CategoryBar from "./CategoryBar";
import type { NavCategory } from "@/lib/navigation";

export default function StoreHeader({ name, nav, announcement }: {
  name: string; nav: { primary: NavCategory[]; more: NavCategory[] }; announcement: { title: string; link_url: string | null } | null;
}) {
  const { slugs, ready } = useCart();
  const reduced = useReducedMotion();
  const [brand, by] = name.includes(" by ") ? [name.split(" by ")[0], name.split(" by ").slice(1).join(" by ")] : [name, ""];
  const count = ready ? slugs.length : 0;
  return <header className="site-header">
    {announcement && <div className="announcement-bar">{announcement.link_url ? <Link href={announcement.link_url}>{announcement.title}</Link> : announcement.title}</div>}
    <div className="header-yellow"><div className="wrap header-row">
      <Link href="/" className="logo" aria-label={`${name}, home`}><span className="logo-mark" aria-hidden="true">R</span><span>{brand}{by && <small>by {by}</small>}</span></Link>
      <form action="/search" className="header-search" role="search">
        <label htmlFor="site-search" className="sr-only">Search books, authors and categories</label>
        <input id="site-search" name="q" type="search" placeholder="Search by title, author or ISBN" autoComplete="off" />
        <button type="submit" aria-label="Search"><Search size={18} strokeWidth={2.2} aria-hidden="true" /></button>
      </form>
      <nav className="header-icons" aria-label="Your account">
        <Link href="/wishlist" aria-label="Wishlist"><Heart size={22} strokeWidth={2} aria-hidden="true" /></Link>
        <Link href="/library" aria-label="Your library"><UserRound size={22} strokeWidth={2} aria-hidden="true" /></Link>
        <Link href="/cart" aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`} className="bag-link">
          <ShoppingBag size={22} strokeWidth={2} aria-hidden="true" />
          <motion.span key={count} className="count-badge" initial={false} animate={{ scale: reduced ? 1 : [1, 1.25, 1] }} transition={{ duration: .25 }}>{count}</motion.span>
        </Link>
      </nav>
    </div></div>
    <CategoryBar nav={nav} />
  </header>;
}
```

(The heart count badge is added in Task C2; the search box becomes a combobox in Task C1.)

Create `src/components/CategoryBar.tsx` (server-safe markup; the mega menu opens on hover and on keyboard focus with CSS `:focus-within`, no JavaScript):

```tsx
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { NavCategory } from "@/lib/navigation";

export default function CategoryBar({ nav }: { nav: { primary: NavCategory[]; more: NavCategory[] } }) {
  const all = [...nav.primary, ...nav.more];
  if (!all.length) return null;
  return <nav className="category-bar" aria-label="Categories"><div className="wrap category-row">
    <div className="mega"><button type="button" className="mega-trigger" aria-haspopup="true">All categories <ChevronDown size={16} aria-hidden="true" /></button>
      <div className="mega-panel">{all.map((c) => <div key={c.slug}><Link className="mega-head" href={`/category/${c.slug}`}>{c.name}</Link>
        {c.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</div>)}</div></div>
    {nav.primary.map((c) => c.children.length
      ? <div className="mega" key={c.slug}><Link className="mega-trigger" href={`/category/${c.slug}`}>{c.name} <ChevronDown size={14} aria-hidden="true" /></Link>
          <div className="mega-panel small">{c.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</div></div>
      : <Link key={c.slug} href={`/category/${c.slug}`}>{c.name}</Link>)}
    <Link href="/search?offer=1" className="deal-link">Offers</Link>
  </div></nav>;
}
```

Create `src/components/SiteFooter.tsx`:

```tsx
import Link from "next/link";

export default function SiteFooter({ name, categories }: { name: string; categories: { slug: string; name: string }[] }) {
  const cols: [string, [string, string][]][] = [
    ["Shop", [["All books", "/search"], ["New arrivals", "/search?sort=new"], ["Offers", "/search?offer=1"], ["Wishlist", "/wishlist"]]],
    ["Your account", [["Library", "/library"], ["Bag", "/cart"], ["Sign in", "/login"]]],
    ["Help", [["Delivery and downloads", "/delivery-policy"], ["Refunds", "/refund-policy"], ["Privacy", "/privacy"], ["Terms", "/terms"]]],
    ["Authors", [["Publish with us", "/publish"], ["Author workspace", "/author"]]],
  ];
  return <footer className="site-footer"><div className="wrap">
    <div className="footer-cols">
      <div><Link href="/" className="logo"><span className="logo-mark" aria-hidden="true">R</span><span>{name}</span></Link>
        <p className="footer-about">Digital books from independent authors and publishers across India. Instant download, yours to keep.</p></div>
      {cols.map(([title, links]) => <div key={title}><h2>{title}</h2><ul>{links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul></div>)}
    </div>
    {categories.length > 0 && <div className="popular"><h2>Popular searches</h2><ul>{categories.slice(0, 16).map((c) =>
      <li key={c.slug}><Link className="chip" href={`/category/${c.slug}`}>{c.name}</Link></li>)}</ul></div>}
    <p className="footer-legal">© {new Date().getFullYear()} {name}. Digital editions only; nothing is shipped.</p>
  </div></footer>;
}
```

Update `src/app/layout.tsx`: make `RootLayout` async, add `frameData()` (Interfaces above) with imports `getCategories` from `@/lib/store-data`, `getPublicContent` from `@/lib/content`, `publicModules, contentUrl` from `@/components/content-data`, `buildNav` from `@/lib/navigation`; render `<StoreHeader name={STORE.name} nav={nav} announcement={announcement} />` and replace the inline `<footer>` with `<SiteFooter name={STORE.name} categories={categories} />`. Remove the `ArrowUpRight, BookOpen` import.

Create `src/styles/header.css` and import it in `globals.css` after tokens:

```css
@layer components {
  .announcement-bar { background: var(--ink); color: #fff; text-align: center; font: 600 13px/1.4 var(--font-body); padding: 8px 16px; }
  .announcement-bar a:hover { text-decoration: underline; }
  .header-yellow { background: var(--yellow); }
  .header-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px 32px; min-height: 76px; }
  .logo { display: inline-flex; align-items: center; gap: 10px; font: 800 20px/1.05 var(--font-head); }
  .logo small { display: block; font: 600 10px/1.2 var(--font-body); text-transform: uppercase; letter-spacing: .06em; }
  .logo-mark { display: grid; place-items: center; width: 38px; height: 38px; border: 2.5px solid var(--ink); border-radius: 8px; font: 800 20px/1 var(--font-head); background: #fff; }
  .header-search { position: relative; display: flex; align-items: center; max-width: 560px; width: 100%; justify-self: center; background: #fff; border-radius: 999px; padding-left: 18px; }
  .header-search input { flex: 1; min-width: 0; height: 44px; border: 0; background: transparent; font-size: 15px; }
  .header-search input:focus { outline: none; }
  .header-search:focus-within { box-shadow: 0 0 0 3px var(--ink); }
  .header-search > button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; background: transparent; }
  .header-icons { display: flex; align-items: center; gap: 6px; }
  .header-icons > a { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; }
  .header-icons > a:hover { background: rgb(0 0 0 / 8%); }
  .count-badge { position: absolute; top: 2px; right: 0; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: var(--ink); color: #fff; font: 700 11px/19px var(--font-body); text-align: center; }
  .category-bar { background: var(--card); border-bottom: 1px solid var(--line); }
  .category-row { display: flex; align-items: center; gap: 4px; min-height: 48px; overflow-x: auto; scrollbar-width: none; font: 600 14px/1 var(--font-body); }
  .category-row > a, .mega-trigger { display: inline-flex; align-items: center; gap: 4px; padding: 14px 12px; white-space: nowrap; border: 0; background: none; font: inherit; border-bottom: 2px solid transparent; }
  .category-row > a:hover, .mega:hover > .mega-trigger, .mega:focus-within > .mega-trigger { border-bottom-color: var(--ink); }
  .deal-link { color: var(--sale); margin-left: auto; }
  .mega { position: static; }
  .mega-panel { display: none; position: absolute; left: 0; right: 0; z-index: 40; background: var(--card); border-top: 1px solid var(--line); box-shadow: var(--shadow-lift);
    padding: 24px max(16px, calc((100vw - 1296px) / 2)); grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px 24px; }
  .mega:hover > .mega-panel, .mega:focus-within > .mega-panel { display: grid; }
  .mega-panel a { display: block; padding: 4px 0; font-weight: 500; }
  .mega-panel a:hover { text-decoration: underline; }
  .mega-head { font-weight: 750 !important; margin-bottom: 4px; }
  .site-header { position: relative; }
  .site-footer { background: var(--yellow); margin-top: 48px; padding-block: 48px 24px; }
  .footer-cols { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); gap: 32px; }
  .footer-cols h2, .popular h2 { font: 750 16px/1.3 var(--font-head); margin-bottom: 12px; }
  .footer-cols li a { display: inline-block; padding: 5px 0; font-size: 14px; }
  .footer-cols li a:hover { text-decoration: underline; }
  .footer-about { margin-top: 14px; max-width: 34ch; font-size: 14px; }
  .popular { margin-top: 32px; }
  .popular ul { display: flex; flex-wrap: wrap; gap: 8px; }
  .popular .chip { background: transparent; border-color: var(--ink); }
  .footer-legal { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgb(0 0 0 / 15%); font-size: 13px; }
  @media (max-width: 900px) {
    .header-row { grid-template-columns: auto auto; padding-block: 10px; }
    .header-search { grid-column: 1 / -1; grid-row: 2; max-width: none; }
    .header-icons { justify-self: end; }
    .footer-cols { grid-template-columns: 1fr 1fr; }
    .footer-cols > div:first-child { grid-column: 1 / -1; }
    .mega-panel { display: none !important; } /* touch devices browse via category pages */
  }
}
```

- [ ] **Step 3: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Screenshot `/` at 1440 and 390: black announcement bar, yellow header with logo, rounded white search pill and three icons, white category bar; hovering "All categories" shows the mega panel; yellow footer with "Popular searches" chips (compare `scratch/ref-cw-0.jpg` header and `ref-cw-3.jpg` footer).

- [ ] **Step 4: Commit**

```bash
git add src/components/StoreHeader.tsx src/components/CategoryBar.tsx src/components/SiteFooter.tsx src/lib/navigation.ts src/styles/header.css src/app/layout.tsx src/app/globals.css src/components/reading-room.test.cjs
git commit -m "Crossword-style frame: announcement bar, yellow header, category mega menu, yellow footer"
```

---

### Task B3: Product card, price block, cover and carousel

**Files:**
- Create: `src/components/Cover.tsx`
- Create: `src/components/Price.tsx`
- Modify: `src/components/BookCard.tsx` (rewrite; file name kept for existing test mocks)
- Create: `src/components/Carousel.tsx`
- Modify: `src/components/AddToCart.tsx` (labels and classes)
- Create: `src/styles/card.css`
- Test: `src/components/reading-room.test.cjs`

**Interfaces:**
- `Cover({ src, title, sizes, priority?, className? })` — renders `next/image`, `unoptimized` when `src` starts with `data:` or `https://`; renders a typographic placeholder with the title when `src` is null.
- `Price({ book, size? }: { book: Pick<PublicBook, "price" | "regular" | "onSale" | "saving" | "saleable">; size?: "card" | "page" })` — when not saleable: "Coming soon" if `comingSoon` else nothing; when on sale: `<s>₹regular</s> <strong>₹price</strong> <span class="pill-offer">₹saving off</span>`.
- `BookCard({ book, enabled })` default export (props unchanged) and named `Shelf` removed (replaced by `Carousel`). Card markup: `article.product-card > a.card-cover + div.card-body > h3 > a + p.card-author + Price + AddToCart`.
- `Carousel({ title, tagline?, href?, label, children })` client component: a `ul.carousel-track` of `li` items, round prev/next buttons that scroll by the visible width and disable at the ends, hidden entirely when nothing overflows; outlined "Show all" link when `href`.
- `AddToCart` labels: enabled → "Add to bag"; saving for later → "Save to bag"; in bag → "In your bag" link to `/cart`; classes `btn btn-yellow card-add`.

- [ ] **Step 1: Write the failing test**

Replace the `Card` mock-based assertions that reference `Shelf` in `src/components/reading-room.test.cjs` (the `Shelf: ({ books }) => …` key in `Card`) with nothing (remove `Shelf`), and add at top level after `pendingBook` is defined:

```js
const PriceView = load("components/Price.tsx").default;
const saleBook = publicBook({ ...record, price_inr: 29900, sale_price_inr: 25200 });
const priceHtml = renderToStaticMarkup(React.createElement(PriceView, { book: saleBook }));
assert.match(priceHtml, /<s[^>]*>₹299<\/s>/);
assert.match(priceHtml, /₹252/);
assert.match(priceHtml, /₹47 off/);
assert.equal(renderToStaticMarkup(React.createElement(PriceView, { book: { ...saleBook, saleable: false, comingSoon: false } })), "");
assert.match(renderToStaticMarkup(React.createElement(PriceView, { book: { ...saleBook, saleable: false, comingSoon: true } })), /Coming soon/);
const CardView = load("components/BookCard.tsx", {
  "./CartProvider": { useCart: () => cart }, "motion/react": { ...require("motion/react"), useReducedMotion: () => true },
}).default;
const cardHtml = renderToStaticMarkup(React.createElement(CardView, { book: saleBook, enabled: true }));
assert.match(cardHtml, /class="product-card"/);
assert.match(cardHtml, /Add to bag/);
assert.match(cardHtml, /href="\/books\/real-book"/);
assert.doesNotMatch(cardHtml, /private\/never-expose/);
const dataCover = renderToStaticMarkup(React.createElement(CardView, { book: { ...saleBook, cover: "data:image/svg+xml;utf8,%3Csvg%3E" }, enabled: true }));
assert.match(dataCover, /src="data:image\/svg\+xml/);
```

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL (`components/Price.tsx` missing).

- [ ] **Step 2: Implement**

Create `src/components/Cover.tsx`:

```tsx
import Image from "next/image";

export default function Cover({ src, title, sizes, priority, className }: { src: string | null; title: string; sizes: string; priority?: boolean; className?: string }) {
  if (!src) return <span className={`cover-fallback ${className ?? ""}`}>{title}</span>;
  return <Image src={src} alt={`Cover of ${title}`} width={600} height={900} sizes={sizes} preload={priority}
    unoptimized={src.startsWith("data:") || src.startsWith("https://")} className={className} />;
}
```

Create `src/components/Price.tsx`:

```tsx
import { rupees } from "@/lib/money";
import type { PublicBook } from "./book-data";

export default function Price({ book, size = "card" }: { book: Pick<PublicBook, "price" | "regular" | "onSale" | "saving" | "saleable" | "comingSoon">; size?: "card" | "page" }) {
  if (!book.saleable || book.price <= 0) return book.comingSoon ? <p className={`price-block ${size}`}><span className="soon-chip">Coming soon</span></p> : null;
  return <p className={`price-block ${size}`}>
    {book.onSale && <s className="price-regular" aria-label={`Regular price ${rupees(book.regular)}`}>{rupees(book.regular)}</s>}
    <strong className="price-now">{rupees(book.price)}</strong>
    {book.onSale && <span className="pill-offer">{rupees(book.saving)} off</span>}
  </p>;
}
```

Replace `src/components/BookCard.tsx`:

```tsx
import Link from "next/link";
import type { PublicBook } from "./book-data";
import AddToCart from "./AddToCart";
import Cover from "./Cover";
import Price from "./Price";

const href = (book: PublicBook) => `/books/${encodeURIComponent(book.slug)}`;

export default function BookCard({ book, enabled }: { book: PublicBook; index?: number; enabled: boolean }) {
  return <article className="product-card">
    <Link href={href(book)} className="card-cover" aria-label={`View ${book.title}`} tabIndex={-1}>
      <Cover src={book.cover} title={book.title} sizes="(max-width: 640px) 45vw, 220px" />
      {book.comingSoon && <span className="card-flag">Coming soon</span>}
    </Link>
    <div className="card-body">
      <h3><Link href={href(book)}>{book.title}</Link></h3>
      {book.authorship && <p className="card-author">{book.authorship}</p>}
      <Price book={book} />
      <AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} />
    </div>
  </article>;
}
```

Create `src/components/Carousel.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export default function Carousel({ title, tagline, href, label, children }: { title: string; tagline?: string; href?: string; label?: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
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
  const items = Children.toArray(children);
  if (!items.length) return null;
  return <section className="carousel" aria-label={label ?? title}>
    <div className="section-head"><div><h2>{title}</h2>{tagline && <p>{tagline}</p>}</div>
      <div className="section-actions">
        {!(edges.start && edges.end) && <>
          <button type="button" className="round-btn" onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous in ${title}`}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" className="round-btn" onClick={() => page(1)} disabled={edges.end} aria-label={`Next in ${title}`}><ChevronRight size={20} aria-hidden="true" /></button></>}
        {href && <Link className="btn btn-outline" href={href}>Show all <ArrowUpRight size={16} aria-hidden="true" /></Link>}
      </div></div>
    <ul ref={track} className="carousel-track" onScroll={measure}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
  </section>;
}
```

Update `src/components/AddToCart.tsx`: change `label` to `!canSave ? "Unavailable" : full ? "Bag is full" : enabled ? "Add to bag" : "Save to bag"`, the added state link text to "In your bag", and both button classes to `btn btn-yellow card-add` (link: `btn btn-outline card-add`). Keep `aria-label={\`${label}: ${title}\`}`. Update the existing assertion in `checkPausedSelection` from `Save to cart:` to `Save to bag:` and `/In your cart/` to `/In your bag/`; update `scripts/check-browser.mjs` line using `'Save to cart: Researching Research for Ayurveda'` to `'Save to bag: Researching Research for Ayurveda'` and `'In your cart'` to `'In your bag'`.

Create `src/styles/card.css` (import in `globals.css`):

```css
@layer components {
  .product-card { position: relative; display: flex; flex-direction: column; height: 100%; background: var(--card); border-radius: var(--radius-card); padding: 12px; transition: transform .2s, box-shadow .2s; }
  .product-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lift); }
  .card-cover { position: relative; display: grid; place-items: center; aspect-ratio: 3 / 4; border-radius: 8px; background: #fff; overflow: hidden; }
  .card-cover img { width: 100%; height: 100%; object-fit: contain; }
  .cover-fallback { display: grid; place-items: center; width: 100%; height: 100%; padding: 16px; background: var(--page); font: 750 16px/1.3 var(--font-head); text-align: center; }
  .card-flag { position: absolute; left: 8px; bottom: 8px; padding: 3px 8px; border-radius: 6px; background: var(--ink); color: #fff; font: 700 11px/1.4 var(--font-body); }
  .card-body { display: flex; flex-direction: column; gap: 4px; flex: 1; padding-top: 12px; }
  .card-body h3 { font: 650 14px/1.35 var(--font-body); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.7em; }
  .card-body h3 a:hover { text-decoration: underline; }
  .card-author { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price-block { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-height: 24px; margin-top: auto; padding-top: 4px; }
  .price-regular { color: var(--muted); font-size: 13px; }
  .price-now { font: 800 17px/1.2 var(--font-body); }
  .price-block.page .price-now { font-size: 32px; }
  .price-block.page .price-regular { font-size: 18px; }
  .soon-chip { padding: 3px 8px; border-radius: 6px; background: #E0F2FE; color: #075985; font: 700 12px/1.4 var(--font-body); }
  .card-add { width: 100%; margin-top: 8px; }
  .cart-control { width: 100%; }
  .carousel-track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, calc((100% - 5 * 16px) / 6)); gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding: 4px 4px 20px; margin: -4px; }
  .carousel-track > li { scroll-snap-align: start; min-width: 0; }
  @media (max-width: 1024px) { .carousel-track { grid-auto-columns: minmax(170px, calc((100% - 3 * 16px) / 4)); } }
  @media (max-width: 640px) { .carousel-track { grid-auto-columns: 44%; gap: 12px; } .product-card { padding: 8px; } }
  .grid-books { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
  @media (max-width: 640px) { .grid-books { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
}
```

Every remaining `Shelf` import (`src/app/page.tsx`, `src/app/books/[slug]/page.tsx`, `src/components/ContentSections.tsx`) is replaced in Tasks B4 and B6; to keep this task compiling, temporarily change each `<Shelf books={x} … />` to `<Carousel title={label}>{x.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel>` with the same label text.

- [ ] **Step 3: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Screenshot `/`: cards are white, cover on white, title, grey author, price row with struck price and green pill on demo sale titles, full-width yellow "Add to bag" (compare Crossword "Best Sellers" row in `scratch/ref-cw-0.jpg`).

- [ ] **Step 4: Commit**

```bash
git add src/components/Cover.tsx src/components/Price.tsx src/components/BookCard.tsx src/components/Carousel.tsx src/components/AddToCart.tsx src/styles/card.css src/app src/components scripts/check-browser.mjs
git commit -m "Crossword-style product card with offer price block, and an arrow carousel"
```

---

### Task B4: Homepage

**Files:**
- Create: `src/lib/home.ts`
- Create: `scripts/test-home.mjs`
- Create: `src/components/home/BannerCarousel.tsx`, `PromoGrid.tsx`, `GenreSwitcher.tsx`, `LanguageShelf.tsx`, `CategoryTiles.tsx`, `AuthorStrip.tsx`, `PublishBanner.tsx`
- Rewrite: `src/app/page.tsx`
- Create: `src/styles/home.css`
- Delete: `src/components/Hero.tsx`, `src/components/DiscoveryFeatures.tsx`, `src/components/ContentSections.tsx` and their tests in `reading-room.test.cjs`
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces in `src/lib/home.ts` (pure):

```ts
export type HomeInput = { books: PublicBook[]; categories: Category[]; modules: ContentModule[]; bestsellers: string[];
  authors: { id: string; name: string; photo_url: string | null }[]; now: Date };
export type Banner = { id: string; title: string; body: string | null; subtitle: string | null; image: string | null; mobileImage: string | null; href: string | null; label: string | null; theme: string };
export type Promo = { id: string; title: string; href: string | null; image: string | null; theme: string; size: "large" | "small"; books: PublicBook[] };
export type Home = { banners: Banner[]; promos: Promo[];
  rails: { key: "bestsellers" | "new" | "offers" | "soon"; title: string; tagline: string; href: string; books: PublicBook[] }[];
  genres: { slug: string; name: string; books: PublicBook[] }[]; languages: { name: string; glyph: string; count: number }[];
  categoryTiles: { slug: string; name: string; colour: string | null; image: string | null; covers: string[] }[];
  authors: { id: string; name: string; photo_url: string | null }[] };
export function buildHome(input: HomeInput): Home;
export const LANGUAGE_GLYPHS: Record<string, string>;
```

  Rules: banners = public `banner` modules in order (and the legacy `hero` module appended as a banner); promos = public `promo` modules, a large promo with `category_slug` gets up to 2 saleable books from that category; rails: bestsellers = `bestsellers` slugs that exist in `books` (order kept, max 12, omitted when empty — never filled with non-sellers), new = released books (not coming soon) sorted by `release_date` desc then `year` desc (max 12), offers = `onSale` books sorted by `saving` desc (max 12), soon = `comingSoon` sorted by `release_date` asc; any rail with 0 books is dropped; genres = `genre-switcher` payload `category_slugs` (or the first 5 categories with ≥ 2 books when no module) each with up to 12 books, categories with 0 books dropped; languages = distinct `book.language` with counts, sorted by count desc, glyph from `LANGUAGE_GLYPHS` or the first two letters; category tiles = categories with ≥ 1 book, up to 8, covers = first 3 book covers in that category; authors = published authors with ≥ 1 book whose `author_slug` matches, max 10.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-home.mjs`:

```js
import assert from 'node:assert/strict';
import { load } from './test-commerce.mjs';

// home.ts reaches content.ts (via content-data), which imports the database client; the pure helpers never call it.
const { buildHome, LANGUAGE_GLYPHS } = load('src/lib/home.ts', { './db': { sql() { throw new Error('No database in home tests'); } } });
const now = new Date('2026-10-15T00:00:00Z');
const book = (slug, extra = {}) => ({ slug, title: slug, cover: `/c/${slug}.png`, authorship: 'A', author_slug: null, category_slug: 'fiction', language: 'English',
  saleable: true, saveable: true, price: 100, regular: 100, onSale: false, saving: 0, comingSoon: false, release_date: '2026-01-01', year: 2026, ...extra });
const books = [book('a', { onSale: true, saving: 30, price: 70 }), book('b', { onSale: true, saving: 50, price: 50, language: 'Hindi' }),
  book('c', { comingSoon: true, release_date: '2026-11-01', saleable: false }), book('d', { category_slug: 'science', release_date: '2026-09-01', author_slug: 'au1' }),
  book('e', { category_slug: 'science', language: 'Hindi' })];
const categories = [{ slug: 'fiction', name: 'Fiction', colour: '#f00', image_url: null, parent_slug: null, sort: 0 },
  { slug: 'science', name: 'Science', colour: null, image_url: null, parent_slug: null, sort: 1 },
  { slug: 'empty', name: 'Empty', colour: null, image_url: null, parent_slug: null, sort: 2 }];
const mod = (id, type, extra = {}) => ({ id, type, title: id, body: null, image_url: null, mobile_image_url: null, link_url: null, link_label: null,
  payload: {}, sort: 0, status: 'published', publish_at: null, ends_at: null, ...extra });

const home = buildHome({ books, categories, now, bestsellers: ['ghost', 'd', 'a'],
  authors: [{ id: 'au1', name: 'Author One', photo_url: null }, { id: 'au2', name: 'No Books', photo_url: null }],
  modules: [mod('b1', 'banner', { sort: 2 }), mod('b0', 'banner', { sort: 1 }), mod('old', 'banner', { ends_at: '2026-10-01T00:00:00Z' }),
    mod('p1', 'promo', { payload: { size: 'large', category_slug: 'fiction', theme: 'coral' } }), mod('g', 'genre-switcher', { payload: { category_slugs: ['science', 'empty', 'fiction'] } })] });

assert.deepEqual(home.banners.map(b => b.id), ['b0', 'b1'], 'ordered, expired banner dropped');
assert.equal(home.promos[0].books.length, 2);
assert.ok(home.promos[0].books.every(b => b.category_slug === 'fiction' && b.saleable));
const rail = key => home.rails.find(r => r.key === key);
assert.deepEqual(rail('bestsellers').books.map(b => b.slug), ['d', 'a'], 'unknown slugs dropped, real order kept');
assert.deepEqual(rail('offers').books.map(b => b.slug), ['b', 'a']);
assert.deepEqual(rail('soon').books.map(b => b.slug), ['c']);
assert.ok(!rail('new').books.some(b => b.comingSoon));
assert.deepEqual(home.genres.map(g => g.slug), ['science', 'fiction'], 'empty genre dropped, admin order kept');
assert.deepEqual(home.languages.map(l => [l.name, l.count]), [['English', 3], ['Hindi', 2]]);
assert.equal(home.languages[1].glyph, LANGUAGE_GLYPHS.Hindi);
assert.deepEqual(home.categoryTiles.map(t => t.slug), ['fiction', 'science']);
assert.deepEqual(home.authors.map(a => a.id), ['au1']);

const empty = buildHome({ books: [], categories: [], modules: [], bestsellers: [], authors: [], now });
assert.deepEqual([empty.banners, empty.promos, empty.rails, empty.genres, empty.languages, empty.categoryTiles, empty.authors].map(x => x.length), [0, 0, 0, 0, 0, 0, 0]);
console.log('Home assembly checks passed: banner order and expiry, promo books, honest bestsellers, rails, genres, languages, tiles, authors.');
```

Register it in `scripts/test-all.mjs` after `'scripts/test-admin-orders.mjs'`.

Run: `node --import tsx scripts/test-home.mjs`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/home.ts`**

```ts
import type { PublicBook } from "@/components/book-data";
import type { ContentModule } from "./content";
import type { Category } from "./store-data";
import { contentUrl, publicModules } from "@/components/content-data";

// Native-script glyphs for the language shelf (written as characters, not escapes).
export const LANGUAGE_GLYPHS: Record<string, string> = {
  English: "Aa", Hindi: "हि", Marathi: "म", Gujarati: "ગ", Tamil: "த", Telugu: "తె", Bengali: "বা", Kannada: "ಕ", Malayalam: "മ", Sanskrit: "सं", Urdu: "اُ", Punjabi: "ਪੰ",
};
export type HomeInput = { books: PublicBook[]; categories: Category[]; modules: ContentModule[]; bestsellers: string[];
  authors: { id: string; name: string; photo_url: string | null }[]; now: Date };
export type Banner = { id: string; title: string; body: string | null; subtitle: string | null; image: string | null; mobileImage: string | null; href: string | null; label: string | null; theme: string };
export type Promo = { id: string; title: string; href: string | null; image: string | null; theme: string; size: "large" | "small"; books: PublicBook[] };
type RailKey = "bestsellers" | "new" | "offers" | "soon";
export type Home = ReturnType<typeof buildHome>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

export function buildHome({ books, categories, modules, bestsellers, authors, now }: HomeInput) {
  const live = publicModules(modules, now);
  const banners: Banner[] = live.filter((m) => m.type === "banner" || m.type === "hero").map((m) => ({
    id: m.id, title: m.title, body: m.body, subtitle: str(m.payload.subtitle), image: contentUrl(m.image_url), mobileImage: contentUrl(m.mobile_image_url),
    href: contentUrl(m.link_url), label: m.link_label, theme: str(m.payload.theme) ?? "yellow" }));
  const promos: Promo[] = live.filter((m) => m.type === "promo").map((m) => {
    const size = m.payload.size === "large" ? "large" : "small";
    const category = str(m.payload.category_slug);
    return { id: m.id, title: m.title, href: contentUrl(m.link_url), image: contentUrl(m.image_url), theme: str(m.payload.theme) ?? "yellow", size,
      books: size === "large" && category ? books.filter((b) => b.category_slug === category && b.saleable).slice(0, 2) : [] };
  });
  const bySlug = new Map(books.map((b) => [b.slug, b]));
  const released = books.filter((b) => !b.comingSoon);
  const rails: { key: RailKey; title: string; tagline: string; href: string; books: PublicBook[] }[] = [
    { key: "bestsellers" as const, title: "Bestsellers", tagline: "What readers are buying most this season", href: "/search?sort=popular",
      books: bestsellers.flatMap((slug) => bySlug.get(slug) ?? []).slice(0, 12) },
    { key: "new" as const, title: "New arrivals", tagline: "Fresh on the shelf this month", href: "/search?sort=new",
      books: [...released].sort((a, b) => String(b.release_date ?? "").localeCompare(String(a.release_date ?? "")) || (b.year ?? 0) - (a.year ?? 0)).slice(0, 12) },
    { key: "offers" as const, title: "On offer", tagline: "Great reads at a lower price, for a limited time", href: "/search?offer=1",
      books: books.filter((b) => b.onSale && b.saleable).sort((a, b) => b.saving - a.saving).slice(0, 12) },
    { key: "soon" as const, title: "Coming soon", tagline: "Add to your wishlist and be first to read", href: "/search?sort=soon",
      books: books.filter((b) => b.comingSoon).sort((a, b) => String(a.release_date).localeCompare(String(b.release_date))).slice(0, 12) },
  ].filter((rail) => rail.books.length > 0);
  const inCategory = (slug: string) => books.filter((b) => b.category_slug === slug);
  const genreModule = live.find((m) => m.type === "genre-switcher");
  const genreSlugs = Array.isArray(genreModule?.payload.category_slugs) ? (genreModule.payload.category_slugs as string[])
    : categories.filter((c) => inCategory(c.slug).length >= 2).slice(0, 5).map((c) => c.slug);
  const genres = genreSlugs.flatMap((slug) => {
    const category = categories.find((c) => c.slug === slug);
    const items = inCategory(slug).slice(0, 12);
    return category && items.length ? [{ slug, name: category.name, books: items }] : [];
  });
  const counts = new Map<string, number>();
  for (const b of books) if (b.language) counts.set(b.language, (counts.get(b.language) ?? 0) + 1);
  const languages = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count, glyph: LANGUAGE_GLYPHS[name] ?? name.slice(0, 2) }));
  const categoryTiles = categories.filter((c) => inCategory(c.slug).length).slice(0, 8).map((c) => ({ slug: c.slug, name: c.name, colour: c.colour,
    image: contentUrl(c.image_url), covers: inCategory(c.slug).flatMap((b) => b.cover ? [b.cover] : []).slice(0, 3) }));
  const withBooks = new Set(books.map((b) => b.author_slug).filter(Boolean));
  return { banners, promos, rails, genres, languages, categoryTiles, authors: authors.filter((a) => withBooks.has(a.id)).slice(0, 10) };
}
```

`contentUrl` must accept `data:` covers? No — covers are not passed through `contentUrl`; only module and category images are. Leave `contentUrl` unchanged.

- [ ] **Step 3: Run the unit test**

Run: `node --import tsx scripts/test-home.mjs`
Expected: PASS.

- [ ] **Step 4: Build the home components**

Create `src/components/home/BannerCarousel.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Banner } from "@/lib/home";

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const many = banners.length > 1;
  useEffect(() => {
    if (!many || paused || hover || reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [many, paused, hover, reduced, banners.length]);
  if (!banners.length) return null;
  const go = (step: number) => setIndex((i) => (i + step + banners.length) % banners.length);
  return <section className="banner-carousel wrap" aria-roledescription="carousel" aria-label="Featured offers"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
    <div className="banner-viewport">{banners.map((b, i) => <div key={b.id} className={`banner-slide theme-${b.theme}`} hidden={i !== index}
      role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${banners.length}`}>
      {b.image && <picture className="banner-art">{b.mobileImage && <source media="(max-width: 640px)" srcSet={b.mobileImage} />}<img src={b.image} alt="" /></picture>}
      <div className="banner-copy">{b.subtitle && <p className="banner-kicker">{b.subtitle}</p>}<h2>{b.title}</h2>{b.body && <p>{b.body}</p>}
        {b.href && <Link className="btn btn-dark" href={b.href}>{b.label || "Shop now"}</Link>}</div>
    </div>)}</div>
    {many && <div className="banner-controls">
      <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Previous offer"><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className="banner-dots">{banners.map((b, i) => <button key={b.id} type="button" aria-label={`Show offer ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)} />)}</div>
      <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Next offer"><ChevronRight size={18} aria-hidden="true" /></button>
      {!reduced && <button type="button" className="round-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play offers" : "Pause offers"}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>}
    </div>}
  </section>;
}
```

Create `src/components/home/PromoGrid.tsx`:

```tsx
import Link from "next/link";
import BookCard from "../BookCard";
import type { Promo } from "@/lib/home";

export default function PromoGrid({ promos, enabled }: { promos: Promo[]; enabled: boolean }) {
  if (!promos.length) return null;
  const large = promos.find((p) => p.size === "large");
  const small = promos.filter((p) => p !== large).slice(0, 4);
  const tile = (p: Promo) => <Link key={p.id} href={p.href ?? "/search"} className={`promo-tile theme-${p.theme}`}>
    {p.image && <img src={p.image} alt="" loading="lazy" />}<span className="promo-title">{p.title}</span><span className="promo-cta">Shop now</span></Link>;
  return <section className="wrap section promo-grid" aria-label="Featured collections">
    {large && <div className={`promo-large theme-${large.theme}`}><h2><Link href={large.href ?? "/search"}>{large.title}</Link></h2>
      <div className="promo-books">{large.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</div></div>}
    <div className="promo-small">{small.map(tile)}</div>
  </section>;
}
```

Create `src/components/home/GenreSwitcher.tsx`:

```tsx
"use client";

import { useState } from "react";
import BookCard from "../BookCard";
import Carousel from "../Carousel";
import type { PublicBook } from "../book-data";

export default function GenreSwitcher({ genres, enabled }: { genres: { slug: string; name: string; books: PublicBook[] }[]; enabled: boolean }) {
  const [active, setActive] = useState(0);
  if (!genres.length) return null;
  const current = genres[Math.min(active, genres.length - 1)];
  return <section className="wrap section"><div className="genre-panel">
    <div className="genre-list" role="tablist" aria-label="Genres">{genres.map((g, i) => <button key={g.slug} type="button" role="tab" id={`genre-${g.slug}`}
      aria-selected={i === active} aria-controls="genre-books" onClick={() => setActive(i)}>{g.name}</button>)}</div>
    <div id="genre-books" role="tabpanel" aria-labelledby={`genre-${current.slug}`} className="genre-books">
      <Carousel title={current.name} href={`/category/${current.slug}`}>{current.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel>
    </div></div></section>;
}
```

Create `src/components/home/LanguageShelf.tsx`, `CategoryTiles.tsx`, `AuthorStrip.tsx`, `PublishBanner.tsx`:

```tsx
// LanguageShelf.tsx
import Link from "next/link";
export default function LanguageShelf({ languages }: { languages: { name: string; glyph: string; count: number }[] }) {
  if (languages.length < 2) return null;
  return <section className="wrap section center-section"><div className="section-head center"><div><h2>Read in your language</h2><p>Books across India's languages</p></div></div>
    <ul className="circle-row">{languages.map((l) => <li key={l.name}><Link href={`/search?language=${encodeURIComponent(l.name)}`}>
      <span className="circle glyph" lang={l.name === "English" ? "en" : undefined} aria-hidden="true">{l.glyph}</span><span>{l.name}</span></Link></li>)}</ul></section>;
}
```

```tsx
// CategoryTiles.tsx
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Cover from "../Cover";
export default function CategoryTiles({ tiles }: { tiles: { slug: string; name: string; colour: string | null; image: string | null; covers: string[] }[] }) {
  if (!tiles.length) return null;
  return <section className="wrap section"><div className="section-head"><div><h2>Shop by category</h2><p>Find your next read, your way</p></div></div>
    <ul className="category-tiles">{tiles.map((t) => <li key={t.slug}><Link href={`/category/${t.slug}`} className="category-tile" style={{ ["--tile" as string]: t.colour ?? "#FFD93D" }}>
      <span className="tile-art">{t.image ? <img src={t.image} alt="" loading="lazy" /> : t.covers.map((c, i) => <span key={i} className="tile-cover"><Cover src={c} title={t.name} sizes="90px" /></span>)}</span>
      <span className="tile-foot"><span>{t.name}</span><span className="chip-yellow">Shop now <ArrowUpRight size={14} aria-hidden="true" /></span></span></Link></li>)}</ul></section>;
}
```

```tsx
// AuthorStrip.tsx
import Link from "next/link";
export default function AuthorStrip({ authors }: { authors: { id: string; name: string; photo_url: string | null }[] }) {
  if (!authors.length) return null;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <section className="wrap section center-section"><div className="section-head center"><div><h2>Discover authors</h2><p>The people behind the pages</p></div></div>
    <ul className="circle-row">{authors.map((a) => <li key={a.id}><Link href={`/authors/${encodeURIComponent(a.id)}`}>
      <span className="circle photo">{a.photo_url ? <img src={a.photo_url} alt="" loading="lazy" /> : <span aria-hidden="true">{initials(a.name)}</span>}</span><span>{a.name}</span></Link></li>)}</ul></section>;
}
```

```tsx
// PublishBanner.tsx
import Link from "next/link";
export default function PublishBanner() {
  return <section className="wrap section"><div className="publish-banner">
    <div><h2>Your book deserves readers</h2><p>Publish your digital edition with us. Editorial review, fair terms, and readers across India.</p>
      <Link className="btn btn-yellow" href="/publish">Start publishing</Link></div>
    <div className="publish-art" aria-hidden="true"><span /><span /><span /></div></div></section>;
}
```

Rewrite `src/app/page.tsx`:

```tsx
import { getPublicContent } from "@/lib/content";
import { bestsellerSlugs, getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { buildHome } from "@/lib/home";
import { siteUrl } from "@/lib/store";
import BookCard from "@/components/BookCard";
import Carousel from "@/components/Carousel";
import BannerCarousel from "@/components/home/BannerCarousel";
import PromoGrid from "@/components/home/PromoGrid";
import GenreSwitcher from "@/components/home/GenreSwitcher";
import LanguageShelf from "@/components/home/LanguageShelf";
import CategoryTiles from "@/components/home/CategoryTiles";
import AuthorStrip from "@/components/home/AuthorStrip";
import PublishBanner from "@/components/home/PublishBanner";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const now = new Date();
  const [books, categories, content, bestsellers, authors] = await Promise.all([getStoreBooks(now), getCategories(), getPublicContent(), bestsellerSlugs(), getPublishedAuthors()]);
  const home = buildHome({ books, categories, modules: content.modules, bestsellers, authors, now });
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const rail = (key: string) => home.rails.find((r) => r.key === key);
  const railView = (key: string) => {
    const r = rail(key);
    return r && <div className="wrap section" key={key}><Carousel title={r.title} tagline={r.tagline} href={r.href}>{r.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>;
  };
  return <>
    <h1 className="sr-only">Digital books across every category</h1>
    <BannerCarousel banners={home.banners} />
    {railView("bestsellers")}
    <PromoGrid promos={home.promos} enabled={enabled} />
    {railView("new")}
    {railView("offers")}
    <GenreSwitcher genres={home.genres} enabled={enabled} />
    {railView("soon")}
    <CategoryTiles tiles={home.categoryTiles} />
    <LanguageShelf languages={home.languages} />
    <AuthorStrip authors={home.authors} />
    <PublishBanner />
    {!books.length && <p className="wrap section">New titles are on their way. Check back soon.</p>}
  </>;
}
```

Create `src/styles/home.css` (import in `globals.css`):

```css
@layer components {
  .theme-yellow { --panel: #FFD93D; --panel-ink: #111; } .theme-coral { --panel: #F04E37; --panel-ink: #fff; }
  .theme-sky { --panel: #BAE6FD; --panel-ink: #0C4A6E; } .theme-green { --panel: #166534; --panel-ink: #fff; }
  .theme-ink { --panel: #111111; --panel-ink: #fff; } .theme-lilac { --panel: #DDD6FE; --panel-ink: #3B0764; }
  .banner-carousel { position: relative; padding-top: 20px; }
  .banner-slide { position: relative; display: grid; align-items: center; min-height: clamp(220px, 28vw, 380px); border-radius: 20px; overflow: hidden; background: var(--panel); color: var(--panel-ink); }
  .banner-slide[hidden] { display: none; }
  .banner-art { position: absolute; inset: 0; } .banner-art img { width: 100%; height: 100%; object-fit: cover; }
  .banner-copy { position: relative; max-width: 620px; padding: clamp(24px, 4vw, 56px); display: grid; gap: 12px; justify-items: start; }
  .banner-copy h2 { font-size: clamp(30px, 5vw, 64px); font-weight: 800; line-height: 1.02; }
  .banner-copy p { font-size: clamp(15px, 1.4vw, 19px); font-weight: 500; }
  .banner-kicker { font: 800 13px/1 var(--font-body) !important; text-transform: uppercase; letter-spacing: .08em; }
  .theme-coral .btn-dark, .theme-green .btn-dark, .theme-ink .btn-dark { background: #fff; color: #111; }
  .banner-controls { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 12px; }
  .banner-dots { display: flex; gap: 6px; } .banner-dots button { width: 10px; height: 10px; padding: 0; border-radius: 999px; border: 0; background: #D4D4D8; }
  .banner-dots button[aria-current] { width: 26px; background: var(--ink); }
  .promo-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
  .promo-large { border-radius: 20px; padding: 24px; background: var(--panel); color: var(--panel-ink); }
  .promo-large h2 { font-size: clamp(24px, 3vw, 36px); margin-bottom: 16px; text-align: center; }
  .promo-books { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; color: var(--ink); }
  .promo-small { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .promo-tile { position: relative; display: flex; flex-direction: column; justify-content: space-between; min-height: 180px; padding: 20px; border-radius: 16px; background: var(--panel); color: var(--panel-ink); overflow: hidden; transition: transform .2s; }
  .promo-tile:hover { transform: translateY(-3px); }
  .promo-tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .9; }
  .promo-title { position: relative; font: 800 clamp(20px, 2vw, 28px)/1.1 var(--font-head); max-width: 12ch; }
  .promo-cta { position: relative; align-self: start; padding: 6px 12px; border-radius: 8px; background: #fff; color: #111; font: 700 13px/1 var(--font-body); }
  .genre-panel { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 24px; align-items: center; padding: 28px; border-radius: 20px; background: var(--sky); }
  .genre-list { display: grid; gap: 4px; }
  .genre-list button { padding: 4px 0; border: 0; background: none; text-align: left; font: 800 clamp(30px, 3.4vw, 48px)/1.1 var(--font-head); color: rgb(12 74 110 / 35%); transition: color .2s; }
  .genre-list button[aria-selected="true"], .genre-list button:hover { color: var(--ink); }
  .genre-books .section-head h2 { font-size: 20px; }
  .center-section .section-head.center { justify-content: center; text-align: center; }
  .circle-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px 28px; }
  .circle-row a { display: grid; justify-items: center; gap: 10px; font-weight: 600; font-size: 14px; }
  .circle { display: grid; place-items: center; width: 96px; height: 96px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); overflow: hidden; transition: transform .2s, box-shadow .2s; }
  .circle-row a:hover .circle { transform: translateY(-3px); box-shadow: var(--shadow-lift); }
  .circle.glyph { font: 800 36px/1 var(--font-head); }
  .circle.photo img { width: 100%; height: 100%; object-fit: cover; } .circle.photo span { font: 800 28px/1 var(--font-head); }
  .category-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .category-tile { display: flex; flex-direction: column; height: 100%; border-radius: 16px; background: var(--card); overflow: hidden; transition: transform .2s, box-shadow .2s; }
  .category-tile:hover { transform: translateY(-3px); box-shadow: var(--shadow-lift); }
  .tile-art { display: flex; justify-content: center; align-items: end; gap: 6px; height: 150px; padding: 18px 12px 0; background: var(--tile); }
  .tile-art > img { width: 100%; height: 100%; object-fit: cover; }
  .tile-cover { width: 70px; transform-origin: bottom; } .tile-cover:nth-child(2) { width: 82px; } .tile-cover img { width: 100%; height: auto; box-shadow: 0 6px 14px rgb(0 0 0 / 25%); }
  .tile-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px; font: 750 15px/1.2 var(--font-head); }
  .chip-yellow { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; background: var(--yellow); font: 700 12px/1 var(--font-body); white-space: nowrap; }
  .publish-banner { display: grid; grid-template-columns: 1.2fr 1fr; align-items: center; gap: 24px; min-height: 260px; padding: clamp(24px, 4vw, 48px); border-radius: 20px; background: #C4B5FD; }
  .publish-banner h2 { font-size: clamp(28px, 3.6vw, 44px); font-weight: 800; }
  .publish-banner p { margin-block: 12px 20px; max-width: 46ch; font-size: 16px; }
  .publish-art { position: relative; height: 200px; }
  .publish-art span { position: absolute; bottom: 0; width: 110px; height: 160px; border-radius: 6px; background: var(--yellow); box-shadow: 0 10px 24px rgb(0 0 0 / 18%); }
  .publish-art span:nth-child(1) { left: 20%; transform: rotate(-8deg); background: #F04E37; }
  .publish-art span:nth-child(2) { left: 38%; height: 190px; background: #111; }
  .publish-art span:nth-child(3) { left: 56%; transform: rotate(7deg); }
  @media (max-width: 900px) {
    .promo-grid, .genre-panel, .publish-banner { grid-template-columns: 1fr; }
    .genre-list { display: flex; gap: 16px; overflow-x: auto; } .genre-list button { font-size: 26px; white-space: nowrap; }
    .category-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .publish-art { display: none; }
  }
  @media (max-width: 480px) { .promo-small { grid-template-columns: 1fr 1fr; } .promo-tile { min-height: 130px; } .circle { width: 76px; height: 76px; } }
}
```

Delete `src/components/Hero.tsx`, `src/components/DiscoveryFeatures.tsx`, `src/components/ContentSections.tsx`. In `src/components/reading-room.test.cjs`, delete the blocks that load or assert on `Hero`, `DiscoveryFeatures`, `SubjectNavigation`, `ContentSections` (`Sections`, `renderSections`, `hero`, `externalCover`, `draft`, `features`, `interests`, `unmatched`, `ordered`, `video`, `payloadVideo`) and the `Home` render with its `#publish`/FAQ assertions. Keep the `helpers.contentUrl`/`helpers.videoUrl` assertions and the `sitemap` assertions. Add a render check that the homepage renders with banners from the demo-shaped data:

```js
  const BannerView = load("components/home/BannerCarousel.tsx", { "motion/react": { useReducedMotion: () => true } }).default;
  assert.equal(renderToStaticMarkup(React.createElement(BannerView, { banners: [] })), "");
  const one = renderToStaticMarkup(React.createElement(BannerView, { banners: [{ id: "b", title: "Only offer", body: null, subtitle: null, image: null, mobileImage: null, href: "/search", label: null, theme: "coral" }] }));
  assert.match(one, /Only offer/);
  assert.doesNotMatch(one, /Pause offers|Next offer/, "a single banner has no controls");
  const two = renderToStaticMarkup(React.createElement(BannerView, { banners: ["a", "b"].map(id => ({ id, title: id, body: null, subtitle: null, image: null, mobileImage: null, href: null, label: null, theme: "sky" })) }));
  assert.match(two, /Next offer/);
  assert.doesNotMatch(two, /Pause offers/, "reduced motion never autoplays, so no pause control");
```

(This pins Review Focus line 5.)

- [ ] **Step 5: Run tests and look**

Run: `node --import tsx scripts/test-home.mjs && node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Screenshot `/` at 1440 and 390. Required visible order: coral banner with big type and controls; Bestsellers carousel; bento grid (large green tile with 2 live cards + 3 small tiles); New arrivals; On offer (green pills); sky genre panel with big stacked genre words; Coming soon; category tiles with cover collages and yellow "Shop now"; language circles with script glyphs; author circles; lilac publish banner; yellow footer. Compare with `scratch/ref-cw-0.jpg`, `ref-cw-1.jpg`, `ref-cw-2.jpg`.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/page.tsx src/lib/home.ts src/components/home src/styles/home.css src/app/globals.css src/components scripts/test-home.mjs scripts/test-all.mjs
git commit -m "Retail homepage: banner carousel, bento promos, carousels, genre switcher, language shelf, category tiles, authors"
```

---

### Task B5: Search and category listing pages

**Files:**
- Create: `src/lib/listing.ts`
- Create: `scripts/test-listing.mjs`
- Create: `src/components/Listing.tsx`
- Create: `src/app/search/page.tsx`
- Create: `src/app/category/[slug]/page.tsx`
- Rewrite: `src/app/catalogue/page.tsx` (redirect)
- Modify: `src/app/sitemap.ts`
- Create: `src/styles/listing.css`
- Modify: `src/components/reading-room.test.cjs` (`checkCatalogue` now tests `listing.ts` through the search page)
- Modify: `scripts/test-all.mjs`

**Interfaces:**
- Produces in `src/lib/listing.ts` (pure):

```ts
export type ListingParams = { q: string; category: string; author: string; language: string; format: string; price: "" | "0-199" | "200-499" | "500-999" | "1000+"; offer: boolean; sort: "" | "new" | "popular" | "soon" | "price-asc" | "price-desc" | "title"; page: number };
export function parseListing(query: Record<string, string | string[] | undefined>): ListingParams;
export function filterBooks(books: PublicBook[], p: ListingParams, opts?: { categoryFamily?: string[]; popularity?: string[] }): PublicBook[]; // filtered and sorted
export function facets(books: PublicBook[], p: ListingParams, categories: { slug: string; name: string }[], opts?: { categoryFamily?: string[] }): Facet[];
export type Facet = { key: "category" | "author" | "language" | "format" | "price" | "offer"; title: string; options: { value: string; label: string; count: number; active: boolean }[] };
export function paginate<T>(items: T[], page: number, size?: number): { items: T[]; page: number; pages: number; total: number }; // size default 24, page clamped
export function listingHref(base: string, p: ListingParams, change: Partial<ListingParams>): string; // resets page to 1 unless page is in change
```

  Price bands use the current price in rupees: `0-199` = price < 20000 paise, `200-499` = 20000–49999, `500-999` = 50000–99999, `1000+` ≥ 100000. `categoryFamily` = the category slug plus its child slugs (category page includes sub-categories). Search matches title, subtitle, authorship, description, isbn, case-insensitively, as a literal substring. `q` is trimmed and capped at 120 characters.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-listing.mjs`:

```js
import assert from 'node:assert/strict';
import { load } from './test-commerce.mjs';

const L = load('src/lib/listing.ts');
const b = (slug, extra = {}) => ({ slug, title: slug, subtitle: null, authorship: 'Ana', author_slug: 'ana', description: null, isbn: null, category_slug: 'fiction', language: 'English',
  file_format: 'PDF', price: 29900, regular: 29900, onSale: false, saving: 0, saleable: true, comingSoon: false, release_date: '2026-01-01', ...extra });
const books = [b('alpha', { price: 15000 }), b('beta', { category_slug: 'crime', onSale: true, saving: 5000, price: 24900 }), b('gamma', { language: 'Hindi', file_format: 'EPUB', price: 120000, release_date: '2026-09-01' }),
  b('delta', { authorship: 'Ravi', author_slug: 'ravi', category_slug: 'science', isbn: '9781234567897' })];

const p = L.parseListing({ q: '  ALPHA ', offer: '1', price: '200-499', sort: 'price-asc', page: '3', category: 'x y' });
assert.deepEqual(p, { q: 'alpha', category: '', author: '', language: '', format: '', price: '200-499', offer: true, sort: 'price-asc', page: 3 });
assert.equal(L.parseListing({ q: 'x'.repeat(500) }).q.length, 120);
assert.equal(L.parseListing({ sort: 'drop', price: '5-6', page: '-1' }).sort, '');

const all = L.parseListing({});
assert.deepEqual(L.filterBooks(books, { ...all, q: '9781234567897' }).map(x => x.slug), ['delta']);
assert.deepEqual(L.filterBooks(books, { ...all, q: '%' }).map(x => x.slug), [], 'percent is a literal');
assert.deepEqual(L.filterBooks(books, { ...all, offer: true }).map(x => x.slug), ['beta']);
assert.deepEqual(L.filterBooks(books, { ...all, price: '0-199' }).map(x => x.slug), ['alpha']);
assert.deepEqual(L.filterBooks(books, { ...all, price: '1000+' }).map(x => x.slug), ['gamma']);
assert.deepEqual(L.filterBooks(books, { ...all, sort: 'price-desc' }).map(x => x.slug), ['gamma', 'delta', 'beta', 'alpha']);
assert.deepEqual(L.filterBooks(books, { ...all, sort: 'new' })[0].slug, 'gamma');
assert.deepEqual(L.filterBooks(books, all, { categoryFamily: ['fiction', 'crime'] }).map(x => x.slug), ['alpha', 'beta', 'gamma']);
assert.deepEqual(L.filterBooks(books, { ...all, sort: 'popular' }, { popularity: ['delta', 'beta'] }).map(x => x.slug).slice(0, 2), ['delta', 'beta']);

const f = L.facets(books, { ...all, language: 'Hindi' }, [{ slug: 'fiction', name: 'Fiction' }, { slug: 'crime', name: 'Crime' }, { slug: 'science', name: 'Science' }]);
const lang = f.find(x => x.key === 'language');
assert.deepEqual(lang.options.map(o => [o.value, o.count, o.active]), [['English', 3, false], ['Hindi', 1, true]], 'own facet ignores its own filter');
assert.deepEqual(f.find(x => x.key === 'category').options.map(o => [o.value, o.count]), [['fiction', 1]], 'other facets respect active language');

const pages = L.paginate(Array.from({ length: 50 }, (_, i) => i), 9, 24);
assert.deepEqual([pages.page, pages.pages, pages.total, pages.items.length], [3, 3, 50, 2], 'page clamps to the last page');
assert.equal(L.listingHref('/search', { ...all, q: 'a b', page: 4 }, { language: 'Hindi' }), '/search?q=a+b&language=Hindi');
assert.equal(L.listingHref('/search', { ...all, page: 1 }, { page: 2 }), '/search?page=2');
console.log('Listing checks passed: parsing caps, literal search, price bands, offers, sorts, family, facets, pagination, hrefs.');
```

Register in `scripts/test-all.mjs` after `'scripts/test-home.mjs'`.

Run: `node --import tsx scripts/test-listing.mjs`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/listing.ts`**

```ts
import type { PublicBook } from "@/components/book-data";

export type ListingParams = { q: string; category: string; author: string; language: string; format: string;
  price: "" | "0-199" | "200-499" | "500-999" | "1000+"; offer: boolean; sort: "" | "new" | "popular" | "soon" | "price-asc" | "price-desc" | "title"; page: number };
export type Facet = { key: "category" | "author" | "language" | "format" | "price" | "offer"; title: string; options: { value: string; label: string; count: number; active: boolean }[] };
type Query = Record<string, string | string[] | undefined>;
const one = (v: Query[string]) => (Array.isArray(v) ? v[0] : v) ?? "";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BANDS = { "0-199": [0, 20000], "200-499": [20000, 50000], "500-999": [50000, 100000], "1000+": [100000, Infinity] } as const;
const SORTS = ["", "new", "popular", "soon", "price-asc", "price-desc", "title"] as const;
const KEYS = ["q", "category", "author", "language", "format", "price", "offer", "sort", "page"] as const;

export function parseListing(query: Query): ListingParams {
  const text = (v: string, max = 80) => v.trim().slice(0, max);
  const page = Number(one(query.page));
  return { q: text(one(query.q), 120).toLowerCase(), category: SLUG.test(one(query.category)) ? one(query.category) : "",
    author: text(one(query.author), 120), language: text(one(query.language), 60), format: ["PDF", "EPUB"].includes(one(query.format)) ? one(query.format) : "",
    price: one(query.price) in BANDS ? one(query.price) as ListingParams["price"] : "", offer: one(query.offer) === "1",
    sort: (SORTS as readonly string[]).includes(one(query.sort)) ? one(query.sort) as ListingParams["sort"] : "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
}

type Opts = { categoryFamily?: string[]; popularity?: string[] };
const tests = (p: ListingParams, o: Opts) => ({
  q: (b: PublicBook) => !p.q || [b.title, b.subtitle, b.authorship, b.description, b.isbn].some((v) => v?.toLowerCase().includes(p.q)),
  category: (b: PublicBook) => (!o.categoryFamily || o.categoryFamily.includes(b.category_slug ?? "")) && (!p.category || b.category_slug === p.category),
  author: (b: PublicBook) => !p.author || b.author_slug === p.author,
  language: (b: PublicBook) => !p.language || b.language === p.language,
  format: (b: PublicBook) => !p.format || b.file_format === p.format,
  price: (b: PublicBook) => !p.price || (b.price >= BANDS[p.price][0] && b.price < BANDS[p.price][1]),
  offer: (b: PublicBook) => !p.offer || b.onSale,
});
const matching = (books: PublicBook[], p: ListingParams, o: Opts, except?: keyof ReturnType<typeof tests>) =>
  books.filter((b) => Object.entries(tests(p, o)).every(([k, t]) => k === except || t(b)));

export function filterBooks(books: PublicBook[], p: ListingParams, o: Opts = {}) {
  const out = matching(books, p, o);
  const rank = new Map((o.popularity ?? []).map((s, i) => [s, i]));
  const sorters: Record<string, (a: PublicBook, b: PublicBook) => number> = {
    "price-asc": (a, b) => a.price - b.price, "price-desc": (a, b) => b.price - a.price, title: (a, b) => a.title.localeCompare(b.title),
    new: (a, b) => String(b.release_date ?? "").localeCompare(String(a.release_date ?? "")),
    soon: (a, b) => Number(b.comingSoon) - Number(a.comingSoon) || String(a.release_date ?? "").localeCompare(String(b.release_date ?? "")),
    popular: (a, b) => (rank.get(a.slug) ?? 1e9) - (rank.get(b.slug) ?? 1e9),
  };
  return p.sort ? [...out].sort(sorters[p.sort]) : out;
}

export function facets(books: PublicBook[], p: ListingParams, categories: { slug: string; name: string }[], o: Opts = {}): Facet[] {
  const count = (key: Facet["key"], value: (b: PublicBook) => string | null | undefined, label: (v: string, b: PublicBook) => string, active: string) => {
    const map = new Map<string, { label: string; count: number }>();
    for (const b of matching(books, p, o, key as keyof ReturnType<typeof tests>)) {
      const v = value(b);
      if (v) map.set(v, { label: label(v, b), count: (map.get(v)?.count ?? 0) + 1 });
    }
    return [...map].sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([v, x]) => ({ value: v, label: x.label, count: x.count, active: v === active }));
  };
  const name = new Map(categories.map((c) => [c.slug, c.name]));
  const priceOptions = (Object.keys(BANDS) as (keyof typeof BANDS)[]).map((band) => ({ value: band,
    label: band === "1000+" ? "₹1,000 and above" : `₹${band.replace("-", " to ₹")}`,
    count: matching(books, p, o, "price").filter((b) => b.price >= BANDS[band][0] && b.price < BANDS[band][1]).length, active: p.price === band })).filter((x) => x.count);
  const offers = matching(books, p, o, "offer").filter((b) => b.onSale).length;
  return ([
    { key: "category", title: "Category", options: count("category", (b) => b.category_slug, (v) => name.get(v) ?? v, p.category) },
    { key: "author", title: "Author", options: count("author", (b) => b.author_slug, (_v, b) => b.authorship ?? "Unknown", p.author) },
    { key: "language", title: "Language", options: count("language", (b) => b.language, (v) => v, p.language) },
    { key: "format", title: "Format", options: count("format", (b) => b.file_format, (v) => v, p.format) },
    { key: "price", title: "Price", options: priceOptions },
    { key: "offer", title: "Offers", options: offers ? [{ value: "1", label: "On offer", count: offers, active: p.offer }] : [] },
  ] as Facet[]).filter((f) => f.options.length > 0);
}

export function paginate<T>(items: T[], page: number, size = 24) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}

export function listingHref(base: string, p: ListingParams, change: Partial<ListingParams>) {
  const next = { ...p, ...("page" in change ? {} : { page: 1 }), ...change };
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const v = next[key];
    if (key === "offer") { if (v) params.set("offer", "1"); }
    else if (key === "page") { if (Number(v) > 1) params.set("page", String(v)); }
    else if (v) params.set(key, String(v));
  }
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
```

Run: `node --import tsx scripts/test-listing.mjs` → PASS.

- [ ] **Step 3: Build the pages**

Create `src/components/Listing.tsx` (server component; filters are plain links so the page works without JavaScript):

```tsx
import Link from "next/link";
import { X } from "lucide-react";
import BookCard from "./BookCard";
import type { PublicBook } from "./book-data";
import { facets, filterBooks, listingHref, paginate, type ListingParams } from "@/lib/listing";

const SORT_LABELS: [ListingParams["sort"], string][] = [["", "Relevance"], ["popular", "Popularity"], ["new", "Newest"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["title", "Title"]];

export default function Listing({ base, title, intro, banner, books, params, categories, children, family, popularity, enabled }: {
  base: string; title: string; intro?: string | null; banner?: { colour: string | null; image: string | null } | null; books: PublicBook[]; params: ListingParams;
  categories: { slug: string; name: string }[]; children?: React.ReactNode; family?: string[]; popularity?: string[]; enabled: boolean;
}) {
  const results = filterBooks(books, params, { categoryFamily: family, popularity });
  const page = paginate(results, params.page);
  const groups = facets(books, params, categories, { categoryFamily: family });
  const chips = groups.flatMap((g) => g.options.filter((o) => o.active).map((o) => ({ key: g.key, label: o.label })));
  if (params.q) chips.unshift({ key: "q" as never, label: `"${params.q}"` });
  return <div className="listing">
    <div className="listing-banner" style={{ ["--tile" as string]: banner?.colour ?? "#FFD93D" }}>
      <div className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span aria-current="page">{title}</span></nav>
        <h1>{title}</h1>{intro && <p>{intro}</p>}{children}</div>
      {banner?.image && <img src={banner.image} alt="" className="listing-art" />}
    </div>
    <div className="wrap listing-layout">
      <aside className="filters" aria-label="Filters">
        <form action={base} className="filter-search" role="search">
          {(["category", "author", "language", "format", "price", "sort"] as const).filter((k) => params[k]).map((k) => <input key={k} type="hidden" name={k} value={params[k]} />)}
          {params.offer && <input type="hidden" name="offer" value="1" />}
          <label className="field-label" htmlFor="listing-q">Search within results</label>
          <input id="listing-q" className="field-input" type="search" name="q" defaultValue={params.q} placeholder="Title, author or ISBN" />
        </form>
        {groups.map((g) => <details key={g.key} open className="filter-group"><summary>{g.title}</summary><ul>{g.options.map((o) =>
          <li key={o.value}><Link href={listingHref(base, params, { [g.key]: o.active ? (g.key === "offer" ? false : "") : (g.key === "offer" ? true : o.value) } as Partial<ListingParams>)}
            aria-current={o.active ? "true" : undefined} className="filter-option"><span className="check" aria-hidden="true" />{o.label}<span className="count">{o.count}</span></Link></li>)}</ul></details>)}
      </aside>
      <section className="results" aria-label="Results">
        <div className="results-bar"><p role="status">{page.total} {page.total === 1 ? "book" : "books"}</p>
          <nav aria-label="Sort" className="sort-row"><span>Sort by</span>{SORT_LABELS.map(([value, label]) =>
            <Link key={value || "relevance"} className="chip" aria-current={params.sort === value ? "true" : undefined} href={listingHref(base, params, { sort: value })}>{label}</Link>)}</nav></div>
        {chips.length > 0 && <ul className="active-chips" aria-label="Active filters">{chips.map((c) =>
          <li key={c.key}><Link className="chip" href={listingHref(base, params, { [c.key]: c.key === "offer" ? false : "" } as Partial<ListingParams>)} aria-label={`Remove filter ${c.label}`}>{c.label}<X size={14} aria-hidden="true" /></Link></li>)}
          <li><Link className="clear-link" href={base}>Clear all</Link></li></ul>}
        {page.items.length ? <div className="grid-books">{page.items.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</div>
          : <div className="empty-results"><h2>No books match these filters</h2><p>Try fewer filters or a different search.</p><Link className="btn btn-dark" href={base}>Clear filters</Link></div>}
        {page.pages > 1 && <nav className="pager" aria-label="Pages">
          {page.page > 1 && <Link className="btn btn-outline" href={listingHref(base, params, { page: page.page - 1 })}>Previous</Link>}
          <span>Page {page.page} of {page.pages}</span>
          {page.page < page.pages && <Link className="btn btn-outline" href={listingHref(base, params, { page: page.page + 1 })}>Next</Link>}</nav>}
      </section>
    </div>
  </div>;
}
```

Create `src/app/search/page.tsx`:

```tsx
import { getCategories, getStoreBooks, bestsellerSlugs } from "@/lib/store-data";
import { parseListing } from "@/lib/listing";
import Listing from "@/components/Listing";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }) {
  const p = parseListing(await searchParams);
  return { title: p.q ? `Search: ${p.q}` : "All books", robots: p.q ? { index: false } : undefined };
}

export default async function Search({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, books, categories, popularity] = await Promise.all([searchParams, getStoreBooks(), getCategories(), bestsellerSlugs(90, 200)]);
  const params = parseListing(query);
  return <Listing base="/search" title={params.q ? `Results for "${params.q}"` : params.offer ? "Offers" : "All books"} books={books} params={params}
    categories={categories} popularity={popularity} enabled={process.env.COMMERCE_ENABLED === "true"} />;
}
```

Create `src/app/category/[slug]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getStoreBooks, bestsellerSlugs } from "@/lib/store-data";
import { parseListing } from "@/lib/listing";
import { contentUrl } from "@/components/content-data";
import { siteUrl } from "@/lib/store";
import Listing from "@/components/Listing";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  return category ? { title: `${category.name} books`, alternates: { canonical: `${siteUrl()}/category/${slug}` } } : { title: "Category not found", robots: { index: false } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, query, categories, books, popularity] = await Promise.all([params, searchParams, getCategories(), getStoreBooks(), bestsellerSlugs(90, 200)]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const children = categories.filter((c) => c.parent_slug === slug);
  const listing = { ...parseListing(query), category: "" };
  return <Listing base={`/category/${slug}`} title={category.name} intro={`Digital editions in ${category.name.toLowerCase()}.`} books={books} params={listing}
    banner={{ colour: category.colour, image: contentUrl(category.image_url) }} categories={categories} family={[slug, ...children.map((c) => c.slug)]}
    popularity={popularity} enabled={process.env.COMMERCE_ENABLED === "true"}>
    {children.length > 0 && <ul className="subcategory-chips">{children.map((c) => <li key={c.slug}><Link className="chip" href={`/category/${c.slug}`}>{c.name}</Link></li>)}</ul>}
  </Listing>;
}
```

Rewrite `src/app/catalogue/page.tsx` to a permanent redirect preserving the old query names:

```tsx
import { permanentRedirect } from "next/navigation";

export default async function Catalogue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["q", "language", "format", "author", "sort"]) { const v = query[key]; if (typeof v === "string" && v) next.set(key, v === "price-asc" || v === "price-desc" || v === "title" || key !== "sort" ? v : ""); }
  permanentRedirect(next.toString() ? `/search?${next}` : "/search");
}
```

In `src/app/sitemap.ts` replace `'/catalogue'` with `'/search'` and append `...(await getCategories()).map(c => \`/category/${encodeURIComponent(c.slug)}\`)` (import `getCategories` from `@/lib/store-data`). Update the sitemap test mock in `reading-room.test.cjs` to provide `"@/lib/store-data": { getCategories: async () => [{ slug: "science" }] }` and assert `/category\/science/`.

In `reading-room.test.cjs`, replace `checkCatalogue` with a render of the search page using mocked data:

```js
async function checkCatalogue() {
  const listing = load("lib/listing.ts");
  const Search = load("app/search/page.tsx", {
    "@/lib/store-data": { getStoreBooks: async () => [publicBook({ ...record, file_format: "PDF", language: "English" }), publicBook({ ...record, slug: "second-book", title: "Second title", isbn: "9781111111111", file_format: "EPUB" })],
      getCategories: async () => [], bestsellerSlugs: async () => [] },
    "@/lib/listing": listing,
    "@/components/Listing": load("components/Listing.tsx", { "./BookCard": { default: ({ book }) => React.createElement("article", { "data-book": book.slug }, book.title) }, "@/lib/listing": listing }),
  }).default;
  const render = async (query) => renderToStaticMarkup(await Search({ searchParams: Promise.resolve(query) }));
  const isbn = await render({ q: record.isbn });
  assert.match(isbn, /data-book="real-book"/);
  assert.doesNotMatch(isbn, /data-book="second-book"/);
  assert.match(await render({ format: "EPUB" }), /Remove filter EPUB/);
  assert.match(await render({ q: record.isbn, format: "EPUB" }), /No books match these filters/);
}
```

Create `src/styles/listing.css` (import in `globals.css`):

```css
@layer components {
  .listing-banner { position: relative; overflow: hidden; background: var(--tile); color: #111; padding-block: 28px 32px; }
  .listing-banner h1 { font-size: clamp(30px, 4vw, 48px); font-weight: 800; margin-top: 8px; }
  .listing-banner p { margin-top: 6px; font-size: 16px; max-width: 60ch; }
  .listing-art { position: absolute; right: 0; top: 0; height: 100%; width: 40%; object-fit: cover; opacity: .9; }
  .crumbs { font-size: 13px; } .crumbs a:hover { text-decoration: underline; }
  .subcategory-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .listing-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 32px; padding-block: 28px; align-items: start; }
  .filters { position: sticky; top: 12px; display: grid; gap: 12px; padding: 16px; background: var(--card); border-radius: var(--radius-card); }
  .filter-group summary { cursor: pointer; padding: 10px 0; font: 750 14px/1.2 var(--font-head); border-top: 1px solid var(--line); list-style: none; }
  .filter-group summary::-webkit-details-marker { display: none; }
  .filter-option { display: flex; align-items: center; gap: 10px; min-height: 36px; font-size: 14px; }
  .filter-option .check { width: 18px; height: 18px; border: 1.5px solid #A1A1AA; border-radius: 4px; flex: none; }
  .filter-option[aria-current] .check { background: var(--ink); border-color: var(--ink); box-shadow: inset 0 0 0 3px #fff; }
  .filter-option .count { margin-left: auto; color: var(--muted); font-size: 12px; }
  .results-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
  .results-bar > p { font-weight: 650; }
  .sort-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; } .sort-row > span { color: var(--muted); margin-right: 4px; }
  .active-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
  .clear-link { text-decoration: underline; font-size: 13px; }
  .empty-results { display: grid; justify-items: start; gap: 10px; padding: 40px; background: var(--card); border-radius: var(--radius-card); }
  .pager { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 28px; }
  @media (max-width: 900px) {
    .listing-layout { grid-template-columns: 1fr; }
    .filters { position: static; }
    .filter-group:not([open]) ul { display: none; }
    .listing-art { display: none; }
  }
}
```

- [ ] **Step 4: Run tests and look**

Run: `node --import tsx scripts/test-listing.mjs && node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Screenshot `/search`, `/search?offer=1`, `/category/science`, `/catalogue?q=monsoon` (redirects to `/search?q=monsoon`). Check: coloured category banner, filter sidebar with checkbox-style options and counts, sort chips, active filter chips, 24-per-page grid with pager.

- [ ] **Step 5: Commit**

```bash
git add src/lib/listing.ts scripts/test-listing.mjs scripts/test-all.mjs src/components/Listing.tsx src/app/search src/app/category src/app/catalogue src/app/sitemap.ts src/styles/listing.css src/app/globals.css src/components/reading-room.test.cjs
git commit -m "Search and category pages with checkbox facets, price bands, offers, sort and pagination"
```

---

### Task B6: Product page

**Files:**
- Rewrite: `src/app/books/[slug]/page.tsx`
- Create: `src/components/product/BookTabs.tsx`
- Create: `src/components/product/ShareButton.tsx`
- Modify: `src/lib/catalogue.ts` (`bookJsonLd` uses the current price)
- Create: `src/styles/product.css`
- Delete: `src/components/BookCopy.tsx`, `src/components/ChapterPreview.tsx`, `src/components/MotionBookLink.tsx` (if no other importer remains: check with `grep -rn "BookCopy\|ChapterPreview\|MotionBookLink" src`)
- Test: `src/components/reading-room.test.cjs`

**Interfaces:**
- `bookJsonLd(book: Book, url: string, saleable: boolean, now?: Date)` — `offers.price` = `currentPrice(book, now).price / 100` with two decimals; adds `priceValidUntil` (`sale_ends_at` date) when on sale with an end.
- `BookTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] })` — client WAI-ARIA tabs (arrow keys move between tabs); empty tabs are filtered by the caller.
- `ShareButton({ title, url })` — uses `navigator.share` when available, otherwise copies the URL and announces "Link copied".
- Later tasks add into this page: wishlist heart (Task C2), Buy now (Task C4), recently viewed (Task C5). This task leaves no placeholders for them; those tasks insert their elements at the anchors named there.

- [ ] **Step 1: Write the failing test**

Add to `reading-room.test.cjs` (top level, after `jsonLdHtml` assertions):

```js
const ld = bookJsonLd({ ...record, cover: "/assets/c.png", price_inr: 29900, sale_price_inr: 25200, sale_ends_at: "2026-10-20T00:00:00+05:30" }, "u", true, new Date("2026-10-15T00:00:00Z"));
assert.equal(ld.offers.price, "252.00");
assert.equal(ld.offers.priceValidUntil, "2026-10-19");
assert.equal(bookJsonLd({ ...record, price_inr: 29900, sale_price_inr: 25200, sale_ends_at: "2026-10-01T00:00:00Z" }, "u", true, new Date("2026-10-15T00:00:00Z")).offers.price, "299.00");
```

(`priceValidUntil` is the last day the sale price applies: one millisecond before the exclusive end, as a UTC date; `2026-10-20T00:00:00+05:30` = `2026-10-19T18:30Z`, so the last valid instant is on 2026-10-19.)

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL (price is `299.00`).

- [ ] **Step 2: Implement**

In `src/lib/catalogue.ts` change `bookJsonLd`:

```ts
import { currentPrice } from "./money";
export function bookJsonLd(book: Book, url: string, saleable: boolean, now: Date = new Date()) {
  const p = currentPrice(book, now);
  const until = p.onSale && book.sale_ends_at ? new Date(Date.parse(String(book.sale_ends_at)) - 1).toISOString().slice(0, 10) : null;
  return {
    // keep every existing field unchanged, and replace the offers entry with:
    ...(saleable && p.price > 0 && { offers: { "@type": "Offer", url, priceCurrency: "INR", price: (p.price / 100).toFixed(2),
      ...(until && { priceValidUntil: until }), availability: "https://schema.org/InStock" } }),
  };
}
```

(Edit the existing function: add the `now` parameter and `p`/`until` lines, and replace only its `offers` spread; leave the other fields as they are.)

Create `src/components/product/BookTabs.tsx`:

```tsx
"use client";

import { useRef, useState, type ReactNode } from "react";

export default function BookTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!tabs.length) return null;
  const move = (to: number) => { const i = (to + tabs.length) % tabs.length; setActive(i); refs.current[i]?.focus(); };
  return <div className="book-tabs">
    <div role="tablist" aria-label="About this book" className="tab-list">{tabs.map((t, i) => <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" type="button"
      id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={i === active} tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}
      onKeyDown={(e) => { if (e.key === "ArrowRight") move(i + 1); if (e.key === "ArrowLeft") move(i - 1); if (e.key === "Home") move(0); if (e.key === "End") move(tabs.length - 1); }}>{t.label}</button>)}</div>
    {tabs.map((t, i) => <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={i !== active} className="tab-panel">{t.content}</div>)}
  </div>;
}
```

Create `src/components/product/ShareButton.tsx`:

```tsx
"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

export default function ShareButton({ title, url }: { title: string; url: string }) {
  const [status, setStatus] = useState("");
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setStatus("Link copied"); }
    } catch { /* The reader cancelled the share sheet. */ }
  }
  return <><button type="button" className="round-btn" onClick={share} aria-label={`Share ${title}`}><Share2 size={18} aria-hidden="true" /></button>
    <span className="sr-only" role="status">{status}</span></>;
}
```

Rewrite `src/app/books/[slug]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, BookOpen, Download, FileText, Globe2, Hash, Infinity as Lifetime, Layers, Lock, Building2 } from "lucide-react";
import { getBook, getBooks } from "@/lib/db";
import { getPublicContent, safeUrl } from "@/lib/content";
import { bookJsonLd, jsonLdHtml } from "@/lib/catalogue";
import { siteUrl } from "@/lib/store";
import { getCategories } from "@/lib/store-data";
import { publicBook, visibleBook } from "@/components/book-data";
import AddToCart from "@/components/AddToCart";
import BookCard from "@/components/BookCard";
import Carousel from "@/components/Carousel";
import Cover from "@/components/Cover";
import Price from "@/components/Price";
import BookTabs from "@/components/product/BookTabs";
import ShareButton from "@/components/product/ShareButton";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const book = await getBook((await params).slug);
  if (!book || !visibleBook(book)) return { title: "Book not found", robots: { index: false } };
  return { title: book.title, description: book.description || undefined,
    alternates: { canonical: `${siteUrl()}/books/${encodeURIComponent(book.slug)}` },
    openGraph: { title: book.title, description: book.description || undefined, images: book.cover && !book.cover.startsWith("data:") ? [book.cover] : [] } };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const now = new Date();
  const [book, records, content, categories] = await Promise.all([getBook((await params).slug), getBooks(), getPublicContent(), getCategories()]);
  if (!book || !visibleBook(book)) notFound();
  const view = publicBook(book, now);
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const url = `${siteUrl()}/books/${encodeURIComponent(book.slug)}`;
  const category = categories.find((c) => c.slug === book.category_slug);
  const author = book.author_slug ? content.authors.find((a) => a.id === book.author_slug) : undefined;
  let sample: string | null = null;
  try { sample = safeUrl(book.sample_url); } catch { /* A malformed sample is not offered. */ }
  const others = records.filter((r) => r.slug !== book.slug && visibleBook(r)).map((r) => publicBook(r, now));
  const byAuthor = book.author_slug ? others.filter((o) => o.author_slug === book.author_slug).slice(0, 12) : [];
  const similar = others.filter((o) => o.category_slug && o.category_slug === book.category_slug && !byAuthor.includes(o)).slice(0, 12);
  const details: [typeof BookOpen, string, string | number | null | undefined][] = [
    [FileText, "Format", book.file_format], [Layers, "Pages", book.pages], [Globe2, "Language", view.language], [Hash, "ISBN", book.isbn],
    [Building2, "Publisher", book.publisher], [BookOpen, "Edition", view.edition], [BadgeCheck, "Published", book.release_date ? String(book.release_date).slice(0, 10) : book.year],
  ];
  const facts = Object.entries(book.facts || {}).filter(([k]) => !k.startsWith("_"));
  const paragraphs = (book.long_description || "").split(/\n\s*\n/).filter(Boolean);
  const tabs = [
    (paragraphs.length || book.description) && { id: "about", label: "About the book", content: <div className="prose">{(paragraphs.length ? paragraphs : [book.description!]).map((p, i) => <p key={i}>{p}</p>)}</div> },
    view.highlights.length && { id: "contents", label: "Contents", content: <ul className="contents-list">{view.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> },
    facts.length && { id: "details", label: "More details", content: <table className="spec-table"><tbody>{facts.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table> },
    author && { id: "author", label: "About the author", content: <div className="prose"><p><strong>{author.name}</strong></p>{author.bio && <p>{author.bio}</p>}<p><Link className="text-link" href={`/authors/${encodeURIComponent(author.id)}`}>All books by {author.name}</Link></p></div> },
  ].filter(Boolean) as { id: string; label: string; content: React.ReactNode }[];
  return <div className="product-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(bookJsonLd(book, url, view.saleable, now)) }} />
    <div className="wrap">
      <nav className="crumbs product-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / {category && <><Link href={`/category/${category.slug}`}>{category.name}</Link> / </>}<span aria-current="page">{book.title}</span></nav>
      <article className="product-main">
        <div className="product-gallery"><div className="gallery-stage"><Cover src={book.cover} title={book.title} sizes="(max-width: 900px) 80vw, 420px" priority /></div>
          {sample && <a className="btn btn-outline sample-btn" href={sample} target="_blank" rel="noopener noreferrer"><BookOpen size={17} aria-hidden="true" /> Read a sample</a>}</div>
        <div className="product-info">
          <div className="title-row"><h1>{book.title}</h1><div className="title-actions">{/* wishlist heart: Task C2 */}<ShareButton title={book.title} url={url} /></div></div>
          {book.subtitle && <p className="product-subtitle">{book.subtitle}</p>}
          {book.authorship && <p className="product-author">by {book.author_slug ? <Link href={`/authors/${encodeURIComponent(book.author_slug)}`}>{book.authorship}</Link> : book.authorship}</p>}
          <ul className="tag-row">{category && <li><Link className="chip" href={`/category/${category.slug}`}>{category.name}</Link></li>}
            {view.language && <li><Link className="chip" href={`/search?language=${encodeURIComponent(view.language)}`}>{view.language}</Link></li>}
            {book.file_format && <li><span className="chip">{book.file_format}</span></li>}</ul>
          <Price book={view} size="page" />
          {view.saleable && <p className="tax-note">Digital edition · Personal-use licence</p>}
          <div className="buy-row"><AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} saveable={view.saveable} />{/* Buy now: Task C4 */}</div>
          {!enabled && <p className="notice">Online ordering is opening soon. Save this book to your bag and check out when it opens.</p>}
          <ul className="trust-row">{[[Download, "Instant download"], [Lock, "Secure payment"], [BadgeCheck, "Licensed copy"], [Lifetime, "Lifetime library"]].map(([Icon, label]) =>
            <li key={label as string}><span className="trust-icon"><Icon size={22} aria-hidden="true" /></span>{label as string}</li>)}</ul>
          <dl className="detail-strip">{details.filter(([, , v]) => v).map(([Icon, label, value]) => <div key={label}><dt><Icon size={18} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}</dl>
        </div>
      </article>
      <BookTabs tabs={tabs} />
      {byAuthor.length > 0 && <div className="section"><Carousel title={`More by ${book.authorship}`}>{byAuthor.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>}
      {similar.length > 0 && <div className="section"><Carousel title="Similar books" href={category ? `/category/${category.slug}` : "/search"}>{similar.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>}
    </div>
  </div>;
}
```

The two JSX comments name where Tasks C2 and C4 insert their components; they are anchors, not unfinished work, and those tasks replace them.

Create `src/styles/product.css` (import in `globals.css`):

```css
@layer components {
  .product-page { padding-bottom: 24px; }
  .product-crumbs { padding-block: 16px; }
  .product-main { display: grid; grid-template-columns: minmax(0, 520px) minmax(0, 1fr); gap: 40px; align-items: start; }
  .product-gallery { position: sticky; top: 12px; display: grid; gap: 12px; }
  .gallery-stage { display: grid; place-items: center; aspect-ratio: 4 / 5; padding: 32px; background: var(--card); border-radius: 16px; }
  .gallery-stage img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 16px 24px rgb(0 0 0 / 18%)); }
  .sample-btn { justify-self: center; }
  .title-row { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
  .product-info h1 { font-size: clamp(28px, 3.4vw, 40px); font-weight: 800; }
  .title-actions { display: flex; gap: 8px; flex: none; }
  .product-subtitle { margin-top: 6px; font-size: 18px; color: var(--ink-2); }
  .product-author { margin-top: 8px; font-size: 16px; } .product-author a { color: #1D4ED8; font-weight: 600; } .product-author a:hover { text-decoration: underline; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 14px 18px; }
  .tax-note { margin-top: 4px; color: var(--muted); font-size: 13px; }
  .buy-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; max-width: 460px; }
  .buy-row .card-add { margin-top: 0; min-height: 52px; font-size: 16px; }
  .notice { margin-top: 12px; padding: 10px 14px; border-radius: 8px; background: #FEF9C3; font-size: 14px; max-width: 460px; }
  .trust-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 24px; padding-block: 20px; border-block: 1px solid var(--line); text-align: center; font-size: 13px; font-weight: 600; }
  .trust-row li { display: grid; justify-items: center; gap: 8px; }
  .trust-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 999px; background: var(--yellow); }
  .detail-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; margin: 20px 0 0; }
  .detail-strip dt { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; font-weight: 600; text-transform: uppercase; }
  .detail-strip dd { margin: 4px 0 0; font-weight: 650; overflow-wrap: anywhere; }
  .book-tabs { margin-top: 40px; background: var(--card); border-radius: 16px; padding: 8px 24px 24px; }
  .tab-list { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--line); }
  .tab-list button { padding: 16px 14px; border: 0; background: none; font: 700 15px/1 var(--font-head); color: var(--muted); border-bottom: 3px solid transparent; white-space: nowrap; }
  .tab-list button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--yellow-strong); }
  .tab-panel { padding-top: 20px; }
  .prose p { margin-bottom: 14px; max-width: 75ch; color: var(--ink-2); line-height: 1.7; }
  .contents-list { display: grid; gap: 8px; padding-left: 20px; list-style: decimal; max-width: 75ch; }
  .spec-table { width: 100%; max-width: 720px; border-collapse: collapse; }
  .spec-table th, .spec-table td { padding: 12px; border: 1px solid var(--line); text-align: left; font-size: 14px; }
  .spec-table th { width: 40%; color: var(--muted); font-weight: 550; }
  .text-link { text-decoration: underline; font-weight: 600; }
  @media (max-width: 900px) {
    .product-main { grid-template-columns: 1fr; gap: 20px; }
    .product-gallery { position: static; } .gallery-stage { aspect-ratio: auto; max-height: 420px; }
    .trust-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .buy-row { position: sticky; bottom: 0; z-index: 20; margin-inline: -16px; padding: 10px 16px; background: var(--card); box-shadow: 0 -6px 18px rgb(0 0 0 / 10%); max-width: none; }
  }
}
```

Delete `BookCopy.tsx`, `ChapterPreview.tsx`, `MotionBookLink.tsx` if `grep` shows no remaining importers (the old book page and Hero were the only users). `src/app/order/[id]/page.tsx` imports `CopyLinkButton`; keep that one.

If Task A10's offer lines were commented out, re-enable them now and run `npm run test:admin` against a fresh preview.

- [ ] **Step 3: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Screenshot `/books/demo-the-monsoon-ledger` (on sale) and `/books/researching-research-for-ayurveda`. Must match `scratch/reference-crossword-detail.png` structure: white image card left; big bold title, blue author link, chips, `MRP struck · price · green pill`, yellow "Add to bag", yellow trust circles, icon detail strip, tabs below, carousels. At 390px the buy row sticks to the bottom.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/books src/components/product src/lib/catalogue.ts src/styles/product.css src/app/globals.css src/components src/components/reading-room.test.cjs
git commit -m "Retail product page: image card, offer price block, trust row, detail strip, tabs, author and similar carousels"
```

---

### Task B7: Restyle the remaining pages and remove dead styles

**Files:**
- Modify: `src/app/globals.css` (remaining rules for cart, checkout, order, library, login, author workspace, publish, legal, authors/[id], error and not-found pages)
- Modify: `src/app/authors/[id]/page.tsx` (use `grid-books`, `Cover` and the frame styles)
- Modify: `src/app/cart/CartContents.tsx`, `src/app/checkout/CheckoutForm.tsx` (show `currentPrice` via `Price`; labels "bag")
- Modify: `src/app/publish/page.tsx` (publishing landing content per spec "Publish-with-us": steps and what is accepted)
- Delete: `src/components/Reveal.tsx`, `src/components/StatCard.tsx` only if `grep` finds no importer

**Interfaces:**
- Consumes `Price` (Task B3) in cart and checkout summaries. Cart and checkout totals are computed from `book.price` (current price) for display; checkout charges what the server computes (Task C6).

- [ ] **Step 1: Write the failing test**

In `checkPausedSelection` in `reading-room.test.cjs` add:

```js
  const priced = publicBook({ ...record, price_inr: 29900, sale_price_inr: 25200 });
  const bag = renderToStaticMarkup(React.createElement(CartContents, { books: [priced], enabled: true }));
  assert.match(bag, /₹252/);
  assert.match(bag, /<s[^>]*>₹299<\/s>/);
  assert.match(renderToStaticMarkup(React.createElement(CheckoutForm, { books: [priced], enabled: true, initialSlug: priced.slug })), /₹252/);
```

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL (`₹252` missing: cart shows `price_inr`).

- [ ] **Step 2: Implement**

In `src/app/cart/CartContents.tsx`, replace the per-book price markup (`book.saleable && book.price_inr > 0 ? rupees(book.price_inr) : "Not yet on sale"`) with `<Price book={book} />` plus `{!book.saleable && <p className="small muted">Not yet on sale</p>}`, and compute the subtotal with `cartTotals(saleable.map((b) => ({ price_inr: b.price })))` instead of `price_inr`. Rename visible "cart" copy to "bag" ("Your bag", "Your bag is empty", "Continue browsing"). In `src/app/checkout/CheckoutForm.tsx` line ~115 replace `rupees(book.price_inr)` with `rupees(book.price)` and use `book.price` wherever the summary total is computed. Keep `parseCart`/`CART_KEY` unchanged (stored data compatibility).

Replace `src/app/publish/page.tsx`:

```tsx
import Link from "next/link";
import { getReader } from "@/lib/reader-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publish with us", robots: { index: true, follow: true } };
export default async function PublishPage() {
  const reader = await getReader();
  const start = reader ? "/author" : "/login?next=/author";
  return <div className="wrap page-shell">
    <section className="publish-banner"><div><h1>Publish your digital edition</h1>
      <p>Reach readers across India. Every submission gets editorial review, rights clearance and agreed commercial terms before it goes on sale.</p>
      <Link className="btn btn-yellow" href={start}>{reader ? "Open your author workspace" : "Sign in to start"}</Link></div>
      <div className="publish-art" aria-hidden="true"><span /><span /><span /></div></section>
    <section className="section"><div className="section-head"><div><h2>How it works</h2></div></div>
      <ol className="steps"><li>Create your author profile</li><li>Upload your manuscript, cover and sample</li><li>Editorial and rights review</li><li>Release and start selling</li></ol></section>
    <section className="section panel"><h2>What we accept</h2>
      <ul className="contents-list"><li>PDF or EPUB files</li><li>Original work, or work you hold the digital rights to</li><li>A cover image at least 1600 pixels tall</li><li>An optional free sample for readers</li></ul>
      <p className="tax-note">Approval does not release a title for sale on its own; rights, terms and clean files are all required. <Link className="text-link" href="/terms">Read the terms</Link></p></section>
  </div>;
}
```

The existing component test asserts nothing about `/publish`; `scripts/check-browser.mjs` visits it for overflow and accessibility only.

Append to `globals.css` (after existing cart/checkout rules) and update those rules to the new tokens:

```css
@layer components {
  .page-shell { padding-block: 32px 48px; }
  .page-heading h1 { font-size: clamp(30px, 4vw, 44px); font-weight: 800; }
  .page-heading p { margin-top: 8px; color: var(--ink-2); }
  .panel { background: var(--card); border-radius: var(--radius-card); padding: 24px; }
  .cart-layout, .checkout-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 24px; align-items: start; }
  .cart-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 16px; margin-bottom: 12px; background: var(--card); border-radius: var(--radius-card); }
  .cart-row img { width: 88px; height: 118px; object-fit: contain; }
  .cart-row h2 { font: 700 17px/1.3 var(--font-head); }
  .order-summary { position: sticky; top: 12px; background: var(--card); border-radius: var(--radius-card); padding: 24px; }
  .order-summary h2 { font-size: 22px; margin-bottom: 16px; }
  .summary-line { display: flex; justify-content: space-between; gap: 16px; padding-block: 10px; border-bottom: 1px solid var(--line); font-size: 14px; }
  .summary-total { font-weight: 800; font-size: 18px; border-bottom: 0; }
  .order-summary > .btn, .checkout-form > .btn { width: 100%; margin-top: 16px; }
  .steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; counter-reset: step; }
  .steps li { counter-increment: step; padding: 20px; background: var(--card); border-radius: var(--radius-card); font-weight: 600; }
  .steps li::before { content: counter(step); display: grid; place-items: center; width: 36px; height: 36px; margin-bottom: 12px; border-radius: 999px; background: var(--yellow); font: 800 16px/1 var(--font-head); }
  .prose-legal { max-width: 75ch; } .prose-legal h2 { font-size: 22px; margin-block: 28px 10px; } .prose-legal p, .prose-legal li { color: var(--ink-2); line-height: 1.7; margin-bottom: 12px; }
  @media (max-width: 900px) { .cart-layout, .checkout-layout { grid-template-columns: 1fr; } .order-summary { position: static; } .steps { grid-template-columns: 1fr 1fr; } }
}
```

Wrap the top-level content of cart, checkout, library, login, author, publish, order, policy, not-found and error pages in `<div className="wrap page-shell">` if they are not already wrapped by `.wrap section`, and replace `className="title …"` / `font-display` usages with `page-heading` markup. Search for leftovers: `grep -rn "font-display\|title-xl\|title-lg\|gold-rule\|eyebrow mb" src/app` and replace each with the new classes. In `src/app/authors/[id]/page.tsx` replace `book-grid` with `grid-books`, `author-hero` keeps its markup but switch the photo to a 120px circle via `.circle.photo` classes.

Delete `src/components/Reveal.tsx` (no importers). Keep `StatCard.tsx`: the admin dashboard uses it.

- [ ] **Step 3: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Screenshot `/cart` (with two demo books added through the UI), `/checkout?book=demo-the-monsoon-ledger`, `/library`, `/login`, `/publish`, `/privacy`, `/authors/demo-ananya-rao`, `/does-not-exist`: no serif, no old green panels, every page sits inside the new frame.

- [ ] **Step 4: Commit**

```bash
git add -A src/app src/components src/app/globals.css src/components/reading-room.test.cjs
git commit -m "Bring cart, checkout, library, sign-in, publish, author and policy pages into the retail frame"
```

---

# Part C — Interactions and offers

### Task C1: Search suggestions

**Files:**
- Create: `src/lib/search.ts`
- Create: `src/app/api/search/suggest/route.ts`
- Create: `src/components/SearchBox.tsx`
- Modify: `src/components/StoreHeader.tsx` (use `SearchBox`)
- Create: `scripts/test-search.mjs`
- Modify: `scripts/test-all.mjs`, `src/styles/header.css`

**Interfaces:**
- Produces in `src/lib/search.ts` (pure):

```ts
export type Suggestion = { books: { slug: string; title: string; authorship: string | null; cover: string | null; price: number; onSale: boolean; saleable: boolean }[];
  authors: { id: string; name: string }[]; categories: { slug: string; name: string }[] };
export function normaliseQuery(raw: string | null): string;  // trims, lowercases, collapses spaces, caps at 80 chars; "" when under 2 chars
export function rankSuggestions(books: PublicBook[], categories: { slug: string; name: string }[], authors: { id: string; name: string }[], q: string): Suggestion;
```

  Ranking: title starts with q (0) < a word in the title starts with q (1) < title contains q (2) < author or ISBN contains q (3); ties by title. Books ≤ 6, authors ≤ 3, categories ≤ 3. Literal substring match only.
- Route: `GET /api/search/suggest?q=` → `200 { books, authors, categories }` with `cache-control: private, max-age=30`; `429` after 60 requests per minute per client; never echoes input outside JSON.
- `SearchBox` replaces the header `<form>`: same `action="/search"` and `name="q"` (works without JavaScript); with JavaScript it is an ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) over a `role="listbox"`; Arrow keys move, Enter opens the active option (or submits the search when none is active), Escape closes; 150ms debounce; stale responses ignored.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-search.mjs`:

```js
import assert from 'node:assert/strict';
import { load } from './test-commerce.mjs';

const S = load('src/lib/search.ts');
const b = (title, extra = {}) => ({ slug: title.toLowerCase().replace(/\W+/g, '-'), title, authorship: 'Meera Iyer', isbn: null, cover: null, price: 100, onSale: false, saleable: true, ...extra });
const books = [b('The Monsoon Ledger'), b('Monsoon'), b('Paper Boats', { authorship: 'Arjun Monsoonwala' }), b('Seasons of Monsoon Rain'),
  b('Code for Everyone', { isbn: '9781234567897' }), ...Array.from({ length: 10 }, (_, i) => b(`Monsoon Notes ${i}`))];

assert.equal(S.normaliseQuery(null), '');
assert.equal(S.normaliseQuery(' m '), '');
assert.equal(S.normaliseQuery('  MONSOON   Rain '), 'monsoon rain');
assert.equal(S.normaliseQuery('x'.repeat(500)).length, 80);

const r = S.rankSuggestions(books, [{ slug: 'monsoon-reads', name: 'Monsoon reads' }], [{ id: 'a1', name: 'Arjun Monsoonwala' }], 'monsoon');
assert.equal(r.books.length, 6);
assert.deepEqual(r.books.slice(0, 2).map(x => x.title), ['Monsoon', 'Monsoon Notes 0']);
assert.ok(!('isbn' in r.books[0]) && !('description' in r.books[0]), 'only public suggestion fields');
assert.deepEqual(r.authors.map(a => a.id), ['a1']);
assert.deepEqual(r.categories.map(c => c.slug), ['monsoon-reads']);
assert.deepEqual(S.rankSuggestions(books, [], [], '9781234567897').books.map(x => x.title), ['Code for Everyone']);
for (const hostile of ['%', '_', "'", '<script>', '.*'])
  assert.deepEqual(S.rankSuggestions(books, [], [], S.normaliseQuery(hostile + hostile)), { books: [], authors: [], categories: [] });

const route = load('src/app/api/search/suggest/route.ts', {
  '@/lib/store-data': { getStoreBooks: async () => books, getCategories: async () => [], getPublishedAuthors: async () => [] },
  '@/lib/rate-limit': { clientKey: () => 'k', consumeLimit: async () => allowed },
  '@/lib/search': S,
});
let allowed = true;
const call = async q => route.GET(new Request(`https://example.com/api/search/suggest?q=${encodeURIComponent(q)}`));
const ok = await call('monsoon');
assert.equal(ok.status, 200);
assert.equal((await ok.json()).books.length, 6);
const evil = await call('<script>alert(1)</script>');
assert.equal(evil.status, 200);
assert.doesNotMatch(await evil.text(), /<script>/);
assert.deepEqual(await (await call('a')).json(), { books: [], authors: [], categories: [] });
allowed = false;
assert.equal((await call('monsoon')).status, 429);
console.log('Search checks passed: normalisation, ranking, limits, public fields, hostile input, rate limit.');
```

Register in `scripts/test-all.mjs` after `'scripts/test-listing.mjs'`.

Run: `node --import tsx scripts/test-search.mjs`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement**

Create `src/lib/search.ts`:

```ts
import type { PublicBook } from "@/components/book-data";

export type Suggestion = { books: { slug: string; title: string; authorship: string | null; cover: string | null; price: number; onSale: boolean; saleable: boolean }[];
  authors: { id: string; name: string }[]; categories: { slug: string; name: string }[] };

export function normaliseQuery(raw: string | null) {
  const q = (raw ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  return q.length >= 2 ? q : "";
}

// ponytail: in-memory ranking over the visible catalogue; move to SQL (pg_trgm) past a few thousand titles.
export function rankSuggestions(books: PublicBook[], categories: { slug: string; name: string }[], authors: { id: string; name: string }[], q: string): Suggestion {
  if (!q) return { books: [], authors: [], categories: [] };
  const score = (b: PublicBook) => {
    const title = b.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (title.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) return 1;
    if (title.includes(q)) return 2;
    if (b.authorship?.toLowerCase().includes(q) || b.isbn?.toLowerCase().includes(q)) return 3;
    return -1;
  };
  const ranked = books.map((b) => [score(b), b] as const).filter(([s]) => s >= 0).sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).slice(0, 6);
  return {
    books: ranked.map(([, b]) => ({ slug: b.slug, title: b.title, authorship: b.authorship, cover: b.cover, price: b.price, onSale: b.onSale, saleable: b.saleable })),
    authors: authors.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 3).map(({ id, name }) => ({ id, name })),
    categories: categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3).map(({ slug, name }) => ({ slug, name })),
  };
}
```

Create `src/app/api/search/suggest/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { clientKey, consumeLimit } from "@/lib/rate-limit";
import { normaliseQuery, rankSuggestions } from "@/lib/search";

export const runtime = "nodejs";
const EMPTY = { books: [], authors: [], categories: [] };

export async function GET(req: Request) {
  const q = normaliseQuery(new URL(req.url).searchParams.get("q"));
  if (!q) return NextResponse.json(EMPTY);
  try {
    if (!(await consumeLimit(clientKey(req, "suggest"), 60, 60))) return NextResponse.json({ error: "Too many searches. Try again in a minute." }, { status: 429 });
    const [books, categories, authors] = await Promise.all([getStoreBooks(), getCategories(), getPublishedAuthors()]);
    return NextResponse.json(rankSuggestions(books, categories, authors, q), { headers: { "cache-control": "private, max-age=30" } });
  } catch {
    console.error("[suggest] suggestions unavailable");
    return NextResponse.json(EMPTY, { status: 503 });
  }
}
```

`NextResponse.json` escapes `<` only as part of normal JSON; the test asserts the response body never contains a raw `<script>` because the query is not echoed (only catalogue fields are returned).

Create `src/components/SearchBox.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { rupees } from "@/lib/money";
import type { Suggestion } from "@/lib/search";

type Option = { key: string; href: string; label: string; detail?: string; cover?: string | null };

export default function SearchBox() {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const latest = useRef(0);
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setResult(null); return; }
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
        if (!response.ok) throw new Error();
        const data = await response.json() as Suggestion;
        if (ticket === latest.current) { setResult(data); setActive(-1); setOpen(true); }
      } catch { if (ticket === latest.current) setResult(null); }
    }, 150);
    return () => clearTimeout(timer);
  }, [value]);
  const options: Option[] = result ? [
    ...result.books.map((b) => ({ key: `b-${b.slug}`, href: `/books/${encodeURIComponent(b.slug)}`, label: b.title, cover: b.cover,
      detail: [b.authorship, b.saleable && b.price > 0 ? rupees(b.price) : null].filter(Boolean).join(" · ") })),
    ...result.authors.map((a) => ({ key: `a-${a.id}`, href: `/authors/${encodeURIComponent(a.id)}`, label: a.name, detail: "Author" })),
    ...result.categories.map((c) => ({ key: `c-${c.slug}`, href: `/category/${c.slug}`, label: c.name, detail: "Category" })),
  ] : [];
  const expanded = open && options.length > 0;
  return <form action="/search" className="header-search" role="search" onSubmit={(e) => {
    if (expanded && active >= 0) { e.preventDefault(); setOpen(false); router.push(options[active].href); }
  }}>
    <label htmlFor={`${id}-input`} className="sr-only">Search books, authors and categories</label>
    <input id={`${id}-input`} name="q" type="search" placeholder="Search by title, author or ISBN" autoComplete="off" value={value}
      role="combobox" aria-expanded={expanded} aria-controls={`${id}-list`} aria-autocomplete="list"
      aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
      onChange={(e) => { setValue(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && options.length) { e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % options.length); }
        if (e.key === "ArrowUp" && options.length) { e.preventDefault(); setActive((i) => (i <= 0 ? options.length - 1 : i - 1)); }
        if (e.key === "Escape") { setOpen(false); setActive(-1); }
      }} />
    <button type="submit" aria-label="Search"><Search size={18} strokeWidth={2.2} aria-hidden="true" /></button>
    {expanded && <ul id={`${id}-list`} role="listbox" className="suggest-list" aria-label="Suggestions">{options.map((o, i) =>
      <li key={o.key} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={i === active ? "active" : undefined}
        onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)}>
        <Link href={o.href} onClick={() => setOpen(false)} tabIndex={-1}>
          {o.cover !== undefined && <span className="suggest-cover">{o.cover && <img src={o.cover} alt="" />}</span>}
          <span><span className="suggest-label">{o.label}</span>{o.detail && <span className="suggest-detail">{o.detail}</span>}</span></Link></li>)}
      <li role="option" aria-selected={false} className="suggest-all"><Link href={`/search?q=${encodeURIComponent(value.trim())}`} tabIndex={-1}>See all results for "{value.trim()}"</Link></li>
    </ul>}
  </form>;
}
```

In `StoreHeader.tsx` replace the `<form action="/search" …>…</form>` block with `<SearchBox />` (import it). The component test in Task B2 asserts `<form[^>]+action="/search"`, which stays true; `SearchBox` calls `useRouter`, so change that test's override to `{ "next/navigation": { usePathname: () => "/", useRouter: () => ({ push() {} }) } }`.

Append to `src/styles/header.css`:

```css
@layer components {
  .suggest-list { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 50; max-height: 70vh; overflow-y: auto; padding: 8px; background: var(--card); border-radius: 14px; box-shadow: var(--shadow-lift); }
  .suggest-list li a { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 8px; }
  .suggest-list li.active a, .suggest-list li a:hover { background: var(--page); }
  .suggest-cover { width: 34px; height: 46px; flex: none; border-radius: 4px; background: var(--page); overflow: hidden; } .suggest-cover img { width: 100%; height: 100%; object-fit: cover; }
  .suggest-label { display: block; font-weight: 650; } .suggest-detail { display: block; font-size: 12px; color: var(--muted); }
  .suggest-all a { font-weight: 650; text-decoration: underline; }
}
```

- [ ] **Step 3: Run tests and look**

Run: `node --import tsx scripts/test-search.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. In the preview type "mon" in the header: within ~150ms a dropdown shows covers, titles, author and price; ArrowDown highlights; Enter opens the book; Escape closes; with JavaScript disabled, Enter submits to `/search?q=mon`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/search.ts src/app/api/search src/components/SearchBox.tsx src/components/StoreHeader.tsx src/styles/header.css scripts/test-search.mjs scripts/test-all.mjs
git commit -m "Instant search suggestions with an accessible combobox and a rate-limited endpoint"
```

---

### Task C2: Wishlist

**Files:**
- Create: `src/lib/wishlist.ts`
- Create: `src/app/api/wishlist/route.ts`, `src/app/api/wishlist/merge/route.ts`
- Create: `src/components/WishlistProvider.tsx`, `src/components/WishlistButton.tsx`
- Create: `src/app/wishlist/page.tsx`, `src/app/wishlist/WishlistContents.tsx`
- Modify: `src/app/layout.tsx` (provider), `src/components/StoreHeader.tsx` (count), `src/components/BookCard.tsx` (heart), `src/app/books/[slug]/page.tsx` (heart at the `wishlist heart: Task C2` anchor)
- Create: `scripts/test-wishlist.mjs`
- Modify: `scripts/test-all.mjs`, `src/styles/card.css`

**Interfaces:**
- `src/lib/wishlist-parse.ts` (plain module, safe for client and server): `export function parseWishlist(value: string | null): string[]` — same slug rules as `parseCart`, max 100, de-duplicated.
- `src/lib/wishlist.ts` (server; imports the database client):

```ts
export { parseWishlist } from "./wishlist-parse";
export const WISHLIST_MAX = 100;
export async function listWishlist(readerId: string): Promise<string[]>; // only visible books, newest first
export async function addWishlist(readerId: string, slug: string): Promise<boolean>; // false when slug is not a visible book or list is full
export async function removeWishlist(readerId: string, slug: string): Promise<void>;
export async function mergeWishlist(readerId: string, slugs: string[]): Promise<string[]>; // inserts visible ones, ignores the rest, returns listWishlist
```
- API (JSON, origin-checked for mutations, reader required; guests get 401 and the client keeps local state): `GET /api/wishlist` → `{ slugs }`; `POST /api/wishlist` `{ slug }` → `{ slugs }`; `DELETE /api/wishlist` `{ slug }` → `{ slugs }`; `POST /api/wishlist/merge` `{ slugs }` → `{ slugs }`.
- `WishlistProvider({ signedIn, children })`: `useWishlist(): { slugs: string[]; ready: boolean; has(slug): boolean; toggle(slug): void }`. Storage key `reading-room-wishlist`. When `signedIn`, on mount POST merge with local slugs, then replace local with the server list; toggles update local immediately and sync in the background (failure keeps local state).
- `WishlistButton({ slug, title, variant?: "card" | "page" })`: heart toggle, `aria-pressed`, label "Add {title} to wishlist" / "Remove {title} from wishlist", pop animation (disabled under reduced motion).

- [ ] **Step 1: Write the failing test**

Create `scripts/test-wishlist.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { load } from './test-commerce.mjs';

const db = new PGlite();
await db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const n of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort())
  await db.exec(readFileSync(new URL(`../migrations/${n}`, import.meta.url), 'utf8'));
const sql = async (parts, ...v) => (await db.query(parts.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), v)).rows;
await db.exec(`insert into books(slug,title,price_inr,active) values('a','A',100,true),('b','B',100,true),('gone','Gone',100,false)`);
const provider = load('src/lib/wishlist-parse.ts');
const w = load('src/lib/wishlist.ts', { './db': { sql } });

assert.deepEqual(provider.parseWishlist('["a","a","../x",3,"b"]'), ['a', 'b']);
assert.equal(provider.parseWishlist(JSON.stringify(Array.from({ length: 150 }, (_, i) => `s-${i}`))).length, 100);
assert.deepEqual(provider.parseWishlist('nope'), []);

assert.equal(await w.addWishlist('r1', 'a'), true);
assert.equal(await w.addWishlist('r1', 'a'), true, 'idempotent');
assert.equal(await w.addWishlist('r1', 'gone'), false, 'archived books cannot be added');
assert.equal(await w.addWishlist('r1', 'missing'), false, 'unknown books cannot be added');
assert.deepEqual(await w.mergeWishlist('r1', ['b', 'gone', 'missing', 'a']), ['b', 'a']);
await db.exec(`update books set active=false where slug='b'`);
assert.deepEqual(await w.listWishlist('r1'), ['a'], 'archived titles disappear from the list without errors');
await w.removeWishlist('r1', 'a');
assert.deepEqual(await w.listWishlist('r1'), []);
assert.deepEqual(await w.listWishlist('r2'), [], 'readers are isolated');

const reader = { current: { id: 'r3', email: 'r3@example.com', name: 'R' } };
const route = load('src/app/api/wishlist/route.ts', { '@/lib/wishlist': w, '@/lib/reader-auth': { getReader: async () => reader.current, checkOrigin: req => req.headers.get('origin') === 'https://example.com' } });
const req = (method, body, origin = 'https://example.com') => new Request('https://example.com/api/wishlist', { method, headers: { origin, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
assert.equal((await route.POST(req('POST', { slug: 'a' }, 'https://evil.example'))).status, 403);
assert.deepEqual(await (await route.POST(req('POST', { slug: 'a' }))).json(), { slugs: ['a'] });
assert.equal((await route.POST(req('POST', { slug: '../etc' }))).status, 400);
reader.current = null;
assert.equal((await route.GET(req('GET'))).status, 401);
await db.close();
console.log('Wishlist checks passed: parsing, visibility, idempotency, merge drops archived and unknown, isolation, origin and auth.');
```

Register in `scripts/test-all.mjs` after `'scripts/test-search.mjs'`.

Run: `node --import tsx scripts/test-wishlist.mjs`
Expected: FAIL (modules missing).

- [ ] **Step 2: Implement**

Create `src/lib/wishlist-parse.ts`:

```ts
export function parseWishlist(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((s): s is string => typeof s === "string" && /^[a-z0-9][a-z0-9_-]{0,100}$/.test(s)))].slice(0, 100) : [];
  } catch { return []; }
}
```

Create `src/components/WishlistProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { parseWishlist } from "@/lib/wishlist-parse";

export const WISHLIST_KEY = "reading-room-wishlist";

type Wishlist = { slugs: string[]; ready: boolean; has: (slug: string) => boolean; toggle: (slug: string) => void };
const WishlistContext = createContext<Wishlist | null>(null);
const save = (slugs: string[]) => { try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(slugs)); } catch { /* storage blocked: keep in memory */ } };

export default function WishlistProvider({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let local: string[] = [];
    try { local = parseWishlist(localStorage.getItem(WISHLIST_KEY)); } catch { /* storage blocked */ }
    setSlugs(local);
    setReady(true);
    if (!signedIn) return;
    fetch("/api/wishlist/merge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: local }) })
      .then((r) => r.ok ? r.json() : Promise.reject()).then((data: { slugs: string[] }) => { setSlugs(data.slugs); save(data.slugs); })
      .catch(() => { /* keep local list; sync retries on the next page load */ });
  }, [signedIn]);
  const toggle = useCallback((slug: string) => {
    setSlugs((current) => {
      const removing = current.includes(slug);
      const next = removing ? current.filter((s) => s !== slug) : parseWishlist(JSON.stringify([slug, ...current]));
      save(next);
      if (signedIn) fetch("/api/wishlist", { method: removing ? "DELETE" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
      return next;
    });
  }, [signedIn]);
  return <WishlistContext.Provider value={{ slugs, ready, has: (slug) => slugs.includes(slug), toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("Wishlist controls require WishlistProvider.");
  return value;
}
```

Create `src/lib/wishlist.ts`:

```ts
import { sql } from "./db";
export { parseWishlist } from "./wishlist-parse";

export const WISHLIST_MAX = 100;
const visible = (slug: string) => sql`select 1 from books where slug=${slug} and active and (not coalesce(third_party,false) or (release_approved and coalesce(rights_approved,false) and coalesce(commercial_approved,false)))`;

export async function listWishlist(readerId: string) {
  const rows = await sql`select w.book_slug from wishlist w join books b on b.slug=w.book_slug
    where w.reader_id=${readerId} and b.active and (not coalesce(b.third_party,false) or (b.release_approved and coalesce(b.rights_approved,false) and coalesce(b.commercial_approved,false)))
    order by w.created_at desc, w.book_slug limit ${WISHLIST_MAX}` as { book_slug: string }[];
  return rows.map((r) => r.book_slug);
}

export async function addWishlist(readerId: string, slug: string) {
  if (!(await visible(slug)).length) return false;
  const count = await sql`select count(*)::int n from wishlist where reader_id=${readerId}` as { n: number }[];
  if (count[0].n >= WISHLIST_MAX) return false;
  await sql`insert into wishlist(reader_id,book_slug) values(${readerId},${slug}) on conflict do nothing`;
  return true;
}

export async function removeWishlist(readerId: string, slug: string) {
  await sql`delete from wishlist where reader_id=${readerId} and book_slug=${slug}`;
}

export async function mergeWishlist(readerId: string, slugs: string[]) {
  for (const slug of slugs.slice(0, WISHLIST_MAX)) await addWishlist(readerId, slug);
  return listWishlist(readerId);
}
```

Create `src/app/api/wishlist/route.ts`:

```ts
import { NextResponse } from "next/server";
import { addWishlist, listWishlist, removeWishlist } from "@/lib/wishlist";
import { checkOrigin, getReader } from "@/lib/reader-auth";

export const runtime = "nodejs";
const SLUG = /^[a-z0-9][a-z0-9_-]{0,100}$/;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function slugFrom(req: Request) {
  const text = await req.text();
  if (text.length > 1000) return null;
  try { const body = JSON.parse(text); return typeof body?.slug === "string" && SLUG.test(body.slug) ? body.slug as string : null; } catch { return null; }
}

export async function GET() {
  const reader = await getReader();
  if (!reader) return fail("Sign in to sync your wishlist.", 401);
  return NextResponse.json({ slugs: await listWishlist(reader.id) });
}

async function change(req: Request, action: "add" | "remove") {
  if (!checkOrigin(req)) return fail("Invalid origin.", 403);
  const reader = await getReader();
  if (!reader) return fail("Sign in to sync your wishlist.", 401);
  const slug = await slugFrom(req);
  if (!slug) return fail("Choose a book.", 400);
  if (action === "add") await addWishlist(reader.id, slug); else await removeWishlist(reader.id, slug);
  return NextResponse.json({ slugs: await listWishlist(reader.id) });
}
export const POST = (req: Request) => change(req, "add");
export const DELETE = (req: Request) => change(req, "remove");
```

Create `src/app/api/wishlist/merge/route.ts`:

```ts
import { NextResponse } from "next/server";
import { mergeWishlist, parseWishlist } from "@/lib/wishlist";
import { checkOrigin, getReader } from "@/lib/reader-auth";

export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const reader = await getReader();
  if (!reader) return NextResponse.json({ error: "Sign in to sync your wishlist." }, { status: 401 });
  const text = await req.text();
  if (text.length > 20000) return NextResponse.json({ error: "Too many books." }, { status: 413 });
  let slugs: string[] = [];
  try { slugs = parseWishlist(JSON.stringify(JSON.parse(text)?.slugs ?? [])); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  return NextResponse.json({ slugs: await mergeWishlist(reader.id, slugs) });
}
```

Create `src/components/WishlistButton.tsx`:

```tsx
"use client";

import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useWishlist } from "./WishlistProvider";

export default function WishlistButton({ slug, title, variant = "card" }: { slug: string; title: string; variant?: "card" | "page" }) {
  const wishlist = useWishlist();
  const reduced = useReducedMotion();
  const on = wishlist.has(slug);
  return <motion.button type="button" className={`heart-btn ${variant}`} aria-pressed={on} disabled={!wishlist.ready}
    aria-label={on ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`} onClick={() => wishlist.toggle(slug)}
    whileTap={reduced ? undefined : { scale: .8 }} animate={reduced ? undefined : { scale: on ? [1, 1.25, 1] : 1 }} transition={{ duration: .25 }}>
    <Heart size={variant === "page" ? 20 : 18} fill={on ? "currentColor" : "none"} aria-hidden="true" />
  </motion.button>;
}
```

In `src/app/layout.tsx`: `const reader = await getReader().catch(() => null);` (import from `@/lib/reader-auth`), and wrap inside `CartProvider`: `<WishlistProvider signedIn={!!reader}>…</WishlistProvider>`.

In `StoreHeader.tsx` make the wishlist link show a count: `const wishlist = useWishlist();` and inside the wishlist `<Link>` add `{wishlist.slugs.length > 0 && <span className="count-badge">{wishlist.slugs.length}</span>}`; update its `aria-label` to `` `Wishlist, ${wishlist.slugs.length} ${wishlist.slugs.length === 1 ? "book" : "books"}` ``.

In `BookCard.tsx` add `<WishlistButton slug={book.slug} title={book.title} />` as the first child of `article.product-card` (it is positioned over the cover by CSS). In `src/app/books/[slug]/page.tsx` replace `{/* wishlist heart: Task C2 */}` with `<WishlistButton slug={book.slug} title={book.title} variant="page" />`.

The component tests that render `BookCard`/`StoreHeader` need the hook mocked: in `reading-room.test.cjs`, add to the `dependency` resolver `if (name === "./WishlistProvider" || name === "@/components/WishlistProvider") return { useWishlist: () => ({ slugs: [], ready: true, has: () => false, toggle() {} }) };` and `if (name === "./WishlistButton") return load("components/WishlistButton.tsx");`.

Create `src/app/wishlist/page.tsx` and `WishlistContents.tsx`:

```tsx
// page.tsx
import { getStoreBooks } from "@/lib/store-data";
import WishlistContents from "./WishlistContents";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your wishlist", robots: { index: false, follow: false } };
export default async function WishlistPage() {
  return <div className="wrap page-shell"><div className="page-heading"><h1>Your wishlist</h1><p>Books you've saved for later.</p></div>
    <WishlistContents books={await getStoreBooks()} enabled={process.env.COMMERCE_ENABLED === "true"} /></div>;
}
```

```tsx
// WishlistContents.tsx
"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import BookCard from "@/components/BookCard";
import type { PublicBook } from "@/components/book-data";
import { useWishlist } from "@/components/WishlistProvider";

export default function WishlistContents({ books, enabled }: { books: PublicBook[]; enabled: boolean }) {
  const wishlist = useWishlist();
  if (!wishlist.ready) return <p role="status">Loading your wishlist…</p>;
  const saved = wishlist.slugs.flatMap((slug) => books.filter((b) => b.slug === slug));
  if (!saved.length) return <div className="empty-results"><Heart size={28} aria-hidden="true" /><h2>Save books you love</h2><p>Tap the heart on any book to keep it here.</p><Link className="btn btn-dark" href="/search">Browse books</Link></div>;
  return <div className="grid-books">{saved.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</div>;
}
```

(Slugs for archived books are simply not found in `books` and are skipped; they never throw.)

Append to `src/styles/card.css`:

```css
@layer components {
  .heart-btn { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink); }
  .heart-btn[aria-pressed="true"] { color: var(--sale); border-color: var(--sale); }
  .heart-btn.card { position: absolute; top: 18px; right: 18px; z-index: 2; }
  .heart-btn.page { width: 40px; height: 40px; }
}
```

- [ ] **Step 3: Run tests and look**

Run: `node --import tsx scripts/test-wishlist.mjs && node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. In the preview: tap hearts on two cards, the header count shows 2, `/wishlist` lists them, reload keeps them; sign in through the printed dev link, the list survives sign-in (merge); archive one of them in admin and `/wishlist` shows only the other.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wishlist.ts src/lib/wishlist-parse.ts src/app/api/wishlist src/components/WishlistProvider.tsx src/components/WishlistButton.tsx src/app/wishlist src/app/layout.tsx src/components/StoreHeader.tsx src/components/BookCard.tsx src/app/books src/styles/card.css scripts/test-wishlist.mjs scripts/test-all.mjs src/components/reading-room.test.cjs
git commit -m "Wishlist: hearts on every book, saved locally for guests and synced to the account on sign-in"
```

---

### Task C3: Quick view

**Files:**
- Create: `src/components/QuickView.tsx`
- Modify: `src/components/BookCard.tsx`, `src/styles/card.css`
- Test: `src/components/reading-room.test.cjs`

**Interfaces:**
- `QuickView({ book, enabled })` client component: a "Quick view" button (shown on card hover and always focusable) that opens a native `<dialog>` with cover, title, author, `Price`, the first 400 characters of `description`, `AddToCart`, `WishlistButton` and a "View full details" link. Uses `showModal()`; Escape and the close button close it; focus returns to the trigger. No fetch: it uses the card's `book` prop.

- [ ] **Step 1: Write the failing test**

Add to `reading-room.test.cjs` after the `CardView` assertions:

```js
assert.match(cardHtml, /Quick view/);
const QuickViewView = load("components/QuickView.tsx", { "./CartProvider": { useCart: () => cart }, "motion/react": { ...require("motion/react"), useReducedMotion: () => true } }).default;
const qv = renderToStaticMarkup(React.createElement(QuickViewView, { book: { ...saleBook, description: "x".repeat(600) }, enabled: true }));
assert.match(qv, /<dialog/);
assert.match(qv, /View full details/);
assert.ok((qv.match(/x/g) || []).length <= 402, "description is truncated");
```

Run: `node src/components/reading-room.test.cjs`
Expected: FAIL (`Quick view` missing).

- [ ] **Step 2: Implement**

Create `src/components/QuickView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Eye, X } from "lucide-react";
import { useRef } from "react";
import AddToCart from "./AddToCart";
import Cover from "./Cover";
import Price from "./Price";
import WishlistButton from "./WishlistButton";
import type { PublicBook } from "./book-data";

export default function QuickView({ book, enabled }: { book: PublicBook; enabled: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const blurb = book.description && book.description.length > 400 ? `${book.description.slice(0, 397)}…` : book.description;
  return <>
    <button ref={trigger} type="button" className="quick-view-btn" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
      <Eye size={16} aria-hidden="true" /> Quick view</button>
    <dialog ref={dialog} className="quick-view" aria-labelledby={`qv-${book.slug}`} onClose={() => trigger.current?.focus()}
      onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <button type="button" className="round-btn qv-close" onClick={() => dialog.current?.close()} aria-label="Close quick view"><X size={18} aria-hidden="true" /></button>
      <div className="qv-grid"><div className="qv-cover"><Cover src={book.cover} title={book.title} sizes="260px" /></div>
        <div className="qv-info"><h2 id={`qv-${book.slug}`}>{book.title}</h2>{book.authorship && <p className="card-author">{book.authorship}</p>}
          <Price book={book} size="page" />{blurb && <p className="qv-blurb">{blurb}</p>}
          <div className="qv-actions"><AddToCart slug={book.slug} title={book.title} enabled={enabled} saleable={book.saleable} saveable={book.saveable} />
            <WishlistButton slug={book.slug} title={book.title} variant="page" /></div>
          <Link className="text-link" href={`/books/${encodeURIComponent(book.slug)}`}>View full details</Link></div></div>
    </dialog>
  </>;
}
```

In `BookCard.tsx` add `<QuickView book={book} enabled={enabled} />` immediately after the `card-cover` link. Mock it in the `Listing`/home render tests only if they break (the real component renders server-side fine because `dialog` content is static markup).

Append to `src/styles/card.css`:

```css
@layer components {
  .quick-view-btn { position: absolute; left: 50%; top: 40%; transform: translate(-50%, 0); display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px;
    border: 0; border-radius: 999px; background: var(--ink); color: #fff; font: 650 12px/1 var(--font-body); opacity: 0; transition: opacity .15s; z-index: 2; }
  .product-card:hover .quick-view-btn, .quick-view-btn:focus-visible { opacity: 1; }
  @media (hover: none) { .quick-view-btn { display: none; } }
  .quick-view { width: min(760px, calc(100vw - 32px)); padding: 28px; border: 0; border-radius: 20px; box-shadow: var(--shadow-lift); }
  .quick-view::backdrop { background: rgb(0 0 0 / 45%); }
  .qv-close { position: absolute; top: 14px; right: 14px; }
  .qv-grid { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; }
  .qv-cover { background: var(--page); border-radius: 12px; padding: 16px; }
  .qv-info { display: grid; align-content: start; gap: 10px; }
  .qv-info h2 { font-size: 24px; padding-right: 40px; }
  .qv-blurb { color: var(--ink-2); font-size: 14px; }
  .qv-actions { display: flex; gap: 10px; align-items: center; } .qv-actions .cart-control { flex: 1; }
  @media (max-width: 640px) { .qv-grid { grid-template-columns: 1fr; } .qv-cover { max-width: 200px; } }
}
```
- [ ] **Step 3: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. In the preview hover a card → "Quick view" appears; click → dialog with cover, price, add to bag and heart; Escape closes and focus returns to the button.

- [ ] **Step 4: Commit**

```bash
git add src/components/QuickView.tsx src/components/BookCard.tsx src/styles/card.css src/components/reading-room.test.cjs
git commit -m "Quick view dialog on product cards"
```

---

### Task C4: Cart summary API, cart drawer and Buy now

**Files:**
- Create: `src/app/api/cart/summary/route.ts`
- Create: `src/components/CartDrawer.tsx`
- Create: `src/components/BuyNow.tsx`
- Modify: `src/components/CartProvider.tsx` (drawer state), `src/app/layout.tsx` (render drawer), `src/app/books/[slug]/page.tsx` (Buy now at the `Buy now: Task C4` anchor)
- Create: `scripts/test-cart-summary.mjs`
- Modify: `scripts/test-all.mjs`, `src/styles/card.css`

**Interfaces:**
- `POST /api/cart/summary` body `{ slugs: string[] }` (≤ 20, `parseCart` rules) → `200 { books: { slug, title, cover, authorship, price, regular, onSale, saleable }[] }` in request order, unknown or invisible slugs omitted; origin-checked; `400` on bad body.
- `CartProvider` context adds `drawerOpen: boolean; openDrawer(): void; closeDrawer(): void; lastAdded: string | null`; `add(slug)` also sets `lastAdded` and opens the drawer.
- `CartDrawer()` reads `useCart()`, fetches the summary when opened (and when `slugs` change while open), shows items, subtotal from server prices, "View bag" and "Checkout" (`/checkout`), and "Prices unavailable" with a "View bag" link on fetch failure. Native `<dialog>` with `showModal()`, slides in from the right, closes on Escape/backdrop.
- `BuyNow({ slug, title, enabled, saleable })`: adds to the bag without opening the drawer, then `router.push("/checkout")`; hidden unless `enabled && saleable`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-cart-summary.mjs`:

```js
import assert from 'node:assert/strict';
import { load } from './test-commerce.mjs';

const books = new Map([
  ['a', { slug: 'a', title: 'A', cover: null, authorship: 'X', price_inr: 29900, sale_price_inr: 25200, active: true, file_url: 'private:a.pdf', release_approved: true, scan_status: 'clean' }],
  ['hidden', { slug: 'hidden', title: 'H', price_inr: 100, active: false }],
]);
const route = load('src/app/api/cart/summary/route.ts', {
  '@/lib/db': { getBook: async slug => books.get(slug) ?? null },
  '@/lib/reader-auth': { checkOrigin: req => req.headers.get('origin') === 'https://example.com' },
});
const post = (body, origin = 'https://example.com') => route.POST(new Request('https://example.com/api/cart/summary', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
const ok = await (await post({ slugs: ['missing', 'a', 'hidden'] })).json();
assert.deepEqual(ok.books.map(b => [b.slug, b.price, b.regular, b.onSale]), [['a', 25200, 29900, true]]);
assert.ok(!('file_url' in ok.books[0]));
assert.equal((await post({ slugs: ['a'] }, 'https://evil.example')).status, 403);
assert.equal((await post({ slugs: 'a' })).status, 400);
assert.equal((await post({ slugs: Array.from({ length: 21 }, (_, i) => `s${i}`) })).status, 400);
console.log('Cart summary checks passed: server prices, hidden and unknown titles omitted, origin, limits.');
```

Register in `scripts/test-all.mjs` after `'scripts/test-wishlist.mjs'`.

Run: `node --import tsx scripts/test-cart-summary.mjs`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement**

Create `src/app/api/cart/summary/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBook } from "@/lib/db";
import { checkOrigin } from "@/lib/reader-auth";
import { publicBook, visibleBook } from "@/components/book-data";

export const runtime = "nodejs";
const SLUG = /^[a-z0-9][a-z0-9_-]{0,100}$/;

export async function POST(req: Request) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let slugs: unknown;
  try { const text = await req.text(); if (text.length > 4000) throw new Error(); slugs = JSON.parse(text)?.slugs; } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (!Array.isArray(slugs) || slugs.length > 20 || slugs.some((s) => typeof s !== "string" || !SLUG.test(s))) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const now = new Date();
  const rows = await Promise.all([...new Set(slugs as string[])].map(getBook));
  const books = rows.flatMap((b) => b && visibleBook(b) ? [publicBook(b, now)] : [])
    .map(({ slug, title, cover, authorship, price, regular, onSale, saleable }) => ({ slug, title, cover, authorship, price, regular, onSale, saleable }));
  return NextResponse.json({ books }, { headers: { "cache-control": "no-store" } });
}
```

In `src/components/CartProvider.tsx` extend the context type and state:

```tsx
type Cart = { slugs: string[]; ready: boolean; error: string; add: (slug: string, options?: { quiet?: boolean }) => void; remove: (slug: string) => void;
  drawerOpen: boolean; openDrawer: () => void; closeDrawer: () => void; lastAdded: string | null };
```

```tsx
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
```

and provide:

```tsx
    add: (slug, options) => { update(parseCart(JSON.stringify([...slugs, slug]))); setLastAdded(slug); if (!options?.quiet) setDrawerOpen(true); },
    remove: (slug) => update(slugs.filter((item) => item !== slug)),
    drawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false), lastAdded,
```

Update every test mock of the cart (`let cart = { … }` in `reading-room.test.cjs`) to include `drawerOpen: false, openDrawer() {}, closeDrawer() {}, lastAdded: null`.

Create `src/components/CartDrawer.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rupees } from "@/lib/money";
import { useCart } from "./CartProvider";
import Cover from "./Cover";

type Line = { slug: string; title: string; cover: string | null; authorship: string | null; price: number; regular: number; onSale: boolean; saleable: boolean };

export default function CartDrawer() {
  const cart = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (cart.drawerOpen && !el.open) el.showModal();
    if (!cart.drawerOpen && el.open) el.close();
  }, [cart.drawerOpen]);
  useEffect(() => {
    if (!cart.drawerOpen) return;
    let live = true;
    setFailed(false);
    fetch("/api/cart/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: cart.slugs }) })
      .then((r) => r.ok ? r.json() : Promise.reject()).then((d: { books: Line[] }) => { if (live) setLines(d.books); })
      .catch(() => { if (live) { setLines(null); setFailed(true); } });
    return () => { live = false; };
  }, [cart.drawerOpen, cart.slugs]);
  const added = lines?.find((l) => l.slug === cart.lastAdded);
  const payable = lines?.filter((l) => l.saleable) ?? [];
  const subtotal = payable.reduce((sum, l) => sum + l.price, 0);
  return <dialog ref={dialog} className="cart-drawer" aria-labelledby="drawer-title" onClose={cart.closeDrawer} onClick={(e) => { if (e.target === dialog.current) cart.closeDrawer(); }}>
    <div className="drawer-head"><h2 id="drawer-title">Your bag ({cart.slugs.length})</h2>
      <button type="button" className="round-btn" onClick={cart.closeDrawer} aria-label="Close bag"><X size={18} aria-hidden="true" /></button></div>
    {added && <p className="drawer-added" role="status"><Check size={16} aria-hidden="true" /> Added to bag: {added.title}</p>}
    {failed ? <p className="drawer-note">Prices unavailable right now. <Link href="/cart" onClick={cart.closeDrawer}>View bag</Link></p>
      : !lines ? <p className="drawer-note" role="status">Loading your bag…</p>
      : <ul className="drawer-lines">{lines.map((l) => <li key={l.slug}><span className="drawer-cover"><Cover src={l.cover} title={l.title} sizes="56px" /></span>
          <span className="drawer-text"><Link href={`/books/${encodeURIComponent(l.slug)}`} onClick={cart.closeDrawer}>{l.title}</Link>
            <span>{l.saleable ? <>{l.onSale && <s>{rupees(l.regular)}</s>} <strong>{rupees(l.price)}</strong></> : "Not yet on sale"}</span></span>
          <button type="button" className="icon-plain" onClick={() => cart.remove(l.slug)} aria-label={`Remove ${l.title} from bag`}><Trash2 size={17} aria-hidden="true" /></button></li>)}</ul>}
    <div className="drawer-foot">
      {lines && payable.length > 0 && <p className="drawer-subtotal"><span>Subtotal</span><strong>{rupees(subtotal)}</strong></p>}
      <p className="drawer-note">Final prices are confirmed at checkout.</p>
      <div className="drawer-actions"><Link className="btn btn-outline" href="/cart" onClick={cart.closeDrawer}>View bag</Link>
        <Link className="btn btn-yellow" href="/checkout" onClick={cart.closeDrawer}>Checkout</Link></div>
    </div>
  </dialog>;
}
```

Render `<CartDrawer />` in `src/app/layout.tsx` inside `CartProvider` after `<main>`.

Create `src/components/BuyNow.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useCart } from "./CartProvider";

export default function BuyNow({ slug, title, enabled, saleable }: { slug: string; title: string; enabled: boolean; saleable: boolean }) {
  const cart = useCart();
  const router = useRouter();
  if (!enabled || !saleable) return null;
  return <button type="button" className="btn btn-dark card-add" disabled={!cart.ready} aria-label={`Buy now: ${title}`}
    onClick={() => { if (!cart.slugs.includes(slug)) cart.add(slug, { quiet: true }); router.push("/checkout"); }}><Zap size={17} aria-hidden="true" /> Buy now</button>;
}
```

In `src/app/books/[slug]/page.tsx` replace `{/* Buy now: Task C4 */}` with `<BuyNow slug={book.slug} title={book.title} enabled={enabled} saleable={view.saleable} />`.

Append to `src/styles/card.css`:

```css
@layer components {
  .cart-drawer { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(420px, 100vw); height: 100dvh; max-height: none; padding: 0; border: 0; display: none; flex-direction: column; background: var(--card); }
  .cart-drawer[open] { display: flex; animation: drawer-in .25s ease-out; }
  .cart-drawer::backdrop { background: rgb(0 0 0 / 40%); }
  @keyframes drawer-in { from { transform: translateX(100%); } to { transform: none; } }
  .drawer-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--line); }
  .drawer-head h2 { font-size: 20px; }
  .drawer-added { display: flex; align-items: center; gap: 8px; margin: 12px 20px 0; padding: 10px 12px; border-radius: 8px; background: var(--offer-bg); color: var(--offer); font-weight: 650; font-size: 14px; }
  .drawer-lines { flex: 1; overflow-y: auto; padding: 8px 20px; }
  .drawer-lines li { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding-block: 12px; border-bottom: 1px solid var(--line); }
  .drawer-cover { width: 56px; height: 76px; background: var(--page); border-radius: 4px; overflow: hidden; } .drawer-cover img { width: 100%; height: 100%; object-fit: contain; }
  .drawer-text { display: grid; gap: 4px; font-size: 14px; } .drawer-text a { font-weight: 650; } .drawer-text s { color: var(--muted); }
  .icon-plain { border: 0; background: none; padding: 8px; color: var(--muted); } .icon-plain:hover { color: var(--sale); }
  .drawer-foot { padding: 16px 20px 20px; border-top: 1px solid var(--line); display: grid; gap: 10px; }
  .drawer-subtotal { display: flex; justify-content: space-between; font-size: 17px; }
  .drawer-note { padding-inline: 20px; font-size: 13px; color: var(--muted); } .drawer-foot .drawer-note { padding: 0; }
  .drawer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
}
```

- [ ] **Step 3: Run tests and look**

Run: `node --import tsx scripts/test-cart-summary.mjs && node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. In the preview "Add to bag" on a card slides in the drawer with "Added to bag: …", the server price and subtotal; removing a line updates it; Escape closes. With `COMMERCE_ENABLED=true` in a test preview, "Buy now" on a sale title lands on `/checkout` with the book selected.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cart src/components/CartDrawer.tsx src/components/BuyNow.tsx src/components/CartProvider.tsx src/app/layout.tsx src/app/books src/styles/card.css scripts/test-cart-summary.mjs scripts/test-all.mjs src/components/reading-room.test.cjs
git commit -m "Slide-in bag with server prices, added-to-bag confirmation, and Buy now"
```

---

### Task C5: Recently viewed

**Files:**
- Create: `src/components/RecentlyViewed.tsx`
- Modify: `src/app/books/[slug]/page.tsx`
- Test: `src/components/reading-room.test.cjs`

**Interfaces:**
- `RECENT_KEY = "reading-room-recent"`; `export function pushRecent(list: string[], slug: string): string[]` (moves `slug` to the front, de-duplicates, keeps 12).
- `RecentlyViewed({ current, enabled })`: on mount records `current`, then (if at least one other slug) POSTs the others to `/api/cart/summary` and renders a `Carousel` titled "Recently viewed" of small cards (cover, title, price, link). Renders nothing until data arrives or when empty.

- [ ] **Step 1: Write the failing test**

```js
const { pushRecent } = load("components/RecentlyViewed.tsx", { "motion/react": { ...require("motion/react"), useReducedMotion: () => true } });
assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
assert.equal(pushRecent(Array.from({ length: 12 }, (_, i) => `s${i}`), "new").length, 12);
assert.equal(pushRecent(Array.from({ length: 12 }, (_, i) => `s${i}`), "new")[0], "new");
```

Run: `node src/components/reading-room.test.cjs` → FAIL.

- [ ] **Step 2: Implement**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Carousel from "./Carousel";
import Cover from "./Cover";
import { rupees } from "@/lib/money";

export const RECENT_KEY = "reading-room-recent";
export function pushRecent(list: string[], slug: string) { return [slug, ...list.filter((s) => s !== slug)].slice(0, 12); }
type Item = { slug: string; title: string; cover: string | null; price: number; saleable: boolean };

export default function RecentlyViewed({ current }: { current: string }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let list: string[] = [];
    try { const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); list = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string" && /^[a-z0-9][a-z0-9_-]{0,100}$/.test(s)) : []; } catch { /* storage blocked */ }
    const next = pushRecent(list, current);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    const others = next.filter((s) => s !== current);
    if (!others.length) return;
    fetch("/api/cart/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: others }) })
      .then((r) => r.ok ? r.json() : Promise.reject()).then((d: { books: Item[] }) => setItems(d.books)).catch(() => {});
  }, [current]);
  if (!items.length) return null;
  return <div className="section"><Carousel title="Recently viewed">{items.map((b) => <Link key={b.slug} href={`/books/${encodeURIComponent(b.slug)}`} className="product-card recent-card">
    <span className="card-cover"><Cover src={b.cover} title={b.title} sizes="160px" /></span>
    <span className="card-body"><span className="recent-title">{b.title}</span>{b.saleable && b.price > 0 && <strong>{rupees(b.price)}</strong>}</span></Link>)}</Carousel></div>;
}
```

Add `.recent-title { font-weight: 650; font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }` to `card.css`. In the product page, after the "Similar books" block add `<RecentlyViewed current={book.slug} />`.

- [ ] **Step 3: Run tests and look**

Run: `node src/components/reading-room.test.cjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS. Visit three books; the third shows the other two under "Recently viewed".

- [ ] **Step 4: Commit**

```bash
git add src/components/RecentlyViewed.tsx src/app/books src/styles/card.css src/components/reading-room.test.cjs
git commit -m "Recently viewed carousel on book pages"
```

---

### Task C6: Offers through checkout, receipts and email

**Files:**
- Modify: `src/app/api/checkout/route.ts` (~line 120)
- Modify: `src/lib/db.ts` (`OrderItem.list_price`, done in Task A9 if already added)
- Modify: `src/lib/email.ts` (~line 100)
- Modify: `src/app/order/[id]/page.tsx` (savings line)
- Modify: `scripts/test-commerce-db.mjs`
- Modify: `READING_ROOM_PRD.md`

**Interfaces:**
- Checkout items: `{ slug, title, price: currentPrice(book, now).price, list_price: book.price_inr, file_url, file_format, file_sha256, edition }`. `computeTotals` over `price`. The idempotency hash is unchanged (slugs + customer), so a retry with the same key returns the stored order and its stored prices even if the sale has since ended.
- `orderSavings(order: Order): number` exported from `src/lib/money.ts` = sum of `max(0, list_price - price)` over items (0 for legacy items without `list_price`).

- [ ] **Step 1: Write the failing tests**

In `scripts/test-pricing.mjs` append:

```js
const { orderSavings } = load('src/lib/money.ts');
assert.equal(orderSavings({ items: [{ price: 25200, list_price: 29900 }, { price: 100 }, { price: 500, list_price: 400 }] }), 4700);
```

In `scripts/test-commerce-db.mjs`, `book-a` is `price_inr: 19900` and `request(key, overrides)` merges `overrides` into a body whose default `slugs` is `['book-a', 'book-b']`. Checkout limits each email to 10 orders per hour and every test order uses the mocked reader's email, so add this check immediately after the existing "checkout persists server prices and asset edition snapshots" check (early, while few orders exist):

```js
  await check('checkout charges the sale price only inside its window and snapshots the regular price', async () => {
    const a = books.get('book-a');
    Object.assign(a, { sale_price_inr: 15900, sale_starts_at: new Date(Date.now() - 60000).toISOString(), sale_ends_at: new Date(Date.now() + 3600000).toISOString() });
    try {
      const inWindow = await checkout.POST(request('checkout-sale-0001', { slugs: ['book-a'] }));
      assert.equal(inWindow.status, 200);
      const order = await getOrder((await inWindow.json()).orderId);
      assert.equal(order.total, 15900);
      assert.equal(order.items[0].price, 15900);
      assert.equal(order.items[0].list_price, 19900);
      a.sale_ends_at = new Date(Date.now() - 1).toISOString();
      const retried = await checkout.POST(request('checkout-sale-0001', { slugs: ['book-a'] }));
      assert.equal((await getOrder((await retried.json()).orderId)).total, 15900, 'a retry keeps the snapshot price');
      const after = await checkout.POST(request('checkout-sale-0002', { slugs: ['book-a'] }));
      assert.equal((await getOrder((await after.json()).orderId)).total, 19900, 'expired sale charges the regular price');
    } finally { delete a.sale_price_inr; delete a.sale_starts_at; delete a.sale_ends_at; }
  });
```
Run: `node --import tsx scripts/test-pricing.mjs; node --import tsx scripts/test-commerce-db.mjs`
Expected: FAIL (`orderSavings` missing; total 19900 instead of 15900).

- [ ] **Step 2: Implement**

In `src/lib/money.ts` append:

```ts
export function orderSavings(order: { items: { price: number; list_price?: number }[] }) {
  return order.items.reduce((sum, item) => sum + (typeof item.list_price === "number" && item.list_price > item.price ? item.list_price - item.price : 0), 0);
}
```

In `src/app/api/checkout/route.ts` add `import { computeTotals, currentPrice } from "@/lib/money";` (replace the existing `computeTotals` import) and change the item mapping:

```ts
    const now = new Date();
    const items = books.map(book => ({
      slug: book!.slug, title: book!.title, price: currentPrice(book!, now).price, list_price: book!.price_inr,
      file_url: book!.file_url, file_format: book!.file_format, file_sha256: book!.file_sha256,
      edition: book!.edition || null,
    }));
```

In `src/lib/email.ts` change the price cell to show the saving when present:

```ts
        <td align="right" style="…same style…">${typeof i.list_price === "number" && i.list_price > i.price ? `<s style="color:${BRAND.mute};">${rupees(i.list_price)}</s> ` : ""}${rupees(i.price)}</td>
```

and after the total row add, when `orderSavings(order) > 0`, a row `You saved ${rupees(orderSavings(order))}` in the same table style (import `orderSavings`).

In `src/app/order/[id]/page.tsx`, next to the total `<dd>` (line ~147) add:

```tsx
{orderSavings(order) > 0 && <><dt className="text-offer">You saved</dt><dd className="m-0 font-mono">{rupees(orderSavings(order))}</dd></>}
```

(import `orderSavings` from `@/lib/money`; add `.text-offer { color: var(--offer); }` to `tokens.css`).

In `READING_ROOM_PRD.md` replace "or discounts" in the first paragraph with ", or fake discounts. Admin-set per-title sale prices are allowed; a struck price must be the title's genuine regular price, the sale price is charged only inside its window, and orders snapshot both prices." 

- [ ] **Step 3: Run tests**

Run: `node --import tsx scripts/test-pricing.mjs && node --import tsx scripts/test-commerce-db.mjs && npm test && npx tsc --noEmit --incremental false`
Expected: PASS, including every existing commerce check (webhook amount validation still compares against `orders.total`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/checkout/route.ts src/lib/money.ts src/lib/email.ts src/app/order src/styles/tokens.css scripts/test-pricing.mjs scripts/test-commerce-db.mjs READING_ROOM_PRD.md src/lib/db.ts
git commit -m "Charge sale prices only inside their window, snapshot the regular price, and show savings on receipts"
```

---

### Task C7: Browser checks, docs and final review

**Files:**
- Modify: `scripts/check-browser.mjs`
- Modify: `DESIGN.md`, `IMPLEMENTATION.md`, `README.md` (preview and admin access section)

**Interfaces:**
- Consumes everything above. No new code interfaces.

- [ ] **Step 1: Rewrite the obsolete browser assertions**

In `scripts/check-browser.mjs`:
- `routes`: replace `'/catalogue'` with `'/search'`, add `'/category/science'`, `'/books/demo-the-monsoon-ledger'`, `'/wishlist'`.
- Replace the `if (route === '/') { … }` block with:

```js
        if (route === '/') {
          await page.evaluate(() => document.fonts.ready);
          assert.ok(await page.evaluate(() => document.fonts.check('750 32px "Plus Jakarta Sans Variable"') && document.fonts.check('400 16px "Inter Variable"')), `${name}: local fonts loaded`);
          const banner = await page.locator('.banner-slide:not([hidden])').first().boundingBox();
          if (!banner || banner.y >= (width < 768 ? 800 : 1000)) failures.push(`${name}: no first-viewport banner at ${width}`);
          assert.equal(await page.locator('.banner-controls [aria-label="Pause offers"]').count(), 0, `${name}: reduced motion shows no autoplay control`);
          await page.locator('.product-card').first().hover();
          await page.waitForTimeout(300);
          assert.ok(await page.locator('.product-card').first().evaluate(el => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(el).transform)), `${name}: reduced motion respected`);
          await page.mouse.move(0, 0);
        }
```

- Screenshots: change the chromium screenshot routes to `['/', '/books/demo-the-monsoon-ledger', '/search']` with names `home`, `book`, `search`.
- Accessibility routes: `['/', '/search', '/category/science', '/books/demo-the-monsoon-ledger', '/cart', '/wishlist', '/login', '/publish']`.
- Replace `'/catalogue?q=nonexistent-title'` + `'No books found.'` with `'/search?q=nonexistent-title'` + `'No books match these filters'`.
- Delete the FAQ block (`#faq` assertions): the homepage no longer has an FAQ (spec §6 section list).
- Replace the cart flow labels: `'Save to bag: Researching Research for Ayurveda'`, `'In your bag'`; after clicking, the drawer opens: `await expect(page.getByRole('dialog', { name: /Your bag/ })).toBeVisible(); await page.keyboard.press('Escape');` then continue to `/cart` via `page.goto(base + '/cart')`. Replace `'Your next chapter starts here.'` with the new empty-bag heading from Task B7 ("Your bag is empty").
- Long-title fixtures: `fixturePage.goto(base + '/search')`, selector `.grid-books`, title link selector `.card-body h3 a`, image selector `.card-cover img`.
- No-JS check: `await expect(staticPage.locator('.product-card').first()).toBeVisible(); await staticPage.goto(base + '/search?q=monsoon'); await expect(staticPage.getByRole('link', { name: 'The Monsoon Ledger' }).first()).toBeVisible();`
- Add a keyboard check for suggestions (JS context):

```js
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base);
    await page.getByRole('combobox', { name: /Search books/ }).fill('monsoon');
    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/books\/demo-the-monsoon-ledger$/);
    await page.getByRole('button', { name: /Add The Monsoon Ledger to wishlist/ }).click();
    await page.goto(base + '/wishlist');
    await expect(page.getByRole('link', { name: 'The Monsoon Ledger' }).first()).toBeVisible();
```

- [ ] **Step 2: Run the full browser suite**

Run (preview on 3100 in another terminal): `npm run test:browser`
Expected: "All requested browser widths, public routes, image loads, and no-JavaScript catalogue checks passed." across Chromium, Firefox and WebKit. Fix product code, not assertions, unless an assertion contradicts the spec. Then run `ADMIN_TOKEN=$(cat scratch/admin-token.txt) npm run test:admin` against a preview started with that token.

- [ ] **Step 3: Update docs**

- `DESIGN.md`: replace the "Direction", "Design Decisions" and "Shopping Sequence" sections with the direction-A summary from the spec (§5–§6), keeping the "Content And Runtime Boundaries" rules, and add: Energy 4 / Rhythm 3 / Motion 2; fonts Plus Jakarta Sans + Inter; tokens per Task B1; homepage order per Task B4.
- `IMPLEMENTATION.md`: under "Implemented behavior" add lines for categories, offers (`currentPrice`, snapshot `list_price`), wishlist, suggestions, cart drawer, admin sections, demo catalogue (isolated preview only), and under "Isolated checks" add `npm run test:admin` and how to get the admin token.
- `README.md`: a short "Local preview" section: `npm run preview:isolated -- 3100`, the printed admin token, and that sign-in links print to the terminal when Resend is not configured.

- [ ] **Step 4: Final review against the references**

Take full-page screenshots at 1440 and 390 of `/`, `/category/science`, `/search?offer=1`, `/books/demo-the-monsoon-ledger`, `/cart` (with items), `/wishlist`, `/admin` (signed in). Put them next to `scratch/ref-cw-0.jpg`…`ref-cw-3.jpg`, `scratch/reference-crossword-detail.png`, `scratch/reference-bookswagon-detail.png`. Check each spec §6 item is visibly present; list anything missing as a follow-up rather than silently skipping it.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-browser.mjs DESIGN.md IMPLEMENTATION.md README.md
git commit -m "Browser checks and docs for the marketplace storefront"
```

---

## Spec coverage map

| Spec section | Tasks |
|---|---|
| §3 Local access | A1 |
| §3 Admin shell and sections | A7, A8, A9, A6 (banners and homepage sections), A10 |
| §4 Migration 007 | A2 |
| §4 Demo catalogue | A5 |
| §5 Visual system | B1 (tokens, fonts, motion rules), B3 (card) |
| §6 Frame | B2 |
| §6 Homepage | B4 |
| §6 Product card | B3, C2 (heart), C3 (quick view) |
| §6 Category and search pages, `/catalogue` redirect | B5 |
| §6 Product page | B6, C2, C4, C5 |
| §6 Other pages | B7 |
| §7 Search suggestions | C1 |
| §7 Wishlist | C2 |
| §7 Quick view | C3 |
| §7 Cart drawer, Buy now | C4 |
| §7 Recently viewed | C5 |
| §8 Offers | A3 (rule), A8 (admin), B3/B6 (display), C4 (drawer), C6 (checkout, receipts, email, PRD) |
| §9 Testing | every task; browser C7; admin A10 |
| §1 PRD change | C6 |
