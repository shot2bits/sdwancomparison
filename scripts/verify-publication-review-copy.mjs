import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = process.env.TEST_ORIGIN || 'http://localhost:3107';
const browser = await chromium.launch();
try {
 const p = await browser.newPage();
 let saves = 0;
 await p.route('**/sase/api/marketplace/projects', route => {
  assert.equal(route.request().method(), 'POST'); saves++;
  return route.fulfill({json: {project_reference:'review-test', project_session_token:'local-test-only', revision:1}});
 });
 await p.route('**/sase/api/marketplace/projects/**', route => { throw new Error('Review must not publish or prepare the test project'); });
 await p.goto(root + '/sase/home/?intent=pricing');
 const d=p.getByRole('dialog'); await d.waitFor();
 await d.getByLabel('Sector',{exact:true}).selectOption('retail_ecommerce');
 await d.getByLabel('Number of sites').fill('5');
 await d.getByLabel('Buying timescale').fill('Within six months');
 await d.getByLabel('Company name (private)').fill('Review Test Ltd');
 await d.getByLabel('What do you need to achieve?',{exact:true}).fill('Connect five retail stores with resilient managed SASE and broadband backup.');
 await d.getByRole('button',{name:'Review my project',exact:true}).click();
 await d.getByRole('heading',{name:'What happens after publication?'}).waitFor();
 assert.equal(saves,1);
 assert(await d.getByText(/Responses, prices and response times are not guaranteed/).isVisible());
 assert(await d.getByRole('button',{name:'Verify work email to publish',exact:true}).isDisabled());
 await d.getByRole('button',{name:'Edit project details'}).click();
 assert.equal(await d.getByLabel('Number of sites').inputValue(),'5');
 assert.equal(await d.getByLabel('Company name (private)').inputValue(),'Review Test Ltd');
 console.log('PASS reviewed privacy/next steps, consent gate, editing retains values; draft API intercepted, no publication or email');
} finally {await browser.close();}
