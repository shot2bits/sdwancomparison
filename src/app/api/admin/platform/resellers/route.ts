import {z} from 'zod';
import {requirePlatformOwner,privateHeaders} from '@/lib/final-owner';
import {finalReseller} from '@/lib/final-reseller-runtime';
import {platformStore} from '@/lib/final-platform-store';
import {requireFinalFlag} from '@/lib/final-platform-flags';
const Input=z.discriminatedUnion('action',[
 z.object({action:z.literal('organisation'),id:z.string().uuid(),name:z.string().min(1).max(300),active:z.boolean()}).strict(),
 z.object({action:z.literal('member'),organisationId:z.string().uuid(),ownerId:z.string().uuid(),active:z.boolean(),projectRoles:z.record(z.string().uuid(),z.array(z.enum(['partner','supplier']))).default({})}).strict(),
 z.object({action:z.literal('commercial'),organisationId:z.string().uuid(),kind:z.enum(['agreement','entry','registration']),record:z.unknown()}).strict(),
]);
export async function GET(req:Request){try{await requirePlatformOwner(req,'reseller_settings_view');requireFinalFlag('reseller');return Response.json({organisations:await platformStore.list('organisation'),memberships:await platformStore.list('membership')},{headers:privateHeaders});}catch(e:any){return Response.json({error:e.code??'reseller_settings_unavailable'},{status:e.status??503,headers:privateHeaders});}}
export async function POST(req:Request){try{const owner=await requirePlatformOwner(req,'reseller_settings_change');requireFinalFlag('reseller');const text=await req.text();if(Buffer.byteLength(text)>64000)return Response.json({error:'request_too_large'},{status:413});const a=Input.parse(JSON.parse(text));let data;if(a.action==='organisation')data=await finalReseller.activate(a.id,a.name,owner.email,a.active);else if(a.action==='member'){const rows=await (await import('@/lib/core-phase1')).coreDatabase().query('SELECT id FROM netify_core_phase1.owners WHERE id=$1',[a.ownerId]);if(!rows.length)return Response.json({error:'verified_member_required'},{status:422,headers:privateHeaders});data=await finalReseller.member(a.organisationId,a.ownerId,a.active,a.projectRoles);}else data=await finalReseller.commercial(a.organisationId,a.record,a.kind);return Response.json(data,{headers:privateHeaders});}catch(e:any){return Response.json({error:e.code??'reseller_settings_not_saved'},{status:e.status??422,headers:privateHeaders});}}
