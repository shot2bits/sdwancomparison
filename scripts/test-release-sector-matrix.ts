import assert from 'node:assert/strict';
import {deterministicExtract} from '../src/lib/workspace/extract';
import {validateRfpText} from '../src/lib/workspace/rfp-validator';
const cases=[['Manufacturing','manufacturing','a manufacturing company','production continuity and IT/OT separation'],['Healthcare & pharma','healthcare','a healthcare organisation','patient-data protection and clinical-service continuity'],['Retail & e-commerce','retail','a retail business','payment segmentation and store continuity'],['Financial services','financial_services','a financial services business','operational resilience and supplier risk'],['Government & public sector','government','a local government organisation','public-service continuity and sensitive information']];
for(const [label,key,org,need] of cases)for(const sites of [5,15,120]){
 const text=`We are ${org} with ${sites} sites in the UK and Europe, including 30 remote users. We need managed SASE for ${need}.`;
 const facts=deterministicExtract(text);const report=validateRfpText(text);
 assert.equal(facts.find(f=>f.path==='organisation.sector')?.value,label,text);
 assert.equal(facts.find(f=>f.path==='estate.sites')?.value,sites);
 assert.equal(report.sector.detected,key,text);
 assert.equal(report.assessmentKind,'text_coverage');
 assert(!/ready/i.test(report.label));
 assert(!report.validBaseline);
 console.log('PASS sector/scale',label,sites);
}
const keywords='Manufacturing sector. 15 UK sites. SASE ZTNA objective existing cloud identity uptime failover latency DLP logging fully managed support RACI migration months pilot pricing licences exit evidence mandatory response format.';
const report=validateRfpText(keywords);assert.equal(report.assessmentKind,'text_coverage');assert(!/ready/i.test(report.label));assert(!report.validBaseline);assert(report.limitations.some(s=>s.includes('technical correctness')));
console.log('PASS keyword-heavy text cannot claim procurement readiness');
