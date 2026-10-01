import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const origin=process.env.CITATION_CHECK_ORIGIN || 'https://netify.co.uk';
const paths=['/sase/shortlist/','/sase/shortlist/data.json/','/sase/llms.txt','/sase/llms-full.txt','/robots.txt','/sitemap.xml'];
const results=await Promise.all(paths.map(async path=>{
 try{
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(30000)}),body=await response.text();
  return {path,status:response.status,url:response.url,content_hash:createHash('sha256').update(body).digest('hex'),build:body.match(/data-build="([^"]+)"/)?.[1]||null,canonical:body.match(/rel="canonical"[^>]*href="([^"]+)"/)?.[1]||null,x_robots_tag:response.headers.get('x-robots-tag'),noindex:/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(body),provider_count:path.includes('data.json')&&response.ok?JSON.parse(body).vendors?.length:null};
 }catch(error){return {path,error:error.message};}
}));
const record={captured_at:new Date().toISOString(),origin,results,scope:'Direct HTTP checks only, not proof of indexing or AI retrieval.'};
await writeFile('docs/citation-panel/retrieval-latest.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
if(results.some(r=>r.error||r.status!==200||r.noindex))process.exitCode=1;
