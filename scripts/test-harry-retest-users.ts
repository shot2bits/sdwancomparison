import assert from 'node:assert/strict';
import {deterministicExtract, applyUpdates, vetModelProposals} from '../src/lib/workspace/extract';
import {mergeUpdates, standing} from '../src/lib/workspace/draft';
import {compileProcurementDocument} from '../src/lib/workspace/procurement-document';
const text='We have 900 users in total, including 30 remote users, and 15 sites.';
const updates=deterministicExtract(text);
assert(updates.some(u=>u.path==='estate.users'&&u.value===900));
assert(updates.some(u=>u.path==='estate.remoteUsers'&&u.value===30));
let requirement=applyUpdates({},updates);
let facts=mergeUpdates([],updates,1).facts;
const correction=deterministicExtract('Correction: we have 18 sites in total, 12 in the UK and 6 in Germany. Remote users remain 30.');
requirement=applyUpdates(requirement,correction); facts=mergeUpdates(facts,correction,2).facts;
assert.equal(requirement.estate?.users,900);assert.equal(requirement.estate?.remoteUsers,30);assert.equal(requirement.estate?.sites,18);
const document=compileProcurementDocument({facts,requirement,verdict:null,noted:[],rfiSet:null,instrument:'sor',receipts:[],previousDocument:null});
assert(document.summary.includes('900 users in scope'));assert(document.summary.includes('30 remote users'));
assert(standing(facts).some(f=>f.path==='estate.remoteUsers'&&f.value===30));
const model=vetModelProposals([{path:'estate.users',value:40,quote:'40 remote users'}],'40 remote users',[]);
assert(model.some(u=>u.path==='estate.remoteUsers'&&u.value===40));assert(!model.some(u=>u.path==='estate.users'));
console.log('PASS total and remote user counts stay distinct through extraction, correction, ledger and document');

const reverse=deterministicExtract("30 remote users out of 900 users in total");
assert(reverse.some(u=>u.path==="estate.users"&&u.value===900));
assert(reverse.some(u=>u.path==="estate.remoteUsers"&&u.value===30));
for (const invalid of ['-5 remote users','12.5 remote users','possibly 5 or 15 remote users']) {
  assert(!deterministicExtract(invalid).some(u=>u.path==='estate.remoteUsers'),invalid);
}
const totalModel=vetModelProposals([{path:'estate.users',value:900,quote:text}],text,[]);
assert(totalModel.some(u=>u.path==='estate.users'&&u.value===900));
