/** Short-lived registry selection for the approved production smoke, not additional authority. */
import {coreDatabase,sha} from './core-phase1';
export async function buyerCoreSmokeAllowed(req:Request){
 if(process.env.VERCEL_ENV!=='production'||process.env.NETIFY_CORE_LIVE!=='1'||process.env.NETIFY_CORE_LEGACY_MCP!=='1')return false;
 const id=process.env.NETIFY_CORE_SMOKE_PROJECT??'',token=req.headers.get('x-netify-launch-capability')??'';
 if(!/^[a-f0-9-]{36}$/.test(id)||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;
 const rows=await coreDatabase().query("SELECT p.id FROM netify_core_phase1.projects p JOIN netify_core_phase1.capabilities c ON c.project_id=p.id WHERE p.id=$1 AND p.disposable_fixture=true AND p.environment='production' AND p.expires_at>clock_timestamp() AND c.token_hash=$2 AND c.authority='edit' AND c.revoked_at IS NULL",[id,sha(token)]);return rows.length===1;
}
