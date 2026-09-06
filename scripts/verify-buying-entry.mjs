import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = process.env.TEST_ORIGIN || 'http://localhost:3122';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const p = await browser.newPage({viewport: {width, height: 1000}});
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(root + '/sase/home/');
    const routes = p.getByRole('navigation', {name: 'Start your buying journey'});
    await routes.getByRole('button', {name: 'Find suitable providers', exact: true}).click();
    await p.getByRole('heading', {name: 'Compare SASE & SD-WAN providers', exact: true}).waitFor();
    if (width < 600) await p.getByRole('button', {name: 'Toggle workspace navigation'}).click();
    await p.getByRole('navigation', {name: 'Buying workspace', exact: true}).getByRole('button', {name: 'Project', exact: true}).click();
    assert.equal(await routes.getByRole('link', {name: 'Request pricing', exact: true}).getAttribute('href'), '/sase/pricing/');
    const chooser = p.waitForEvent('filechooser');
    await routes.getByRole('button', {name: 'Bring an RFP or RFI', exact: true}).click();
    await chooser;
    assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)));
    assert.deepEqual(errors, []);
    await p.screenshot({path: `/tmp/netify-monday-entry-${width}.png`, fullPage: false});
    console.log(`PASS ${width}: comparison, pricing destination, existing import chooser, no overflow/page errors`);
    await p.close();
  }
} finally { await browser.close(); }
