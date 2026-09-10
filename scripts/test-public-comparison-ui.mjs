import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
 for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:3107/sase/shortlist/?compare=bt-business,vodafone-business,fortinet');
  await page.locator('#comparison-table th').filter({ hasText: 'Fortinet' }).waitFor();
  assert.equal(await page.locator('#comparison-table thead th').count(), 4);
  await page.getByLabel('Provider 3', { exact: true }).selectOption('');
  assert.equal(await page.locator('#comparison-table thead th').count(), 3);
  await page.getByLabel('Your requirement (optional)').fill('We need resilient connectivity for twenty factories.');
  await page.getByLabel('Ask about the comparison').fill('How do their security capabilities differ?');
  await page.getByRole('button', { name: 'Find providers for my project', exact: true }).first().click();
  await page.getByLabel('What do you need to achieve?').waitFor();
  assert.equal(await page.getByLabel('What do you need to achieve?').inputValue(), 'We need resilient connectivity for twenty factories.');
  const context = await page.evaluate(() => JSON.parse(sessionStorage.getItem('netify_comparison_project_draft_v1')));
  assert.deepEqual(context.raw_input.compared_vendor_slugs, ['bt-business', 'vodafone-business']);
  assert.deepEqual(context.vendor_slugs, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  assert.deepEqual(errors, []);
  await page.close();
  console.log(`PASS ${width}px public 2/3-provider comparison, exact requirement handoff, no automatic invitations`);
 }
} finally { await browser.close(); }
