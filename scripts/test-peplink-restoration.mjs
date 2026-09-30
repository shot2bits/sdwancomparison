import assert from 'node:assert/strict';
const origin=process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:3185';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname), 'Use the local preview');
const page=await fetch(origin+'/sase/alternatives/peplink/');
assert.equal(page.status,200);
const html=await page.text();
assert.match(html,/https:\/\/netify.co.uk\/sase\/alternatives\/peplink\//);
assert.equal((html.match(/<main\b/g)||[]).length,1,'one main landmark');
assert.match(html,/<caption[^>]*>Peplink alternatives compared on sourced evidence/);
const jsonResponse=await fetch(origin+'/sase/alternatives/peplink/data.json');
assert.equal(jsonResponse.status,200);
const json=await jsonResponse.json();
assert.equal(json.subject_vendor.included_in_matching_catalogue,false);
assert.equal(json.result.shortlist.length,30);
assert.deepEqual(json.result.shortlist.map(x=>x.position),Array.from({length:30},(_,i)=>i+1));
assert.equal(json.ordered_by,json.result.ordered_by);
assert.match(json.ordered_by,/proven_evidence_count desc/);
let prior=-1;
for(const p of json.result.shortlist){
 assert.notEqual(p.slug,'peplink');
 assert.ok(p.marketplace_url && html.includes(p.marketplace_url), 'Use the current marketplace profile, not retired legacy profile paths');
 assert.ok(p.differentiator);assert.ok(Number.isInteger(p.proven_evidence_count));assert.ok(p.last_verified);
 const i=html.indexOf(`id="provider-${p.slug}"`);assert.ok(i>prior,'HTML and JSON order agree');prior=i;
}
function check(v){if(Array.isArray(v))return v.forEach(check);if(v&&typeof v==='object')for(const [k,c] of Object.entries(v)){assert.ok(!/^(score|rank|ranking|fit_score|match_percentage|match_pct|balanced_setting_score|default_shortlist|top_providers_at_balanced_setting)$/.test(k),`public scoring field ${k}`);check(c);}else assert.notEqual(v,'unknown');}
check(json);
assert.ok(!json.evaluate.url.includes('vendors='),'No unapproved Peplink preselection');
console.log('PASS Peplink HTTP page/JSON, canonical, single main, table, 30 numbered entries, parity and no public computed scores or unapproved preselection');
