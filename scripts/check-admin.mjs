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
  // Banners are images only, placed in admin-configured sections from Admin > Banners.
  const saved = () => expect(page.getByText('Saved. The site is updated.')).toBeVisible();
  const newBanner = async (key) => {
    await page.goto(`${base}/admin/banners?new=${key}#new-banner`, { waitUntil: 'networkidle' });
    return page.locator('form', { has: page.getByRole('button', { name: 'Add banner' }) });
  };
  const sectionCard = (key) => page.locator(`section[aria-labelledby="s-${key}"]`);
  // A banner without an image is refused with a clear message.
  let form = await newBanner('hero');
  await form.getByLabel('Name').fill('No image check');
  await form.getByRole('button', { name: 'Add banner' }).click();
  await expect(page.getByText(/Add an image for this banner/)).toBeVisible();
  // Hero: a live banner from a preset image, linked.
  form = await newBanner('hero');
  await expect(form.getByLabel('Section')).toHaveValue('hero');
  await form.getByLabel('Name').fill('Hero check');
  await form.getByRole('button', { name: 'Botanical (desktop)' }).first().click();
  await form.getByLabel('Link when clicked (optional)').fill('/search');
  await form.getByRole('button', { name: 'Add banner' }).click();
  await saved();
  // Side column.
  form = await newBanner('side');
  await expect(form.getByLabel('Section')).toHaveValue('side');
  await form.getByLabel('Name').fill('Side check');
  await form.getByRole('button', { name: 'Special offer (desktop)' }).first().click();
  await form.getByRole('button', { name: 'Add banner' }).click();
  await saved();
  // Wide band that already ended: the homepage leaves it out.
  form = await newBanner('band');
  await form.getByLabel('Name').fill('Ended band check');
  await form.locator('summary', { hasText: 'or paste an address' }).first().click();
  await form.getByLabel('Banner image (required) address').fill('/assets/banners/side-deal-desktop.svg');
  await form.getByLabel('Starts (India time, optional)').fill('2020-01-01T09:00');
  await form.getByLabel('Ends (India time, optional)').fill('2020-01-02T09:00');
  await form.getByRole('button', { name: 'Add banner' }).click();
  await saved();
  await page.goto(base, { waitUntil: 'networkidle' });
  const hero = page.locator('.home-main .banner-section');
  await expect(hero.locator('img[alt="Hero check"]')).toHaveCount(1);
  await expect(hero.locator('h1')).toHaveCount(0);
  await expect(hero.locator('a[href="/search"]')).toHaveCount(1);
  await expect(page.locator('.home-side img[alt="Side check"]')).toHaveAttribute('src', '/assets/banners/side-deal-desktop.svg');
  await expect(page.locator('img[alt="Ended band check"]')).toHaveCount(0);

  // Sections: the admin sets layout, count and size, and adds new sections.
  await page.goto(`${base}/admin/banners/sections`, { waitUntil: 'networkidle' });
  await sectionCard('hero').getByText('Edit settings').click();
  await sectionCard('hero').locator('input[name="width"]').fill('1200');
  await sectionCard('hero').locator('input[name="height"]').fill('600');
  await sectionCard('hero').locator('select[name="layout"]').selectOption('single');
  await sectionCard('hero').getByRole('button', { name: 'Save section' }).click();
  await saved();
  await expect(sectionCard('hero').getByText('Built-in, customised')).toBeVisible();
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('.home-main .banner-section.layout-single')).toHaveAttribute('style', /--ratio:\s*1200 \/ 600/);
  await page.goto(`${base}/admin/banners/sections`, { waitUntil: 'networkidle' });
  await page.locator('summary', { hasText: 'New section' }).click();
  const addSection = page.locator('form', { has: page.getByRole('button', { name: 'Add section' }) });
  await addSection.locator('input[name="title"]').fill('Festival row');
  await addSection.locator('input[name="key"]').fill('festival-row');
  await addSection.locator('select[name="position"]').selectOption('home-after-books');
  await addSection.locator('select[name="layout"]').selectOption('grid');
  await addSection.getByRole('button', { name: 'Add section' }).click();
  await saved();
  form = await newBanner('festival-row');
  await expect(form.getByLabel('Section')).toHaveValue('festival-row');
  await form.getByLabel('Name').fill('Festival check');
  await form.getByRole('button', { name: 'Special offer (desktop)' }).first().click();
  await form.getByRole('button', { name: 'Add banner' }).click();
  await saved();
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('.banner-section.layout-grid img[alt="Festival check"]')).toHaveCount(1);
  // Reset the hero back to its defaults.
  await page.goto(`${base}/admin/banners/sections`, { waitUntil: 'networkidle' });
  page.once('dialog', (d) => d.accept());
  await sectionCard('hero').getByText('Edit settings').click();
  await sectionCard('hero').getByRole('button', { name: 'Reset to default' }).click();
  await saved();
  await expect(sectionCard('hero').getByText(/1600 × 700 px/)).toBeVisible();

  // A scheduled banner keeps its start and end when reopened and saved again.
  form = await newBanner('hero');
  await form.getByLabel('Name').fill('Schedule check');
  await form.getByRole('button', { name: 'Botanical (mobile)' }).first().click();
  await form.getByLabel('Starts (India time, optional)').fill('2030-01-05T09:30');
  await form.getByLabel('Ends (India time, optional)').fill('2030-01-20T18:00');
  await form.getByRole('button', { name: 'Add banner' }).click();
  await saved();
  const row = page.locator('li', { hasText: 'Schedule check' });
  await expect(row.getByText('Scheduled')).toBeVisible();
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
console.log('Admin browser check passed: sign-in, every section, draft product, details reflected in store, save errors shown, visibility and bulk actions reflected in store, image-only banners per section, section size/layout/new section/reset, image required, ended band hidden, banner schedule kept, category address made from the name.');
