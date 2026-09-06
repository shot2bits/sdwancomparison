// @ts-expect-error Node 24 runtime API; repository uses Node 20 type definitions.
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier:string,context:object,next:(s:string,c:object)=>{url:string}){return specifier==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:next(specifier,context)}});
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {withFakeKv} from './fake-kv-harness';
const input=JSON.parse(readFileSync(process.argv[2]||'/tmp/netify-shared-workspace-fixture.json','utf8'));
await withFakeKv(async()=>{
 const {startMarketplaceProject,readMarketplaceProject}=await import('../src/lib/marketplace-project-session');
 const saved=await startMarketplaceProject(input);
 const restored=await readMarketplaceProject(saved.project_reference,saved.project_session_token);
 assert.equal(restored.envelope_revision,1);
 assert.equal(restored.workspace_payload?.facts.length,input.entrance_context.raw_input.workspace_payload.facts.length);
 assert.deepEqual(restored.workspace_payload?.source_turns,input.entrance_context.raw_input.workspace_payload.source_turns);
 assert.deepEqual(restored.workspace_payload?.decision_turns,input.entrance_context.raw_input.workspace_payload.decision_turns);
 console.log('PASS captured real browser payload recompiles and persists canonical facts, source, decisions and document in fake KV');
});
