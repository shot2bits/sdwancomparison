import assert from 'node:assert/strict';
import { comparableBidGroups } from '../src/lib/bid-comparison';
import type { FeedItem } from '../src/components/OpportunityFeed';
const row=(supplier:string,model:string,currency:string,amount:number|null,created=1):FeedItem=>({id:supplier+model+currency+created,actor_type:'supplier',actor_slug:supplier,actor_name:supplier,type:'pricing',body:'',created,pricing:{model,currency,amount,unit_note:'same project scope',notes:''}});
const groups=comparableBidGroups([row('a','total_monthly','GBP',100),row('a','one_off','GBP',20),row('b','total_monthly','USD',80),row('c','total_monthly','GBP',null),row('a','total_monthly','GBP',120,2)]);
assert.equal(groups.size,3);const monthly=[...groups.values()].find(g=>g[0].model==='total_monthly'&&g[0].currency==='GBP')!;assert.deepEqual(monthly.map(b=>b.amount),[120,null]);assert.equal([...groups.values()].flat().length,4);
console.log('PASS proposal comparison: latest per charging basis, currencies separated, missing amounts retained');
