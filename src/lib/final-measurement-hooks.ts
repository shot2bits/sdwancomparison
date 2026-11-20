import 'server-only';
import {trustedMeasurementContext} from './final-measurement-context';
import {coreDatabase} from './core-phase1';
import {privateHash} from './core-identity';
import {coreEnvironment} from './core-host';
import {platformOwner,finalEnabled} from './final-platform-flags';
import {recordFinalEvent,scopeTransitions,type FunnelEvent} from './final-funnel';
export async function measureCoreEvent(projectId:string,event:FunnelEvent,operation:string,source:'web'|'mcp'|'system'|'reseller'='web'){
 if(!finalEnabled('funnel'))return;const p=(await coreDatabase().query('SELECT p.disposable_fixture,o.email_hash FROM netify_core_phase1.projects p LEFT JOIN netify_core_phase1.owners o ON o.id=p.owner_id WHERE p.id=$1',[projectId]))[0];if(!p)return;
 const trusted=trustedMeasurementContext();const owner=trusted?.owner||p.email_hash===privateHash('email:'+platformOwner());
 if(owner||p.disposable_fixture)await coreDatabase().query("UPDATE netify_core_phase1.platform_events SET excluded=true,exclusion_reason=$2 WHERE project_id=$1 AND NOT excluded",[projectId,owner?'owner':'fixture']);
 await recordFinalEvent(event,projectId,operation,{actor:projectId,owner,fixture:p.disposable_fixture||!!trusted?.fixture,environment:coreEnvironment(),source,crawler:!!trusted?.crawler});
}
export async function measureCoreScope(projectId:string,before:any|null,after:any,operation:string,source:'web'|'mcp'){
 for(const event of [...scopeTransitions(before,after),...before?['scope_saved' as const]:[]])await measureCoreEvent(projectId,event,operation,source);
}
