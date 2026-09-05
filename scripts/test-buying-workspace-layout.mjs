import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.NETIFY_TEST_BASE_URL ?? 'http://localhost:3107/sase/home/';
const browser = await chromium.launch();
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}?journey=quick_list`);
    const engine = page.getByRole('textbox', { name: 'Describe your requirements', exact: true });
    await engine.waitFor();
    await engine.fill('Keep the engine draft while opening the short brief');
    assert.equal(await page.getByRole('dialog').count(), 0, 'No competing brief form on arrival');
    assert.equal(await page.getByRole('button', { name: 'Build a full RFP', exact: true }).count(), 0, 'No duplicate route cards');
    await page.screenshot({ path: `/tmp/netify-workspace-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /^Publish a short brief/ }).click();
    const panel = page.getByRole('dialog');
    await panel.waitFor();
    const box = await panel.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900);
    await page.getByLabel('Company name (private)').fill('Saved brief company');
    await panel.evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: `/tmp/netify-brief-panel-${width}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await engine.inputValue(), 'Keep the engine draft while opening the short brief');
    await page.getByRole('button', { name: /^Publish a short brief/ }).click();
    assert.equal(await page.getByLabel('Company name (private)').inputValue(), 'Saved brief company');
    await page.getByRole('button', { name: 'Close project brief', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${width}px: single engine layout, contained brief panel, Escape/close, preserved drafts, no overflow/errors`);
  }
} finally { await browser.close(); }
