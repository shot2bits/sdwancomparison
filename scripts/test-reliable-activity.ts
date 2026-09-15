import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {activityKvBinding} from '../src/lib/activity-storage';import {createActivity,activityEnvironment} from '../src/lib/activity-provenance';
import {weeklyActivityReport,type ReportingRecord} from '../src/lib/activity-weekly-report';import {withFakeKv} from './fake-kv-harness';
const shared={KV_REST_API_URL:'https://shared.upstash.io',KV_REST_API_TOKEN:'fake'};
assert.equal(activityKvBinding({...shared,VERCEL_ENV:'preview'}).url,undefined);
assert.equal(activityKvBinding({...shared,VERCEL_ENV:'production'}).url,shared.KV_REST_API_URL);
assert.equal(activityKvBinding({...shared,VERCEL_ENV:'preview',NETIFY_ISOLATED_KV_REST_API_URL:shared.KV_REST_API_URL,NETIFY_ISOLATED_KV_REST_API_TOKEN:'another'}).url,undefined);
assert.equal(activityKvBinding({...shared,VERCEL_ENV:'preview',NETIFY_ISOLATED_KV_REST_API_URL:'https://isolated.upstash.io',NETIFY_ISOLATED_KV_REST_API_TOKEN:'fake'}).url,'https://isolated.upstash.io');
assert.equal(weeklyActivityReport([],[],Date.parse('2026-09-05T23:00:00Z'),Date.parse('2026-09-12T23:00:00Z')).response_coverage.ratio,null);
assert.equal(activityEnvironment('netify.co.uk'),'unknown');assert.equal(createActivity({test:true}).classification.value,'test');assert.equal(createActivity({buyer:{organisation:'ACME'}}).classification.value,'unknown');
const start=Date.parse('2026-09-05T23:00:00Z'),end=Date.parse('2026-09-12T23:00:00Z');
const activity={...createActivity({}),environment:'production' as const,classification:{value:'non_test' as const,reason:'Reviewed',actor:'reviewer',at:start},buyer_intent:{verified:true,evidence_ref:'intent:1',actor:'reviewer',at:start}};
const r:ReportingRecord={app:'sase',id:'same',environment:'production',route:'find_providers',created_at:start,activity,publications:[{id:'pub1',opportunity_id:'opp1',at:start+1},{id:'pub2',opportunity_id:'opp1',at:start+2}],invitations:[{id:'invite1',opportunity_id:'opp1',at:start+100,delivery:'delivered',delivered_at:start+1000}],responses:[{id:'response1',opportunity_id:'opp1',invitation_id:'invite1',at:end+3600000,substantive:true}],outcomes:[]};
const preview={...r,environment:'preview' as const,activity:{...activity,environment:'preview' as const,classification:{...activity.classification,value:'test' as const}}};
assert.equal(weeklyActivityReport([{...r,activity:{...activity,classification:{...activity.classification,value:'test'}}}],[],start,end).publications.verified_production_non_test_buyer_intent,0);
const legacy={...r,id:'legacy',environment:'unknown' as const,activity:undefined,publications:[{id:'old',opportunity_id:'oldopp',at:start+1}],invitations:[],responses:[]};
const events=[{app:'sase',environment:'production' as const,record_id:'same',event:'published',id:'a',at:start}, {app:'sase',environment:'production' as const,record_id:'same',event:'published',id:'a',at:start},{app:'sase',environment:'preview' as const,record_id:'same',event:'published',id:'a',at:start}];
assert.equal(weeklyActivityReport([r,r],[],start,end).publications.publication_revisions,2);
assert.equal(weeklyActivityReport([{...r,invitation_records_complete:false}],[],start,end).response_coverage.ratio,null);
let report=weeklyActivityReport([r,preview,legacy],events,start,end);
assert.equal(report.publications.verified_production_non_test_buyer_intent,1);assert.equal(report.partitions.unknown.unknown,1);assert.equal(report.event_counts.raw,3);assert.equal(report.event_counts.unique_events,2);assert.equal(report.response_coverage.numerator,0);assert.equal(report.response_coverage.denominator,1);
report=weeklyActivityReport([r,preview,legacy],events,start,end,end+7200000);assert.equal(report.response_coverage.numerator,1);assert.ok(report.response_coverage.rows[0].response_hours!>0);
assert.equal(weeklyActivityReport([legacy],[],start,end).response_coverage.ratio,null);
const acceptedOnly={...r,invitations:r.invitations!.map(i=>({...i,delivery:'accepted',delivered_at:undefined}))};assert.equal(weeklyActivityReport([acceptedOnly],[],start,end,end+7200000).response_coverage.rows[0].response_hours,null);
assert.equal(weeklyActivityReport([{...r,created_at:end,publications:[{id:'out',opportunity_id:'out',at:end}]}],[],start,end).publications.unique_total,0);
await withFakeKv(async()=>{
 const {recordPersistedActivity}=await import('../src/lib/activity-events');const {readActivityAudit,correctActivity}=await import('../src/lib/activity-audit');
 const saved=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
 try{await recordPersistedActivity('sase','same','published','pub1',activity);await recordPersistedActivity('sase','same','published','pub1',activity);
 const {activityCommand}=await import('../src/lib/activity-audit');assert.equal((await activityCommand(['LRANGE','activity:events:sase:production',0,-1]) as string[]).length,1);
 await correctActivity('sase','production','same',activity,0,{classification:'test',reason:'Controlled fixture'},'admin');assert.equal((await readActivityAudit('sase','production','same')).length,1);
 await assert.rejects(()=>correctActivity('sase','production','same',activity,0,{classification:'non_test',reason:'stale'},'admin'));
 await assert.rejects(()=>correctActivity('sase','production','same',activity,1,{buyer_intent:true,reason:'no evidence'},'admin'));
 }finally{if(saved===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=saved;}
});
console.log('PASS storage isolation, explicit/unknown classifications, cross-environment IDs, window boundaries, repeated events, audited corrections, late responses and acceptance versus delivery');

writeFileSync('../reporting-validation/synthetic-weekly-report.json',JSON.stringify({fixture:true,description:'Synthetic production, preview test and unlabelled legacy records; late response included.',...weeklyActivityReport([r,preview,legacy],events,start,end,end+7200000)},null,2));
