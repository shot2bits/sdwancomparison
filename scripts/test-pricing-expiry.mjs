import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../preview/context-space/pricing-workspace.js',import.meta.url),'utf8');
const {currentQuotationView}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.parse('2026-11-12T12:00:00Z');
const q={quotation:{scopeHash:'scope',receivedAt:'2026-11-12T10:00:00Z',lines:[{scopeLineId:'one',source:{issuedAt:'2026-11-12T10:00:00Z',validUntil:'2026-11-12T13:00:00Z'}}]},comparison:{notice:'Current',complete:true,totals:{pricedSubtotalMinor:12345},lineLabels:[{id:'one',current:true,label:'firm'}]}};
assert.equal(currentQuotationView(q,'scope',now).comparison.complete,true);
for(const [hash,at] of [[null,now],['changed',now],['scope',now+3600000]]){
const view=currentQuotationView(q,hash,at);assert.equal(view.comparison.complete,false);assert.equal(view.comparison.totals,null);assert.equal(view.comparison.lineLabels[0].label,'awaiting supplier');}
assert.equal(q.comparison.lineLabels[0].label,'firm');
console.log('PASS saved quotation expiry, missing scope and superseded scope fail closed without altering original quotation.');
