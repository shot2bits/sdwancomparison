import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {coreDatabase,saveCoreProject,sha} from '../src/lib/core-phase1';
const sql=coreDatabase(),id='508d8a7d-accf-44b9-bc3b-5ec1954cf7bd';
const rows=await sql.query('SELECT p.current_revision,p.last_activity_at,p.expires_at,r.snapshot FROM netify_core_phase1.projects p JOIN netify_core_phase1.scope_revisions r ON r.project_id=p.id AND r.revision=p.current_revision WHERE p.id=$1',[id]);
assert.equal(rows.length,1);const row=rows[0],snapshot=typeof row.snapshot==='string'?JSON.parse(row.snapshot):row.snapshot;
const edit=randomBytes(32).toString('base64url');await sql.query("INSERT INTO netify_core_phase1.capabilities(token_hash,project_id,authority) VALUES($1,$2,'edit')",[sha(edit),id]);
const cases=[['record', (s:any)=>s.estate.sites.push({...s.estate.sites[0],id:'over-limit'})],['field',(s:any)=>s.estate.sites[0].notes='x'.repeat(20001)],['UTF-8 byte',(s:any)=>{for(const site of s.estate.sites)site.notes='🌏'.repeat(4000);}]] as const;
for(const [name,change]of cases){const over=structuredClone(snapshot);change(over);if(name==='UTF-8 byte')assert(Buffer.byteLength(JSON.stringify(over))>5000000);await assert.rejects(()=>saveCoreProject(id,edit,over,row.current_revision,randomUUID()));const after=(await sql.query('SELECT current_revision,last_activity_at,expires_at FROM netify_core_phase1.projects WHERE id=$1',[id]))[0];assert.deepEqual(after,{current_revision:row.current_revision,last_activity_at:row.last_activity_at,expires_at:row.expires_at});console.log('PASS '+name+' overflow rejected: no truncation, revision or retention change');}
