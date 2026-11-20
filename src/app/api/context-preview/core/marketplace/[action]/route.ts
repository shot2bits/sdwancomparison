import {coreEnvironment} from '@/lib/core-host';
import {openPrivate} from '@/lib/core-identity';
import {z} from 'zod';
import {CoreError} from '@/lib/core-phase1';
import {requireFinalFlag} from '@/lib/final-platform-flags';
import {privateHeaders} from '@/lib/final-owner';
import {finalCommercial,verifiedCommercialOwner,buyerDisclosureIdentity,realSupplierTransport} from '@/lib/final-commercial-runtime';
import {supplierIsParticipating} from '@/lib/final-commercial';
import {platformStore} from '@/lib/final-platform-store';
import {measureCoreEvent} from '@/lib/final-measurement-hooks';
const Input=z.object({project_id:z.string().uuid(),receipt_id:z.string().uuid().optional(),document_id:z.string().uuid().optional(),request_id:z.string().uuid().optional(),preview_hash:z.string().length(64).optional(),suppliers:z.array(z.string().min(1).max(100)).max(30).optional(),disclosure:z.array(z.enum(['company','buyer_email','site_addresses'])).optional(),company:z.string().max(300).optional(),confirmed:z.boolean().optional(),supplier_id:z.string().max(100).optional(),message:z.string().max(20000).optional(),supersedes:z.string().uuid().nullable().optional()}).strict();
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request,ctx:{params:Promise<{action:string}>}){try{const {action}=await ctx.params;requireFinalFlag(['responses','prices','confirm-extraction','document'].includes(action)?'comparison':action==='clarify'?'intake':'dispatch');if(req.headers.get('origin')!==new URL(req.url).origin)throw new CoreError(403,'same_origin_required');const bytes=await req.text();if(bytes.length>64000)throw new CoreError(413,'request_too_large');const a=Input.parse(JSON.parse(bytes)),owner=await verifiedCommercialOwner(req,a.project_id);let data;
 if(action==='test-captures'){if(coreEnvironment()==='production')throw new CoreError(404,'action_unavailable');data={status:'captured_not_sent',captures:(await platformStore.list<any>('supplier_capture',a.project_id)).map(r=>({supplier_id:r.value.supplierId,payload:openPrivate(r.value.payloadCipher)}))};}
 else if(action==='catalogue'){data={suppliers:(await platformStore.list<any>('supplier')).filter(r=>supplierIsParticipating(r.value)).map(r=>({id:r.id,name:r.value.settings.name}))};}
 else if(action==='document'){if(!a.request_id||!a.supplier_id||!a.document_id)throw new CoreError(422,'document_details_required');data=await finalCommercial.buyerDocument(a.project_id,a.request_id,a.supplier_id,a.document_id);}
 else if(action==='prepare'){data=await finalCommercial.prepare(a.project_id,a.suppliers??[],a.disclosure??[],{...await buyerDisclosureIdentity(a.project_id,a.disclosure??[]),...a.company?{company:a.company}:{}},a.supersedes??null);await measureCoreEvent(a.project_id,'request_prepared',(data as any).request_id);}
 else if(action==='approve'){if(a.confirmed!==true||!a.request_id||!a.preview_hash)throw new CoreError(422,'confirm_exact_preview');data=await finalCommercial.approve(a.project_id,a.request_id,a.preview_hash,owner.ownerId);}
 else if(action==='send'){if(a.confirmed!==true||!a.request_id)throw new CoreError(422,'confirm_exact_request');data=await finalCommercial.send(a.project_id,a.request_id,owner.ownerId,realSupplierTransport);}
 else if(action==='reconcile-receipt'){if(!a.request_id||!a.supplier_id||!a.receipt_id)throw new CoreError(422,'delivery_receipt_required');data=await finalCommercial.reconcileReceipt(a.project_id,a.request_id,a.supplier_id,a.receipt_id,owner.ownerId,realSupplierTransport);}
 else if(action==='reconcile'){if(!a.request_id)throw new CoreError(422,'request_required');data=await finalCommercial.reconcile(a.project_id,a.request_id,realSupplierTransport);}
 else if(action==='responses')data=await finalCommercial.responses(a.project_id);
 else if(action==='prices')data=await finalCommercial.priceLines(a.project_id);
 else if(action==='confirm-extraction'){requireFinalFlag('comparison');if(!a.request_id||!a.supplier_id||a.confirmed!==true)throw new CoreError(422,'confirm_original_values');data=await finalCommercial.confirmExtraction(a.project_id,a.request_id,a.supplier_id,owner.ownerId);}
 else if(action==='clarify'){requireFinalFlag('intake');if(!a.request_id||!a.supplier_id)throw new CoreError(422,'request_required');data=await finalCommercial.clarify(a.project_id,a.request_id,a.supplier_id,a.message??'','buyer');}
 else throw new CoreError(404,'action_unavailable');return Response.json(data,{headers:privateHeaders});
 }catch(e:any){return Response.json({error:e.code??'operation_not_completed'},{status:e.status??422,headers:privateHeaders});}}
