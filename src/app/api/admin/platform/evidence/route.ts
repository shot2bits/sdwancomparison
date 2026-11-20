import {randomUUID} from 'node:crypto';
import {requirePlatformOwner,privateHeaders} from '@/lib/final-owner';
import {FinalEvidence} from '@/lib/final-evidence';
import {platformStore} from '@/lib/final-platform-store';
export async function POST(req:Request){try{await requirePlatformOwner(req,'publication_consent_recorded');const text=await req.text();if(Buffer.byteLength(text)>100000)return Response.json({error:'request_too_large'},{status:413});const a=JSON.parse(text);return Response.json(await new FinalEvidence(platformStore).record(a.id??randomUUID(),a.record),{headers:privateHeaders});}catch(e:any){return Response.json({error:e.code??'consent_record_not_saved'},{status:e.status??422,headers:privateHeaders});}}
