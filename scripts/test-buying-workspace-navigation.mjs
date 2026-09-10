import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.NETIFY_TEST_BASE_URL||'http://localhost:3107/sase/home/');
 const editor=page.getByRole('textbox',{name:'Describe your requirements',exact:true});await editor.waitFor();
 await editor.fill('Keep these requirements when switching depth');
 const nav=page.getByRole('navigation',{name:'Build and buy'});
 await nav.getByRole('button',{name:'Detailed RFP',exact:true}).click();
 await page.waitForFunction(()=>localStorage.getItem('netify-rfp-depth')==='detailed');
 assert.equal(await editor.inputValue(),'Keep these requirements when switching depth');
 await nav.getByRole('button',{name:'Short RFP',exact:true}).click();
 await page.waitForFunction(()=>localStorage.getItem('netify-rfp-depth')==='short');
 assert.equal(await editor.inputValue(),'Keep these requirements when switching depth');
 const chooser=page.waitForEvent('filechooser');await nav.getByRole('button',{name:'Bring an RFP or RFI'}).click();await chooser;
 await page.getByRole('button',{name:'Collapse workspace menu'}).click();
 assert.equal(await page.locator('.nf-buying-shell').getAttribute('data-collapsed'),'true');
 await page.getByRole('button',{name:'Expand workspace menu'}).click();
 await page.getByRole('navigation',{name:'Buying workspace',exact:true}).getByRole('button',{name:'Compare',exact:true}).click();
 await page.getByRole('heading',{name:'Compare SASE & SD-WAN providers'}).waitFor();
 await page.getByRole('navigation',{name:'Buying workspace',exact:true}).getByRole('button',{name:'Project',exact:true}).click();
 assert.equal(await editor.inputValue(),'Keep these requirements when switching depth');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: both RFP depths, retained input, import chooser, collapse and comparison navigation');
}finally{await browser.close()}
