import assert from 'node:assert/strict';
import {SECTOR_CHOICES} from '../src/lib/sector-comparison-config';
import {SECTOR_PRIORITIES,architectureQuestions} from '../src/lib/sector-decision-config';
import {SectorComparisonInputSchema,compareSectorProviders,decisionPackMarkdown,type PublishedProvider} from '../src/lib/sector-comparison';
import {decisionReviewText} from '../src/lib/sector-decision-review';
import {fullResearchAppendixMarkdown} from '../src/lib/sector-research-appendix';
for(const sector of SECTOR_CHOICES){assert.equal(SECTOR_PRIORITIES[sector.id].length,3);for(const p of SECTOR_PRIORITIES[sector.id]){assert.ok(p.test.length>60);assert.ok(p.challenges.length);}}
const notes='Complete buyer context. '.repeat(250);
const input=SectorComparisonInputSchema.parse({sector:'manufacturing',sites:30,users:200,regions:['uk_ireland'],service_model:'fully_managed',scope:'sase',challenges:[{id:'resilience',mandatory:true}],requirements:[],notes,decision:{priority_id:'production',ownership_confirmed:true,estate:'retain',approach:'separate'}});
assert.ok(decisionReviewText(input).endsWith(notes),'AI ingest receives the full buyer text, not a preview');
assert.equal(SectorComparisonInputSchema.safeParse({...input,sector:'healthcare'}).success,false,'An outcome cannot silently move to a different sector');
assert.ok(architectureQuestions('separate','retain','fully_managed').some(q=>q.includes('one operational owner')));
assert.ok(architectureQuestions('managed','retain','fully_managed').some(q=>q.includes('replacement')));
const long='Valuable complete evidence. '.repeat(700);
const record={provider:{slug:'example',display_name:'Example provider',provider_types:[],primary_geographies:['United Kingdom']},revision:{id:'r1',dataset_version:'v1',reviewed_at:'2026-11-01',editorial_revision:'e1'},editorial:{overview:long},products:[{name:'Product',qualification:long}],capabilities:[],geographies:[],service_models:[],compliance:[{framework:'Test assurance',scope:long,evidence_source_ids:['s1']}],integrations:[],sector_evidence:[],case_studies:[],evaluations:[],evidence_sources:[{id:'s1',url:'https://example.com/source',verified_date:'2026-11-01'}],future_section:[{new_field:long}],api_version:'public/1',reconciliation:{version:'source-interpretation-v1'}} as PublishedProvider;
const original=JSON.stringify(record),appendix=fullResearchAppendixMarkdown([record]);assert.equal(JSON.stringify(record),original);assert.ok(appendix.includes(long));assert.ok(appendix.includes('primary geographies'));assert.ok(appendix.includes('editorial revision'));assert.ok(appendix.includes('future section'));assert.ok(appendix.includes('source-interpretation-v1'));
const pack=decisionPackMarkdown(compareSectorProviders(input,[record]),['example']);assert.ok(pack.includes(notes));assert.ok(pack.includes(SECTOR_PRIORITIES.manufacturing[0].test));assert.ok(pack.includes('Choose the platform and operating partner separately'));
console.log('PASS all 10 sector journeys, complete AI input, architecture tensions, source metadata, future fields, untruncated research appendix and decision-pack context.');
