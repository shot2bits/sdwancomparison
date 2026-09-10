import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
 for (const failStorage of [false, true]) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  if (failStorage) await page.addInitScript(() => {
   const original = Storage.prototype.setItem;
   Storage.prototype.setItem = function(key, value) {
    if (key.startsWith('netify_living_rfp_')) throw new DOMException('Storage full', 'QuotaExceededError');
    return original.call(this, key, value);
   };
  });
  await page.goto('http://localhost:3107/sase/home/');
  await page.getByRole('radio', { name: 'Manufacturing', exact: true }).click();
  const status = page.locator('.nf-calm-save-status');
  await page.waitForFunction((failed) => document.querySelector('.nf-calm-save-status')?.textContent.includes(failed ? 'Draft not saved' : 'Draft saved'), failStorage);
  assert.equal(await status.isVisible(), true);
  assert.equal(await status.getAttribute('data-error'), String(failStorage));
  console.log(`PASS draft status: ${failStorage ? 'storage failure visible' : 'successful save visible'}`);
  await page.close();
 }
} finally { await browser.close(); }
