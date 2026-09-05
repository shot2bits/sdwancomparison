import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    let draft, revision = 0, authenticated = false, publishCalls = 0, failPublish = true;
    await page.route('**/sase/api/auth/session', (r) => r.fulfill({ json: { authenticated, role: 'buyer' } }));
    await page.route('**/sase/api/marketplace/projects**', async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const body = req.method() === 'GET' ? null : req.postDataJSON();
      if (path.endsWith('/prepare-publication')) { revision++; return route.fulfill({ json: { revision } }); }
      if (path.endsWith('/publish')) { publishCalls++; return route.fulfill({ status: failPublish ? 409 : 200, json: failPublish ? { error: 'Board unavailable. Your draft is saved.' } : { ok: true, opportunity_id: 'opp-test', market_unlocked: true } }); }
      if (path.endsWith('/match-preview')) { revision++; return route.fulfill({ json: { revision, preview: { meets_all_mandatory_count: 8 } } }); }
      if (req.method() === 'GET') return route.fulfill({ json: { project_reference: 'rfp-test', revision, buyer: draft.entrance_context.buyer_input, entrance_context: draft.entrance_context, mode: draft.mode, prepared: false } });
      if (req.method() === 'PATCH') { draft.entrance_context.buyer_input = body.buyer_patch; revision++; return route.fulfill({ json: { project_reference: 'rfp-test', revision } }); }
      draft = body;
      return route.fulfill({ json: { project_reference: 'rfp-test', revision, project_session_token: 'private-test-token' } });
    });
    await page.goto('http://localhost:3107/sase/home/');
    await page.getByLabel('Company name (private)').fill('Example Ltd');
    await page.getByRole('combobox', { name: /^Sector/ }).selectOption('manufacturing');
    await page.getByLabel('Number of sites').fill('20');
    await page.getByLabel('Buying timescale').fill('Six months');
    await page.getByLabel('What do you need to achieve?').fill('Connect twenty factories with a resilient managed network.');
    await page.getByRole('button', { name: /^Find providers for my project/ }).click();
    await page.getByRole('button', { name: 'Review my project' }).click();
    await page.getByRole('heading', { name: 'Review your anonymous project notice' }).waitFor();
    assert.equal(draft.mode, 'find_providers');
    assert.equal(publishCalls, 0);
    await page.reload();
    await page.getByRole('heading', { name: 'Review your anonymous project notice' }).waitFor();
    assert.equal(await page.getByText('Connect twenty factories with a resilient managed network.', { exact: true }).count(), 1);
    authenticated = true; await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Publish my project and unlock providers' }).click();
    await page.getByRole('alert').filter({ hasText: 'Board unavailable' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Your project is published', exact: true }).count(), 0);
    failPublish = false;
    await page.getByRole('button', { name: 'Publish my project and unlock providers' }).click();
    await page.getByRole('link', { name: 'Open my matches and responses' }).waitFor();
    assert.equal(publishCalls, 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `/tmp/netify-project-${width}.png`, fullPage: true });
    await page.close();
    console.log(`PASS ${width}px: short project, provider route publication, reload, failure/retry, no overflow or browser errors`);
  }
} finally { await browser.close(); }
