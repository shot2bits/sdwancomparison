/** Hosted regression for the optional DOM and location import dependency chain. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const a=JSON.parse(await readFile('/private/tmp/netify-preview-access.json','utf8'));
const results=[];
for(const [path,body,check] of [
 ['resolve-city',{city:'London',country:'UK'},d=>assert.equal(d.match.region,'uk_ireland')],
 ['location-import',{text:'Name,City,Country,Users\nLondon HQ,London,UK,40\nParis office,Paris,France,30'},d=>{assert.equal(d.candidates.length,2);assert.equal(d.truncated,false);}],
 ['business-brief',{url:'https://example.com',sites:2,users:70},d=>{assert.equal(d.fields.sites,2);assert.equal(d.fields.users,70);assert(d.source.text.length>0);assert.equal(d.source.url,'https://example.com/');}]
]){
 const r=await fetch(a.origin+'/sase/api/context-preview/'+path,{method:'POST',headers:{cookie:a.cookie,origin:a.origin,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const raw=await r.text();assert.equal(r.status,200,path+': '+raw.slice(0,1500));const d=JSON.parse(raw);check(d);results.push({check:path,result:'PASS'});
}
await writeFile('/private/tmp/netify-optional-reader-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
