import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:3107/sase/home/');
 const formats=page.getByRole('region',{name:'Choose your project format'});await formats.waitFor();
 assert.equal(await formats.getByRole('button').count(),4);
 assert(await page.getByRole('region',{name:'Opportunity Board notice preview'}).isVisible());
 await page.getByRole('button',{name:'Review & publish →',exact:true}).first().click();await page.getByRole('heading',{name:'Publish a short project brief'}).waitFor();await page.getByRole('button',{name:'Close project brief'}).click();
 await formats.getByRole('button',{name:/Detailed RFP Full/}).click();await page.locator('.nf-guided-register > summary').click();
 await page.getByRole('button',{name:'＋ Add bespoke question',exact:true}).waitFor();assert(await page.getByLabel('Question for suppliers',{exact:true}).count());
 await formats.getByRole('button',{name:/Short RFP Core/}).click();assert.equal(await formats.getByRole('button',{name:/Short RFP Core/}).getAttribute('aria-pressed'),'true');
 await formats.getByRole('button',{name:/Bring an RFP or RFI Keep/}).click();await page.getByLabel('Your document type').selectOption('rfi');
 assert.equal(await page.getByLabel('Your document type').inputValue(),'rfi');
 await page.getByRole('button',{name:'Supplier pack',exact:true}).click();await page.locator('.nf-guided-document').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 if(width<760)await page.getByRole('button',{name:'Toggle workspace navigation'}).click();
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('heading',{name:'All tools',exact:true}).waitFor();assert(await page.getByRole('link',{name:/Provider directory/}).isVisible());
 if(width<760)await page.getByRole('button',{name:'Toggle workspace navigation'}).click();
 await page.getByRole('button',{name:'Project',exact:true}).click();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`overflow at ${width}`);assert.equal(errors.length,0,errors.join('\n'));
 await page.screenshot({path:`/tmp/netify-layout-verified-${width}.png`,fullPage:false});await page.close();console.log(`PASS ${width}px: four routes, initial review, full/short questions, RFI, supplier pack, sidebar tools, no overflow/runtime errors`);
}}finally{await browser.close();}
