import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createPricingWorkspace} from '../preview/context-space/pricing-workspace.js';
const dom=new JSDOM('<main><div id="anchor"></div></main>',{url:'http://127.0.0.1:3018/locations/?qa=save-error-test'});
Object.assign(globalThis,{document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,FormData:dom.window.FormData});
const realInterval=globalThis.setInterval;globalThis.setInterval=()=>0;
let saveWorks=false;
globalThis.fetch=async(url,request)=>{const p=JSON.parse(request.body);return {ok:true,json:async()=>p.action==='scope'?{scope:{revision:1,short:{sector:'manufacturing',users:null},sites:[]},scopeHash:'test-hash',readiness:{},lines:[]}:{settings:p.payload}};};
const view=createPricingWorkspace(document.querySelector('#anchor'),()=>({packet:{project:{id:'test-project'}},input:{sector:'manufacturing'},estate:{},providers:[],saveProject:async()=>saveWorks}));
async function submit(){const f=view.element.querySelector('#np-supplier');for(const [name,value] of Object.entries({supplierId:'netify',name:'Test contact',email:'test@example.test',authority:'TEST ONLY'}))f.elements.namedItem(name).value=value;f.elements.namedItem('attest').checked=true;await f.onsubmit({preventDefault(){},target:f});}
try{
 await submit();assert.match(view.element.querySelector('[role=status]').textContent,/could not save/,'Failed shared-project save must remain visible, never overwritten by success');assert.equal(localStorage.length,0);
 saveWorks=true;const original=dom.window.Storage.prototype.setItem;dom.window.Storage.prototype.setItem=function(){throw new dom.window.DOMException('quota','QuotaExceededError');};await submit();assert.match(view.element.querySelector('[role=status]').textContent,/could not save/);dom.window.Storage.prototype.setItem=original;
 await submit();assert.match(view.element.querySelector('[role=status]').textContent,/saved on this device/);assert.equal(localStorage.length,1);
 await view.element.querySelector('#np-terms').onsubmit({preventDefault(){},target:view.element.querySelector('#np-terms')});view.element.querySelector('#np-supplier [name="name"]').value='Unsubmitted contact';view.element.querySelector('#np-terms [name="bandwidthMbps"]').value='250';await view.refresh();assert.equal(view.element.querySelector('#np-supplier [name="name"]').value,'Unsubmitted contact','Background refresh must preserve unfinished supplier input');assert.equal(view.element.querySelector('#np-terms [name="bandwidthMbps"]').value,'250','Background refresh must preserve unfinished pricing terms');
 console.log('PASS failed project save and storage quota stay visible, no false success, explicit successful retry persists pricing.');
}finally{globalThis.setInterval=realInterval;dom.window.close();}
