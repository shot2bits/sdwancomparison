import assert from 'node:assert/strict';
import {SECTOR_CHOICES} from '../src/lib/sector-comparison-config';
import {SECTOR_PRIORITIES,SCENARIO_CHECKS} from '../src/lib/sector-decision-config';
import {compareSectorProviders,decisionPackMarkdown,type PublishedProvider,type SectorComparisonInput} from '../src/lib/sector-comparison';

const evidence={support_state:'supported',confidence:'high',freshness_state:'current',qualification:'Included only in the named product and licence.',verified_date:'2026-11-01',evidence_source_ids:['s1']};
const codes=[...new Set(Object.values(SCENARIO_CHECKS).flatMap(c=>[...c.codes]))];
const record:PublishedProvider={provider:{slug:'example',display_name:'Example'},revision:{id:'r1',dataset_version:'v1',reviewed_at:'2026-11-01'},products:[],capabilities:codes.map(capability_code=>({...evidence,capability_code})),service_models:[],geographies:[],integrations:[],compliance:[],sector_evidence:[],case_studies:[],evaluations:[],evidence_sources:[{id:'s1',url:'https://example.com/evidence',source_status:'current',reliability_tier:'tier_1'}]};
const original=JSON.stringify(record);
let count=0;
for(const sector of SECTOR_CHOICES){
 for(const scenario of SECTOR_PRIORITIES[sector.id]){
  count++;
  const input:SectorComparisonInput={sector:sector.id,sites:20,users:150,regions:['uk_ireland'],scope:'sdwan',service_model:'any',challenges:[{id:'audit',mandatory:true}],requirements:[{id:'entra',mandatory:false}],notes:'We have specific application and contract constraints. '.repeat(100),decision:{priority_id:scenario.id,ownership_confirmed:false,estate:'retain',approach:'separate'}};
  const result=compareSectorProviders(input,[record]);
  assert.deepEqual(result.input.challenges,input.challenges,'A scenario cannot change buyer requirements');
  assert.deepEqual(result.input.requirements,input.requirements);
  const provider=result.providers[0];
  const findings=provider.findings.filter(f=>f.id.startsWith('scenario:'));
  assert.equal(findings.length,scenario.checks.length+1);
  assert.ok(findings.every(f=>!f.mandatory),'Scenario suggestions never become confirmed must-haves');
  for(const id of scenario.checks){
   const found=findings.find(f=>f.id==='scenario:'+id)!;
   assert.equal(found.state,'evidenced');
   assert.ok(found.qualification.includes(evidence.qualification),'Keep original licence qualification');
   assert.deepEqual(found.source_urls,['https://example.com/evidence']);
   assert.ok(found.qualification.includes('not proof'));
  }
  const proof=findings.find(f=>f.id==='scenario:acceptance')!;
  assert.equal(proof.state,'unconfirmed','Even a complete feature set does not prove a passed scenario');
  assert.equal(proof.reviewed_at,null);
  assert.equal(proof.source_urls.length,0,'A proposed buyer test cannot acquire an invented citation');
  assert.ok(provider.questions.includes(scenario.test));
  const pack=decisionPackMarkdown(result,['example']);
  assert.ok(pack.includes(scenario.test));
  assert.ok(pack.includes(input.notes),'Complete buyer context remains in the pack');
  assert.ok(pack.includes('### Scenario evidence checks'));
  const uncertain=structuredClone(record);
  uncertain.capabilities=uncertain.capabilities.map(r=>({...r,support_state:'requires_confirmation'}));
  const gaps=compareSectorProviders(input,[uncertain]).providers[0];
  assert.ok(gaps.findings.filter(f=>f.id.startsWith('scenario:')).every(f=>f.state==='unconfirmed'));
  assert.notEqual(gaps.group,'excluded','A scenario research gap is not a mandatory mismatch');
 }
}
assert.equal(count,30);
const base:SectorComparisonInput={sector:'manufacturing',sites:5,users:20,regions:['uk_ireland'],scope:'sdwan',service_model:'any',challenges:[],requirements:[],notes:'',decision:{priority_id:'production',ownership_confirmed:false,estate:'retain',approach:'undecided'}};
const production=compareSectorProviders(base,[record]).providers[0];
const maintenance=compareSectorProviders({...base,decision:{...base.decision!,priority_id:'maintenance'}},[record]).providers[0];
assert.ok(production.findings.some(f=>f.id==='scenario:failover'));
assert.ok(!maintenance.findings.some(f=>f.id==='scenario:failover'),'Previous scenario checks must not accumulate');
assert.ok(maintenance.findings.some(f=>f.id==='scenario:privileged'));
assert.equal(JSON.stringify(record),original,'No source record, confidence, qualification or review date was rewritten');
console.log('PASS 30 scenario-to-evidence journeys, explicit proof gaps, complete notes, original qualifications, no phantom mandatory requirements and no accumulated scenario checks.');
