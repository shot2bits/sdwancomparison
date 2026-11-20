import assert from 'node:assert/strict';
import {MemoryPlatformStore} from '../src/lib/final-platform-store';
import {scopeTransitions} from '../src/lib/final-funnel';
import {csvCell} from '../src/lib/final-owner';
import {FINAL_FLAGS,finalEnabled} from '../src/lib/final-platform-flags';
const store=new MemoryPlatformStore();await store.change('organisation','a',()=>({value:{name:'A'},result:1}));assert.equal((await store.read<any>('organisation','a'))!.value.name,'A');assert.equal(await store.read('organisation','b'),null);
const before={packet:{project:{input:{sector:'',products:[]}}},estate:{sites:[],planning:{}}};const after=structuredClone(before) as any;after.packet.project.input.sector='manufacturing';after.estate.sites=[{id:'a'}];after.estate.planning={siteReviews:{a:'hash'},userReview:'users'};
assert.deepEqual(scopeTransitions(before,after),['sector_or_products_set','first_site_added','site_review_recorded','user_review_recorded']);assert.deepEqual(scopeTransitions(after,after),[]);
assert(csvCell('=HYPERLINK("evil")').startsWith('"\''));assert.equal(csvCell('ordinary'),'"ordinary"');assert.equal(csvCell(null),'""');
for(const key of ['dispatch','intake','comparison','reseller','agents','evidence'] as const){delete process.env[FINAL_FLAGS[key]];assert.equal(finalEnabled(key),false);}
console.log('PASS: private storage boundary, scope transitions, CSV injection defence, Groups 2/3 default off');
