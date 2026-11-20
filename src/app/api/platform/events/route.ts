import {z} from 'zod';
import {coreDatabase,readCoreProject,CoreError,sha} from '@/lib/core-phase1';
import {coreEnvironment} from '@/lib/core-host';
import {identityRate} from '@/lib/core-identity';
import {sessionFromRequest} from '@/lib/auth';
import {recordFinalEvent} from '@/lib/final-funnel';
import {finalEnabled,platformOwner} from '@/lib/final-platform-flags';
import {privateHeaders} from '@/lib/final-owner';
const Input=z.object({project_id:z.string().uuid(),event:z.enum(['provider_assessment_viewed','rfp_generated','rfp_exported']),operation_id:z.string().uuid()}).strict();
export async function POST(req:Request){try{if(!finalEnabled('funnel'))throw new CoreError(404,'not_enabled');if(req.headers.get('origin')!==new URL(req.url).origin)throw new CoreError(403,'same_origin_required');const a=Input.parse(await req.json()),cap=(req.headers.get('authorization')??'').replace(/^Bearer /,'');await readCoreProject(a.project_id,cap);await identityRate('measurement:'+sha(cap),120);const p=(await coreDatabase().query('SELECT disposable_fixture FROM netify_core_phase1.projects WHERE id=$1',[a.project_id]))[0],s=await sessionFromRequest(req);await recordFinalEvent(a.event,a.project_id,a.operation_id,{actor:a.project_id,owner:s?.email.toLowerCase()===platformOwner(),fixture:p.disposable_fixture,environment:coreEnvironment(),source:'web',crawler:/bot|crawler|spider|headless|playwright/i.test(req.headers.get('user-agent')??'')});return Response.json({recorded:true},{headers:privateHeaders});}catch(e:any){return Response.json({error:e.code??'event_not_recorded'},{status:e.status??422,headers:privateHeaders});}}
