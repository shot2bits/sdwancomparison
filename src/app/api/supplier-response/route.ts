import {z} from 'zod';
import {finalCommercial} from '@/lib/final-commercial-runtime';
import {requireFinalFlag} from '@/lib/final-platform-flags';
import {privateHeaders} from '@/lib/final-owner';
import {identityRate} from '@/lib/core-identity';
import {sha} from '@/lib/core-phase1';
const Input=z.discriminatedUnion('action',[
 z.object({action:z.literal('view')}).strict(),z.object({action:z.literal('quotation'),quotation:z.unknown()}).strict(),
 z.object({action:z.literal('document'),document:z.object({name:z.string(),mime:z.string(),base64:z.string().max(4000000)}).strict()}).strict(),
 z.object({action:z.literal('clarify'),message:z.string().max(20000)}).strict()]);
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){try{requireFinalFlag('intake');if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'same_origin_required'},{status:403,headers:privateHeaders});const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'');await identityRate('supplier-response:'+sha(token),100);const text=await req.text();if(Buffer.byteLength(text)>4_500_000)return Response.json({error:'request_too_large'},{status:413,headers:privateHeaders});const a=Input.parse(JSON.parse(text));let value;
 if(a.action==='view')value=await finalCommercial.supplierView(token);else if(a.action==='quotation')value=await finalCommercial.submit(token,a.quotation);else if(a.action==='document')value=await finalCommercial.document(token,a.document);else {const own=await finalCommercial.supplierView(token);value=await finalCommercial.clarify(own.project_id,own.request_id,own.supplier_id,a.message,'supplier',token);}return Response.json(value,{headers:privateHeaders});}catch(e:any){return Response.json({error:e.code??'response_not_recorded'},{status:e.status??422,headers:privateHeaders});}}
