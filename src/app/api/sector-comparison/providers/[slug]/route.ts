import {originalBuyerChecklist} from '@/lib/original-buyer-checklist';
import {loadSectorComparisonRecord} from '@/lib/sector-comparison-source';
import {prepareComparisonRecord,providerEvidenceFingerprint} from '@/lib/sector-comparison';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{const {slug}=await params;const record=await loadSectorComparisonRecord(slug);if(!record)return Response.json({error:'Provider not found.'},{status:404,headers});return Response.json({record:prepareComparisonRecord(record),buyer_checklist:originalBuyerChecklist(record.provider.slug,record.revision.dataset_version),evidence_fingerprint:providerEvidenceFingerprint(record)},{headers});}catch{return Response.json({error:'Provider research is temporarily unavailable. Please retry.'},{status:503,headers});}
}
