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
