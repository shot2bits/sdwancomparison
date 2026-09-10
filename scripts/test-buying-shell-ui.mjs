import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.NETIFY_TEST_BASE_URL || 'http://localhost:3107/sase/home/';
const browser = await chromium.launch();
try {
 for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}?journey=quick_list`);
  const input = page.getByRole('textbox', { name: 'Describe your requirements', exact: true });
  await input.waitFor();
  await input.fill('Unsaved words must survive navigation');
  async function nav(name) {
   if (width < 850 && !await page.getByRole('navigation', { name: 'Buying workspace', exact: true }).isVisible()) await page.getByRole('button', { name: 'Toggle workspace navigation' }).click();
   await page.getByRole('navigation', { name: 'Buying workspace', exact: true }).getByRole('button', { name, exact: true }).click();
  }
  console.log(width, 'comparison');
  await nav('Compare');
  await page.getByLabel('Provider 1', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Compare SASE & SD-WAN providers', exact: true }).isVisible(), true);
  await page.screenshot({ path: `/tmp/netify-calm-compare-${width}.png` });
  console.log(width, 'project');
  await nav('Project');
  assert.equal(await input.inputValue(), 'Unsaved words must survive navigation');
  await page.getByRole('button', { name: 'Requirements & RFP', exact: true }).click();
  const register = page.locator('details.nf-guided-register');
  await register.locator(':scope > summary').click();
  assert.equal(await register.getByRole('button', { name: '＋ Add bespoke question', exact: true }).isVisible(), true);
  await register.getByRole('button', { name: '＋ Add bespoke question', exact: true }).click();
  await page.getByLabel('Question for suppliers', { exact: true }).fill('Describe implementation governance.');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  console.log(width, 'pack');
  assert.ok((await page.locator('.nf-calm-overview .lpos-captured').textContent()).includes('Describe implementation governance'), 'Bespoke question is saved in real engine state');
  await page.getByRole('button', { name: 'Supplier pack', exact: true }).click();
  assert.equal(await page.getByRole('complementary', { name: 'Your living RFP preview' }).isVisible(), true);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  assert.equal(await input.inputValue(), 'Unsaved words must survive navigation');
  console.log(width, 'sector');
  await input.fill('');
  await page.getByRole('radio', { name: 'Manufacturing', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.nf-calm-overview .lpos-captured')?.textContent.includes('Manufacturing'));
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('dialog', { name: 'RFP preferences' }).waitFor();
  await page.getByRole('button', { name: 'Close RFP preferences' }).click();
  await page.screenshot({ path: `/tmp/netify-calm-project-${width}.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'No horizontal overflow');
  assert.deepEqual(errors, []);
  await page.close();
  console.log(`PASS ${width}px shell: research, draft preservation, bespoke questions, supplier pack, sector input and preferences`);
 }
} finally { await browser.close(); }
