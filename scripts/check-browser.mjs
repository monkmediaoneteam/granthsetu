import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.PREVIEW_URL || 'http://localhost:3100';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Browser tests must target the isolated local preview.');
const output = new URL('../scratch/visual-checks/', import.meta.url);
await mkdir(output, { recursive: true });
const sizes = [320, 390, 768, 1024, 1440, 1920];
const routes = ['/', '/catalogue', '/books/researching-research-for-ayurveda', '/books/integrative-perspectives', '/cart', '/checkout?book=researching-research-for-ayurveda', '/publish', '/login', '/privacy', '/order/unknown'];
const failures = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  if (process.env.BROWSERS && !process.env.BROWSERS.split(',').includes(name)) continue;
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(`${name}: ${String(error)} ${error?.stack || ''}`));
    for (const width of sizes) {
      await page.setViewportSize({ width, height: width < 768 ? 800 : 1000 });
      for (const route of routes) {
        const response = await page.goto(base + route, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200, `${name} ${width} ${route}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        if (overflow) failures.push(`${name}: overflow ${width} ${route}`);
        for (const image of await page.locator('main img').all()) {
          await image.scrollIntoViewIfNeeded();
          await expect.poll(() => image.evaluate(image => image.complete && image.naturalWidth > 0), { timeout: 15000 }).toBeTruthy();
        }
        await page.evaluate(() => scrollTo(0, 0));
        const images = await page.locator('main img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src));
        if (images.length) failures.push(`${name}: missing images ${width} ${route}: ${images}`);
        if (route === '/') {
          const cover = await page.locator('.hero-books img').first().boundingBox();
          if (!cover || cover.y >= (width < 768 ? 800 : 1000)) failures.push(`${name}: no first-viewport book at ${width}`);
          await page.evaluate(() => document.fonts.ready);
          assert.ok(await page.evaluate(() => document.fonts.check('600 32px "Fraunces Variable"') && document.fonts.check('400 16px "Manrope Variable"')), `${name}: local fonts loaded`);
          const labelsFit = await page.locator('.subject-navigation > a > span:not(.subject-icon)').evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth + 1));
          assert.ok(labelsFit, `${name}: category labels fit at ${width}px`);
          await page.locator('.hero-volume').first().hover();
          await page.waitForTimeout(350);
          assert.ok(await page.locator('.hero-volume').first().evaluate(el => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(el).transform)), `${name}: reduced motion respected`);
          await page.mouse.move(0, 0);
        }
        if (name === 'chromium' && ['/', '/books/integrative-perspectives'].includes(route)) {
          await page.screenshot({ path: fileURLToPath(new URL(`${route === '/' ? 'home' : 'book'}-${width}.png`, output)), fullPage: true });
        }
      }
      console.log(`${name}: ${width}px routes checked`);
    }
    for (const route of ['/', '/catalogue', '/books/integrative-perspectives', '/login', '/publish']) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      for (const violation of result.violations) failures.push(`${name}: accessibility ${route}: ${violation.id}: ${violation.nodes.map(node => node.target).join(',')}`);
    }
    await page.goto(base + '/catalogue?q=nonexistent-title');
    await expect(page.getByRole('heading', { name: 'No books found.' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/books/researching-research-for-ayurveda');
    await expect(page.getByText('Online ordering is currently unavailable.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /^Save to cart:/ }).click();
    await page.getByRole('link', { name: 'In your cart' }).click();
    await expect(page.getByRole('heading', { name: 'Researching Research for Ayurveda', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Checkout unavailable' })).toBeDisabled();
    await expect(page.getByText('Online ordering is currently unavailable.', { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Researching Research for Ayurveda', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Remove Researching/ }).click();
    await expect(page.getByRole('heading', { name: 'Your next chapter starts here.' })).toBeVisible();
    await page.goto(base + '/checkout?book=researching-research-for-ayurveda');
    await expect(page.getByText('Online ordering is currently unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payment unavailable' })).toBeDisabled();
    await expect(page.getByLabel('Full name')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Continue browsing' })).toBeVisible();
    for (const viewport of [{ width: 844, height: 390 }, { width: 640, height: 480 }]) {
      await page.setViewportSize(viewport);
      await page.goto(base);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${name}: landscape overflow`);
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(base);
    await page.addStyleTag({ content: 'body { zoom: 2; }' });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${name}: 200% zoom overflow`);
    await page.goto(base);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('#faq details')).toHaveCount(6);
    await expect(page.locator('#faq summary').filter({ hasText: 'How do I choose a book?' })).toBeVisible();
    await expect(page.locator('#faq')).not.toContainText('Purchases are currently paused');
    const question = page.locator('#faq summary').first();
    await question.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#faq details').first()).toHaveAttribute('open', '');
    const fixtureContext = await browser.newContext({ javaScriptEnabled: false });
    const fixturePage = await fixtureContext.newPage();
    for (const width of [320, 768, 1440]) {
      await fixturePage.setViewportSize({ width, height: 800 });
      for (const count of [1, 2, 9]) {
        await fixturePage.goto(base + '/catalogue');
        await fixturePage.locator('.book-grid').evaluate((grid, count) => {
          const card = grid.firstElementChild.cloneNode(true);
          grid.replaceChildren();
          for (let index = 0; index < count; index++) {
            const item = card.cloneNode(true);
            item.querySelector('h3 a').textContent = index % 2 ? 'An unusually long publication title about research methodology, practice, and natural products' : 'PublicationWithAnUnusuallyLongUnbrokenTitleToCheckResponsiveWrapping';
            if (index === 2) item.querySelector('.book-art img')?.remove();
            grid.append(item);
          }
        }, count);
        if (await fixturePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${name}: ${count}-book long-title fixture overflow at ${width}`);
      }
    }
    await fixtureContext.close();
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    await staticPage.goto(base);
    await expect(staticPage.locator('#catalogue').getByRole('heading', { name: 'Researching Research for Ayurveda', exact: true })).toBeVisible();
    await expect(staticPage.locator('.hero-books img').first()).toBeVisible();
    await noJs.close();
    await context.close();
  } finally { await browser.close(); }
}
console.log(failures.join('\n'));
assert.equal(failures.length, 0, 'Visual, accessibility, or browser errors found.');
console.log('All requested browser widths, public routes, image loads, and no-JavaScript catalogue checks passed.');
