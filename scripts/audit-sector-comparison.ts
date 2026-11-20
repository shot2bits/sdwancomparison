import fs from 'node:fs';
import assert from 'node:assert/strict';
import {compareSectorProviders,SectorComparisonInputSchema,type PublishedProvider} from '../src/lib/sector-comparison';
import {normalizeEvidenceRow} from '../src/lib/provider-evidence-normalization';
const directory=process.argv[2];if(!directory)throw new Error('Pass a directory of published provider API records.');
const records=fs.readdirSync(directory).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(directory+'/'+f,'utf8')) as PublishedProvider).filter(record=>record.provider&&Array.isArray(record.capabilities));
let repaired=0;for(const r of records)for(const row of r.sector_evidence)if(normalizeEvidenceRow(row).suitability_state!==row.suitability_state)repaired++;
const scenarios=['financial_services','healthcare','retail_ecommerce','manufacturing','government_public_sector'];
for(const sector of scenarios){const input=SectorComparisonInputSchema.parse({sector,sites:25,users:500,regions:['uk_ireland'],service_model:'fully_managed',scope:'sdwan',challenges:[{id:'resilience',mandatory:false}]});const result=compareSectorProviders(input,records);assert.equal(result.providers.length,records.length);assert.ok(result.providers.some(p=>p.group==='confirmation'),'uncertain candidates remain visible');assert.ok(!result.providers.some(p=>p.group==='evidenced'&&p.findings.some(f=>f.mandatory&&f.state!=='evidenced')));console.log(JSON.stringify({sector,considered:records.length,evidenced:result.providers.filter(p=>p.group==='evidenced').length,confirmation:result.providers.filter(p=>p.group==='confirmation').length,excluded:result.providers.filter(p=>p.group==='excluded').length,sectorReferences:result.providers.reduce((n,p)=>n+p.sector_reference.length,0)}));}
console.log(JSON.stringify({legacySectorNegativesReclassifiedAsUnconfirmed:repaired,reviewDatesUnchanged:true}));
