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
  await page.getByLabel('Admin email').fill(process.env.ADMIN_EMAIL || 'admin@preview.test');
  await page.getByLabel('Admin password').fill(token);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base}/admin`);
  for (const [link, heading] of [['Orders', 'Orders'], ['Books', 'Books'], ['Categories', 'Categories'], ['Authors', 'Authors'],
    ['Collections', 'Collections'], ['Banners', 'Banners'], ['Homepage sections', 'Homepage sections'], ['Submissions', 'Submissions'], ['Delivery recovery', 'Delivery recovery']]) {
    await page.getByRole('navigation').getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  // Create a draft product: it opens straight in its editor.
  await page.goto(`${base}/admin/books`);
  await page.getByText('Add book').click();
  // The web address fills itself in from the name.
  const stamp = Date.now();
  const draftName = `Admin Check & Title ${stamp}`;
  const draft = `admin-check-and-title-${stamp}`;
  await page.getByLabel('Name').first().fill(draftName);
  await expect(page.getByLabel('Web address')).toHaveValue(draft);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/books/${draft}\\?saved=1`));
  await expect(page.getByRole('heading', { level: 1, name: draftName })).toBeVisible();

  // Every detail saved in admin must show on the storefront product page.
  const slug = 'demo-the-monsoon-ledger';
  const store = `${base}/books/${slug}`;
  const editor = `${base}/admin/books/${slug}`;
  await page.goto(`${base}/admin/books`);
  await page.getByLabel('Search books').fill(slug);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator(`a[href="/admin/books/${slug}"][aria-label^="Edit"]`).click();
  await expect(page).toHaveURL(editor);
  const details = page.locator('form', { has: page.locator('input[name="action"][value="save"]') });
  await details.getByLabel('Title', { exact: true }).fill('The Monsoon Ledger, Revised');
  await details.getByLabel('Subtitle').fill('Sync check: a new subtitle');
  await details.getByLabel('Regular price (₹)').fill('777');
  await details.getByLabel('Short description').fill('Sync check: short description from admin.');
  await details.getByLabel('About the book').fill('Sync check: long description from admin.');
  await details.getByLabel(/^Contents and highlights/).fill('Sync feature one\nSync feature two');
  await details.getByLabel(/^Details/).fill('Narrator: Sync check');
  await details.getByRole('button', { name: 'Save details' }).click();
  await expect(page).toHaveURL(`${editor}?saved=1`);
  await expect(page.getByText('Saved. The storefront now shows these changes.')).toBeVisible();
  await page.goto(store);
  await expect(page.getByRole('heading', { level: 1, name: 'The Monsoon Ledger, Revised' })).toBeVisible();
  const html = await page.content();
  for (const text of ['Sync check: a new subtitle', '777', 'Sync check: short description from admin.', 'Sync check: long description from admin.',
    'Sync feature one', 'Sync feature two', 'Narrator', 'Sync check']) assert.ok(html.includes(text), `store page shows "${text}"`);

  // A rejected save stays on the product and says so, instead of silently going elsewhere.
  await page.goto(editor, { waitUntil: 'networkidle' });
  await details.getByLabel(/^Details/).clear();
  await details.getByLabel(/^Details/).fill('no colon here');
  await details.getByRole('button', { name: 'Save details' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/books/${slug}\\?error=`));
  await expect(page.getByText('Not saved.')).toBeVisible();

  // Removing from the store hides the page; restoring brings it back.
  await page.goto(editor, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Remove from store' }).click();
  await expect(page).toHaveURL(`${editor}?saved=1`);
  expect((await page.request.get(store)).status()).toBe(404);
  await page.getByRole('button', { name: 'Restore to store' }).click();
  await expect(page).toHaveURL(`${editor}?saved=1`);
  expect((await page.request.get(store)).status()).toBe(200);

  // Bulk: select two rows, remove them from the store, then show them again.
  await page.goto(`${base}/admin/books?q=ledger`);
  const boxes = page.locator('tbody input[type="checkbox"]:not([disabled])');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Remove from store' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove from store' }).click();
  await expect(page.getByText(/Removed 2 books from the store/)).toBeVisible();
  expect((await page.request.get(store)).status()).toBe(404);
  await page.getByLabel('Select all books on this page').check();
  await page.getByRole('button', { name: 'Show in store' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Show in store' }).click();
  await expect(page.getByText(/Restored \d+ books? to the store/)).toBeVisible();
  expect((await page.request.get(store)).status()).toBe(200);
  // Schedule a banner that ended yesterday; it must not appear.
  await page.goto(`${base}/admin/platform/modules?type=banner`);
  await page.getByText('New module').click();
  await page.getByLabel('Title').first().fill('Expired banner check');
  await page.getByLabel('Status').first().selectOption('published');
  await page.getByLabel('Ends at (with timezone)').first().fill(new Date(Date.now() - 86400000).toISOString());
  await page.getByRole('button', { name: 'Save' }).first().click();
  await page.goto(base);
  await expect(page.getByText('Expired banner check')).toHaveCount(0);
  // A scheduled banner keeps its start and end when reopened and saved again.
  await page.goto(`${base}/admin/banners`, { waitUntil: 'networkidle' });
  await page.locator('summary', { hasText: 'New banner' }).click();
  const fresh = page.locator('form', { has: page.getByRole('button', { name: 'Add banner' }) });
  await fresh.getByLabel('Headline').fill('Schedule check');
  await fresh.getByLabel('Starts (India time, optional)').fill('2030-01-05T09:30');
  await fresh.getByLabel('Ends (India time, optional)').fill('2030-01-20T18:00');
  await fresh.getByRole('button', { name: 'Add banner' }).click();
  await expect(page.getByText('Saved. The homepage is updated.')).toBeVisible();
  const row = page.locator('li', { hasText: 'Schedule check' });
  await row.getByText('Edit').click();
  await expect(row.getByLabel('Starts (India time, optional)')).toHaveValue('2030-01-05T09:30');
  await expect(row.getByLabel('Ends (India time, optional)')).toHaveValue('2030-01-20T18:00');
  await row.getByRole('button', { name: 'Save banner' }).click();
  await page.locator('li', { hasText: 'Schedule check' }).getByText('Edit').click();
  await expect(page.locator('li', { hasText: 'Schedule check' }).getByLabel('Starts (India time, optional)')).toHaveValue('2030-01-05T09:30');

  // New category: the web address follows the name; adding one with a taken address is refused, not overwritten.
  await page.goto(`${base}/admin/categories`, { waitUntil: 'networkidle' });
  const add = page.locator('form', { has: page.getByRole('button', { name: 'Add category' }) });
  await add.getByLabel('Name').fill('Payroll & HR');
  await expect(add.getByLabel('Web address')).toHaveValue('payroll-and-hr');
  await add.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.locator('form', { has: page.getByRole('button', { name: 'Add category' }) }).getByLabel('Name').fill('Payroll & HR');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText(/already exists/)).toBeVisible();

  assert.deepEqual(errors, []);
} finally { await browser.close(); }
console.log('Admin browser check passed: sign-in, every section, draft product, details reflected in store, save errors shown, visibility and bulk actions reflected in store, expired banner hidden, banner schedule kept, category address made from the name.');
