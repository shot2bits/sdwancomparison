import 'server-only';
import {kvRaw,kvConfigured} from './rfp-store';
/** EVAL_RO projects only the approved fields inside Redis. No lazy-healing accessors. */
const SCRIPT=String.raw`
local rows={accounts={},projects={},opportunities={},connections={},attempts={},access_requests={}}
local function decode(key) local raw=redis.call('GET',key);if not raw then return nil end;local ok,p=pcall(cjson.decode,raw);if ok then return p end;return nil end
local function each(pattern,work) local cursor='0';repeat local page=redis.call('SCAN',cursor,'MATCH',pattern,'COUNT',200);cursor=page[1];for _,key in ipairs(page[2]) do work(key) end until cursor=='0' end
for _,member in ipairs(redis.call('SMEMBERS','auth:index:signups')) do local role,email=string.match(member,'^([^:]+):(.+)$');if email then table.insert(rows.accounts,{email=email,role=role,verified=true,created_at=cjson.null}) end end
each('auth:pending:*',function(key) local p=decode(key);if p and p.email then table.insert(rows.access_requests,{email=p.email,purpose='legacy_access_review',created_at=p.created or cjson.null,project_id=cjson.null,verified=false}) end end)
each('auth:magic:*',function(key) local p=decode(key);if p and p.email then table.insert(rows.access_requests,{email=p.email,purpose='legacy_email_verification',created_at=p.created or cjson.null,project_id=p.rfp_id or cjson.null,verified=false}) end end)
each('rfp:*',function(key) if string.match(key,'^rfp:[%w_-]+$') then local p=decode(key);if p and p.id then
 local requirements=(p.requirement_text and #p.requirement_text>0) or (p.requirements and type(p.requirements)=='string' and #p.requirements>0) or (p.rfp_sections and #p.rfp_sections>0) or (p.engine and p.engine.requirement~=nil) or false
 table.insert(rows.projects,{id=p.id,email=p.owner_email or '',created_at=p.created or cjson.null,last_activity=p.updated or cjson.null,status=p.status or 'not_recorded',phase=p.phase or 'not_recorded',requirements=requirements,test=p.test==true,classification=p.activity and p.activity.classification and p.activity.classification.value or 'unclassified',source=p.journey and p.journey.source or p.entrance_context and p.entrance_context.source or p.source or 'not_recorded'})
 local cs=decode(key..':connections');if cs then for _,c in ipairs(cs) do table.insert(rows.connections,{project_id=p.id,created_at=c.created or cjson.null}) end end
 end end end)
each('opp:*',function(key) if string.match(key,'^opp:[%w_-]+$') then local p=decode(key);if p then table.insert(rows.opportunities,{id=p.id or key,email=p.owner_email or p.buyer_email or '',source_rfp_id=p.source_rfp_id or cjson.null,created_at=p.created or cjson.null,status=p.status or 'not_recorded',test=p.test==true}) end end end)
local cursor='0';repeat local page=redis.call('SCAN',cursor,'MATCH','auth:access:v1:production:*','COUNT',200);cursor=page[1];for _,key in ipairs(page[2]) do table.insert(rows.attempts,{day=string.sub(key,-10),counters=redis.call('HGETALL',key)}) end until cursor=='0'
return cjson.encode(rows)`;
export async function legacyOwnerRecords(){if(!kvConfigured())return {available:false,reason:'Legacy storage is not configured',accounts:[],projects:[],opportunities:[],connections:[],attempts:[]};const raw=await kvRaw(['EVAL_RO',SCRIPT,0]);if(typeof raw!=='string')throw Error('legacy_projection_unavailable');return {available:true,...JSON.parse(raw),limitations:['Legacy sign-up index does not retain original sign-up dates.','Session creation is not a complete last-activity history.','Unclassified historical records are not asserted to be real buyers.']};}
