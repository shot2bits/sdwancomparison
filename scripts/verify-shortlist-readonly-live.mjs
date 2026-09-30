import assert from 'node:assert/strict';

// Public, read-only acceptance checks. No project creation, publication, email,
// private tokens or personal data. Not an external-assistant adoption benchmark.
const origin = process.argv[2] ?? 'https://netify.co.uk';
const endpoint = new URL('/sase/api/mcp/', origin);
let id = 0;
async function rpc(method, params) {
  const response = await fetch(endpoint, {method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200);
  const envelope = await response.json();
  assert(!envelope.error, JSON.stringify(envelope.error));
  return envelope.result;
}
const discovery = await rpc('tools/list',{});
const allowed = ['compare_vendors','verify_claim','build_sase_shortlist'];
for (const name of allowed) assert.equal(discovery.tools.find(t=>t.name===name)?.annotations?.readOnlyHint,true,name);
async function call(name,args) {
  assert(allowed.includes(name),'only approved read-only methods');
  const result = await rpc('tools/call',{name,arguments:args});
  assert(!result.isError,JSON.stringify(result));
  if (result.structuredContent) return result.structuredContent;
  return JSON.parse(result.content.find(c=>c.type==='text').text);
}
const result=[];
const comparison = await call('compare_vendors',{slugs:['aryaka','cato-networks'],question:'Compare private backbone, management and resilience; distinguish source claims from deployment guarantees.'});
assert.deepEqual([...comparison.slugs].sort(),['aryaka','cato-networks']);
const rows=comparison.groups.flatMap(g=>g.rows);
for (const [slug,key] of [['aryaka','f21_private_global_backbone'],['cato-networks','f11_active_active_link_utilisation']]) {
  assert.equal(rows.find(r=>r.key===key).grades[slug],'yes');
  assert.match(rows.find(r=>r.key===key).evidence[slug].source_url,/^https:\/\//);
}
assert(!('score' in comparison));
result.push({case:'named comparison with scoped primary evidence',passed:true});
for (const [slug,claim] of [['aryaka','private backbone'],['cato-networks','active-active']]) {
  const verified=await call('verify_claim',{slug,claim});
  assert.equal(verified.status,'vendor_documented');
  assert.equal(verified.value,'yes');
  assert.equal(verified.quote,null);
  assert(verified.note&&verified.sources.length);
  result.push({case:`${slug}: ${claim} agrees with comparison`,passed:true});
}
for (const criteria of [{service_model:'managed',required_regions:['north_america']},{service_model:'co_managed',required_regions:['uk_ireland','europe']}]) {
  const preview=await call('build_sase_shortlist',criteria);
  assert.equal(preview.requires_publication,true);
  assert.equal(typeof preview.considered_count,'number');
  assert(!preview.shortlist&&!preview.matches&&!preview.vendors,'public preview must not leak personalised matches');
  assert.equal(new URL(preview.engine_url).pathname,'/sase-sd-wan-rfp-builder/');
  result.push({case:`aggregate preview and safe handoff: ${criteria.service_model}`,passed:true});
}
const resume=await fetch(comparison.resume_url,{signal:AbortSignal.timeout(30000)});
assert.equal(resume.status,200);
assert.equal(new URL(resume.url).pathname,'/sase/shortlist/');
result.push({case:'human comparison handoff resolves to live shortlist',passed:true});
console.log(JSON.stringify({checked_at:new Date().toISOString(),endpoint:endpoint.href,classification:'synthetic_read_only_acceptance_not_buyer_or_assistant_adoption',checks:result},null,2));
