import assert from 'node:assert/strict';
import {publicBusinessUrl,publicAddress,draftBusinessBrief} from './context-business-helper';
import {sectorStartingPlan} from '../preview/context-space/company-overview.js';
import {contextCatalogue} from '../src/lib/context-comparison-preview';
import {projectQuestionCatalogue} from '../src/lib/context-project-preview';
for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://[::1]','https://user:pass@example.com','https://example.com:9443'])assert.throws(()=>publicBusinessUrl(url));
assert.equal(publicBusinessUrl('https://example.com/about#team').href,'https://example.com/about');
for(const address of ['127.0.0.1','10.2.3.4','172.20.3.4','192.168.1.1','169.254.169.254','100.64.0.1','::1','fc00::1234','fe80::12','::ffff:127.0.0.1','203.0.113.1'])assert.equal(publicAddress(address),false,address);
assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700::1111'),true);
const catalogue=contextCatalogue(),questions=projectQuestionCatalogue();
for(const sector of catalogue.sectors)for(const scope of ['sase','sdwan','secure_access']){const plan=sectorStartingPlan(sector.id,scope,questions,catalogue.contexts[sector.id]);assert.equal(plan.contextIndices.length,3);assert(plan.questionIds.length>=4&&plan.questionIds.length<=12);assert.equal(new Set(plan.questionIds).size,plan.questionIds.length);assert(plan.questionIds.every(id=>questions.some(q=>q.id===id)));if(scope==='sdwan')assert(!plan.questionIds.some(id=>{const q=questions.find(q=>q.id===id)!;return q.sector&&/(SSE:|SASE:)/.test(q.category);}));}
assert(sectorStartingPlan('manufacturing','sase',questions,catalogue.contexts.manufacturing).questionIds.includes('man-1.1'));
process.env.ANTHROPIC_API_KEY='';
const draft=await draftBusinessBrief({about:'We are a manufacturer of precision components.',sites:24,users:800,scope:'sase',regions:['uk_ireland'],applications:'Microsoft 365; SAP',change:'We need a phased migration.'});
assert.equal(draft.engine,'source_based');assert.equal(draft.fields.sites,24);assert.equal(draft.fields.users,800);assert.equal(draft.fields.sector,'manufacturing');assert(draft.description.includes('Known sites: 24'));assert(draft.warnings[0].includes('not configured'));
await assert.rejects(()=>draftBusinessBrief({}),/Enter your company/);
console.log('PASS: private/credentialled URL rejection, private address blocking, all 10 sector plans across three scopes, original question IDs, and honest editable fallback with explicit buyer facts.');
