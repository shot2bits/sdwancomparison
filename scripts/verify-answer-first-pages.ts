import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {BEST_PAGES} from '../src/lib/best-pages';
async function main(){
 const base=process.argv[2] ?? 'http://localhost:3127/sase';
 const feed=await (await fetch(`${base}/shortlist/data.json`)).json();
 const routes=[...feed.vendors.map((v:{slug:string})=>({path:`/vendors/${v.slug}/`,count:1})),...BEST_PAGES.map(p=>({path:`/best/${p.slug}/`,count:feed.vendors.length}))];
 const results=[];
 for(const {path,count} of routes){
   const response=await fetch(base+path);assert.equal(response.status,200,path);const html=await response.text();
   assert.equal((html.match(/data-best-for=/g)??[]).length,count,path);
   for(const action of ['contacts','demo','proposals'])assert.equal(html.split(`&amp;action=${action}#sourcing-brief`).length-1,count,`${path} ${action}`);
   results.push(`PASS ${path}: HTTP 200; ${count} evidence rows; 3 actions per provider`);
 }
 writeFileSync('docs/answer-first/all-pages.txt',results.join('\n')+'\n');
 console.log(`PASS all ${routes.length} provider and sector pages: HTTP 200; complete evidence rows; all three actions per provider`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
