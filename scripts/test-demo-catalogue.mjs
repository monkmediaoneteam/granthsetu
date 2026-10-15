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
