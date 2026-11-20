import {finalEnabled} from '@/lib/final-platform-flags';
import {platformStore} from '@/lib/final-platform-store';
import {supplierIsParticipating,type ParticipatingSupplier} from '@/lib/final-commercial';
export const dynamic='force-dynamic';
export async function GET(){if(!finalEnabled('status'))return Response.json({labels:[]},{headers:{'cache-control':'no-store'}});try{const rows=await platformStore.list<ParticipatingSupplier>('supplier');return Response.json({labels:rows.map(r=>({id:r.id,label:supplierIsParticipating(r.value)?'Participating supplier':'Researched provider'}))},{headers:{'cache-control':'no-store'}});}catch{return Response.json({error:'participation_status_unavailable',labels:[]},{status:503,headers:{'cache-control':'no-store'}});}}
