/** Hosted regression: a successful local build does not prove the private web route loads. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
const access=JSON.parse(await readFile(process.env.NETIFY_PREVIEW_ACCESS_FILE??'/private/tmp/netify-preview-access.json','utf8'));
assert(access.cookie,'A temporary authenticated protected-preview session is required.');
const origin=new URL(access.origin).origin;
assert(origin.endsWith('.vercel.app'),'This regression runs on a hosted protected preview.');
const headers={'content-type':'application/json',cookie:access.cookie};
const r=await fetch(origin+'/sase/api/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_project',arguments:{operation_id:randomUUID(),creation_key:randomBytes(32).toString('base64url'),instruction:'Create a disposable synthetic hosted private-route regression project.'}}})});
assert.equal(r.status,200);assert(r.headers.get('content-type')?.includes('application/json'));
const created=(await r.json()).result;assert(!created.isError);const p=created.structuredContent.data,token=new URLSearchParams(new URL(p.edit_link).hash.slice(1)).get('cap')!;
const reply=await fetch(origin+'/sase/api/context-preview/core/'+p.project_id,{headers:{cookie:access.cookie,authorization:'Bearer '+token}});
assert.equal(reply.status,200,'Hosted private-project route must return HTTP 200');
assert(reply.headers.get('content-type')?.includes('application/json'),'Hosted private-project route must return JSON, never an HTML error page');
const data=await reply.json();assert.equal(data.project_id,p.project_id);assert.equal(data.authority,'edit');assert.equal(data.revision,p.revision);assert.equal(data.scope_hash,p.scope_hash);
const result={result:'PASS',check:'Hosted private-project route imports, authenticates and returns the same MCP-created scope as JSON',origin,project_id:p.project_id,revision:p.revision};
await writeFile('/private/tmp/netify-hosted-private-project-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

const visited=new Set<string>();async function moduleGraph(path:string){if(visited.has(path))return;visited.add(path);const response=await fetch(origin+path,{headers:{cookie:access.cookie}});assert.equal(response.status,200,'Hosted map module must load: '+path);assert(response.headers.get('content-type')?.includes('javascript'));const source=await response.text();for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"\n]+\.js)['"]/g)){const u=new URL(match[1],origin+path);assert.equal(u.origin,origin);await moduleGraph(u.pathname);}}await moduleGraph('/sase/locations/assets/client.js');console.log(JSON.stringify({result:'PASS',map_modules:visited.size,check:'Every static import in the map module graph is served as JavaScript'}));
