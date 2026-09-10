import assert from 'node:assert/strict';
import { deterministicExtract, vetModelProposals, extractRequirement } from '../src/lib/workspace/extract';
import { buildCandidateClauses } from '../src/lib/workspace/procurement-templates';
import type { WorkspaceFact } from '../src/lib/workspace/draft';

const medium = 'We are a manufacturing business with 15 sites: 10 in the UK and five international sites in Germany, USA and Singapore. We have 30 remote users. We need SASE and SD-WAN to replace ageing MPLS, connect factories to Microsoft Azure and protect remote access. We want a fully managed service, resilient factory connectivity, separation of OT and IT, and migration within six months.';
const has = (updates: ReturnType<typeof deterministicExtract>, path: string, value: unknown) => updates.some(u=>u.path===path && (Array.isArray(u.value)?u.value.includes(value):u.value===value));
const rail = deterministicExtract(medium);
assert(has(rail,'estate.sites',15)); assert(has(rail,'estate.users',30));
assert(has(rail,'estate.cloud','azure')); assert(!has(rail,'estate.cloud','m365'));
assert(has(rail,'estate.existingNetwork','mpls')); assert(!has(rail,'estate.existingNetwork','sdwan'));
assert(has(rail,'constraints.timeline','within six months'));
for(const text of ['Microsoft Azure', 'Microsoft Defender', 'Microsoft']) {
 assert(!has(vetModelProposals([{path:'estate.cloud',value:['m365','azure'],quote:text}],text,[]),'estate.cloud','m365'));
}
for(const text of ['Microsoft 365', 'M365', 'Office 365', 'O365']) assert(has(deterministicExtract(text),'estate.cloud','m365'));
for(const text of ['We currently run SD-WAN.', 'We are on SD-WAN already.', 'Replacing our SD-WAN.']) assert(has(deterministicExtract(text),'estate.existingNetwork','sdwan'),text);
for(const text of [medium,'We currently use MPLS. We want SD-WAN.','We have 15 sites and need SD-WAN.']) {
 assert(!has(deterministicExtract(text),'estate.existingNetwork','sdwan'),text);
 assert(!has(vetModelProposals([{path:'estate.existingNetwork',value:['sdwan'],quote:'SD-WAN'}],text,[]),'estate.existingNetwork','sdwan'));
}
const services='Professional services must include migration, project management, training and change requests. Correct the remote users to 1200. Deployment must complete within 12 months.';
assert(!deterministicExtract(services).some(u=>u.path==='organisation.sector'));
assert(!vetModelProposals([{path:'organisation.sector',value:'Professional services',quote:'Professional services'}],services,[]).some(u=>u.path==='organisation.sector'));
for(const text of ['Professional services', 'We are a professional services firm.']) assert(has(deterministicExtract(text),'organisation.sector','Professional services'));
const savedKey=process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const restored=await extractRequirement(services,{organisation:{sector:'Manufacturing'}});
assert.equal(restored.requirement.organisation?.sector,'Manufacturing');
if(savedKey)process.env.ANTHROPIC_API_KEY=savedKey;
const facts:WorkspaceFact[]=[{id:'nis2',path:'constraints.complianceRequirements',value:'nis2',provenance:'stated',quote:'Provide evidence supporting NIS2 compliance',struck:false,source:'extract',cycle:1}];
const clauses=buildCandidateClauses({facts,requirement:{},buying:'sase',opModel:null,receipts:[],removalTargets:[],pack:null,flavours:[]});
const nis=clauses.find(c=>c.templateKey==='compliance:nis2'); assert(nis);
assert.equal(nis.mandatory,false);
assert(!/certificate|certification|before contract award/i.test([nis.statement,...nis.supplierResponse,...nis.evidence,nis.acceptanceTest].join(' ')));
console.log('PASS manufacturing audit: rail and model fact guards, retained sector, relative deadline, and scoped NIS2 evidence');

const requiredNis=buildCandidateClauses({facts:[{...facts[0],quote:'Suppliers must provide evidence supporting NIS2 compliance'}],requirement:{},buying:'sase',opModel:null,receipts:[],removalTargets:[],pack:null,flavours:[]}).find(c=>c.templateKey==='compliance:nis2');
assert.equal(requiredNis?.mandatory,true);
assert(!/certificate|certification/i.test(JSON.stringify(requiredNis?.evidence)));
assert(deterministicExtract('Suppliers must provide evidence supporting NIS2 compliance.').find(u=>u.path==='constraints.complianceRequirements')?.quote?.includes('must'));

// The explicit noun-before-number correction must reach the same scalar ledger.
for (const phrase of ['Correct remote users to 40', 'Please change the remote users to 40.', 'We have 30 remote users. Update remote users to 40.']) {
 const updates=deterministicExtract(phrase); assert.equal(updates.filter(u=>u.path==='estate.users').at(-1)?.value,40,phrase);
 assert.equal(updates.filter(u=>u.path==='estate.users').at(-1)?.quote,phrase.includes('Update')?'Update remote users to 40':phrase.replace(/^Please /,'').replace(/\.$/,''));
 assert(!vetModelProposals([{path:'estate.users',value:30,quote:'30 remote users'}],phrase,[]).length);
}
for (const phrase of ['Correct remote users to -40','Correct remote users to 40.5','Correct remote users to about 40','Correct remote users to 40 or 50','Do not correct remote users to 40','Correct total users to 40','Set global numbers to 40']) {
 assert(!deterministicExtract(phrase).some(u=>u.path==='estate.users'),phrase);
}
for(const phrase of ['Correct remote users to -40','Correct remote users to 40.5','Do not correct remote users to 40']) {
 assert(!vetModelProposals([{path:'estate.users',value:40,quote:'40'}],phrase,[]).some(u=>u.path==='estate.users'),phrase);
}
const savedCorrectionKey=process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const corrected=await extractRequirement('Correct remote users to 40',{estate:{users:30,sites:15}});
assert.equal(corrected.requirement.estate?.users,40); assert.equal(corrected.requirement.estate?.sites,15);
const rejected=await extractRequirement('Correct remote users to -40',{estate:{users:30,sites:15}});
assert.equal(rejected.requirement.estate?.users,30);
if(savedCorrectionKey)process.env.ANTHROPIC_API_KEY=savedCorrectionKey;
console.log('PASS explicit remote-user corrections, verbatim provenance, stale-model rejection and invalid/negated rollback');

assert.equal(vetModelProposals([{path:'estate.users',value:40,quote:'40'}],'Correct remote users to 40',[])[0]?.quote,'Correct remote users to 40');
