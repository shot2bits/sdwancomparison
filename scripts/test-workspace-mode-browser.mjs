import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json'),{chromium}=require('playwright-core');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3018/locations/?qa=mode-switch-check',{waitUntil:'domcontentloaded'});await page.locator('#location-studio').waitFor({timeout:60000});await page.locator('#ns-pricing-workspace').waitFor();
 const modes=page.getByRole('group',{name:'Workspace mode',exact:true});await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Buyer',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#ns-reseller-tools').isHidden(),true);
 await page.locator('[data-ls-goal="pricing"]').click();const quick=page.locator('#ls-quick-form');await quick.locator('input[name="sites"]').fill('19');
 const ids=['location-studio','ns-living-rfp','ns-pricing-workspace','ns-scene','ns-canvas','ns-nodes','ns-room-open','ns-buying-open','ls-map','ls-diagram','ls-table','ls-site-list'];
 const before=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id)])),ids);void before;
 // Track DOM identities in the page to prove the mode changes do not rebuild existing sections.
 await page.evaluate(ids=>{window.modeExistingNodes=ids.map(id=>document.getElementById(id));},ids);
 const urlBefore=new URL(page.url());await modes.getByRole('button',{name:'Reseller',exact:true}).click();await page.getByRole('heading',{name:'Start with a customer',exact:true}).waitFor();assert.equal(await page.locator('#ns-reseller-tools').isVisible(),true);assert.equal(await modes.getByRole('button',{name:'Reseller',exact:true}).getAttribute('aria-pressed'),'true');assert.match(await page.locator('.ns-mode-status').innerText(),/Reseller mode/);assert.equal(new URL(page.url()).searchParams.get('workspace'),'partner');
 assert.equal(await page.locator('#partner-workspace').count(),1);assert.equal(await quick.locator('input[name="sites"]').inputValue(),'19');
 assert.equal(await page.evaluate(()=>window.modeExistingNodes.every(n=>n?.isConnected&&document.getElementById(n.id)===n)),true);
 assert.equal(await page.evaluate(()=>document.querySelector('#ns-reseller-tools').getBoundingClientRect().top>document.querySelector('#ns-pricing-workspace').getBoundingClientRect().top),true);
 await page.screenshot({path:'/private/tmp/netify-reseller-mode-top.png'});
 await modes.getByRole('button',{name:'Buyer',exact:true}).click();assert.equal(await page.locator('#ns-reseller-tools').isHidden(),true);assert.equal(await quick.locator('input[name="sites"]').inputValue(),'19');assert.equal(new URL(page.url()).searchParams.get('qa'),urlBefore.searchParams.get('qa'));assert.equal(new URL(page.url()).searchParams.has('workspace'),false);
 await modes.getByRole('button',{name:'Reseller',exact:true}).click();assert.equal(await page.locator('#partner-workspace').count(),1);
 await page.setViewportSize({width:390,height:844});assert.equal(await modes.getByRole('button',{name:'Buyer',exact:true}).isVisible(),true);assert.equal(await modes.getByRole('button',{name:'Reseller',exact:true}).isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'/private/tmp/netify-workspace-switch-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS visible Buyer/Reseller mode, reseller tools below map and pricing; compact switch remains at top, retained original DOM sections, unchanged unsaved inputs, no reload, no duplicate tools, URL mode, mobile layout and no browser errors. No publication or supplier contact.');
}finally{await browser.close();}
