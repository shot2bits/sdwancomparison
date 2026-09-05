import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const fixture = JSON.parse(readFileSync('/tmp/netify-published-find_providers.json', 'utf8'));
const { project, snapshot, result } = fixture;
const browser = await chromium.launch();
try {
 const page = await browser.newPage();
 const errors = []; page.on('pageerror', (e) => errors.push(e.message));
 await page.route('**/sase/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('/auth/session')) return route.fulfill({ json: { authenticated: true, role: 'buyer', email: 'owner@buyer.example', work_address: true } });
  if (path === `/sase/api/rfp/${project.id}`) return route.fulfill({ json: { ...project, manage_token: undefined, viewer: 'owner' } });
  if (path.endsWith('/report')) return route.fulfill({ json: { ok: true, frozen: true, market_report: snapshot.market_report, matched_vendors: snapshot.matched_vendors, invited_vendors: snapshot.invited_vendors, matched_vendor_ids: snapshot.matched_vendor_ids, invited_vendor_ids: snapshot.invited_vendor_ids, board_opportunity_id: result.board.opportunity_id } });
  if (path.endsWith('/workspace/market')) return route.fulfill({ json: { vendors: [], counts: { vendors: 0 } } });
  if (path.endsWith('/evaluation')) return route.fulfill({ json: { evaluations: [] } });
  if (path.endsWith('/connect')) return route.fulfill({ json: { connections: [] } });
  return route.fulfill({ json: {} });
 });
 await page.goto(`http://localhost:3107/sase/home/?id=${project.id}`);
 const name = snapshot.matched_vendors[0].name;
 await page.screenshot({ path: '/tmp/netify-published-before.png', fullPage: true });
 try { await page.getByText(name, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 10000 }); } catch (error) { console.log(await page.locator('body').innerText()); console.log(errors); throw error; }
 assert.deepEqual(errors, []);
 assert.equal(await page.getByText('No supplier requirements have been created yet.', { exact: false }).count(), 0);
 assert.equal(await page.getByRole('heading', { name: 'Your project is published' }).count(), 1);
 assert.equal(await page.getByRole('link', { name: 'View project and supplier responses' }).count(), 1);
 await page.screenshot({ path: '/tmp/netify-published-resume.png', fullPage: true });
 console.log('PASS a real short-project publication fixture reopens with frozen matched providers and no browser errors');
} finally { await browser.close(); }
