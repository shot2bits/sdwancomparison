import assert from 'node:assert/strict';
import {compileProcurementDocument} from '../src/lib/workspace/procurement-document';
import {deterministicExtract,vetModelProposals,extractRequirement} from '../src/lib/workspace/extract';
for(const [text,n] of [['five UK retail stores',5],['twenty-five sites',25],['12 sites',12],['thirty remote users',30]] as const){assert(deterministicExtract(text).some(f=>f.value===n),text);}
const uncertain='We might have 5 or 15 sites, not sure';
assert(!deterministicExtract(uncertain).some(f=>f.path==='estate.sites'));
assert(!vetModelProposals([{path:'estate.sites',value:15,quote:'15 sites'}],uncertain,[]).some(f=>f.path==='estate.sites'));
assert(deterministicExtract('Budget is roughly £200k but we have 45 sites.').some(f=>f.path==='estate.sites'&&f.value===45));
const unrelated=await extractRequirement('Tell me how to cook pasta');assert.equal(unrelated.updates.length,0);assert.equal(unrelated.unplacedClauses.length,0);
console.log('PASS written counts; ambiguous deterministic/model counts rejected; precise count retained; unrelated request rejected');

const userDocument=compileProcurementDocument({facts:[],requirement:{estate:{users:900}},verdict:null,noted:[],rfiSet:null,instrument:"sor",receipts:[],previousDocument:null});
assert(userDocument.summary.includes("900 users in scope"));
assert(!userDocument.summary.includes("900 remote users"));
console.log("PASS user totals are not relabelled as remote users");
