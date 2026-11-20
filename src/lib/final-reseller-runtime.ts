import 'server-only';
import {randomBytes} from 'node:crypto';
import {FinalReseller} from './final-reseller';
import {platformStore} from './final-platform-store';
import {coreDatabase,createCoreProject,sha,CoreError} from './core-phase1';
import {emptyCoreProject} from './core-buyer-tools';
import {sealPrivate,openPrivate,privateHash,validateWorkEmail,ownerStatus} from './core-identity';
import {parseCookie} from './auth';
import {finalEnabled} from './final-platform-flags';
export const finalReseller=new FinalReseller(platformStore,{
 async create(id){const edit=randomBytes(32).toString('base64url'),view=randomBytes(32).toString('base64url');await createCoreProject(emptyCoreProject(id),id,'https://netify.co.uk',{edit,view});return {editCipher:sealPrivate(edit)};},
 async grant(projectId,ownerId,token){await coreDatabase().query("INSERT INTO netify_core_phase1.capabilities(token_hash,project_id,authority,owner_id) VALUES($1,$2,'edit',$3)",[sha(token),projectId,ownerId]);},
 seal:sealPrivate,open:value=>String(openPrivate(value)),emailHash:email=>privateHash('email:'+validateWorkEmail(email)),
});
/** Verified server session, not a supplied role or organisation identifier. */
export async function verifiedCoreIdentity(req:Request){const session=parseCookie(req,'netify_core_owner')??'';if(!/^[A-Za-z0-9_-]{43}$/.test(session))throw new CoreError(403,'verify_your_work_email');const r=(await coreDatabase().query('SELECT s.project_id,s.owner_id,o.email_hash FROM netify_core_phase1.owner_sessions s JOIN netify_core_phase1.owners o ON o.id=s.owner_id WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp() AND s.revoked_at IS NULL',[sha(session)]))[0];if(!r||!(await ownerStatus(r.project_id,session)).owner)throw new CoreError(403,'verify_your_work_email');return {ownerId:r.owner_id,emailHash:r.email_hash,projectId:r.project_id};}
export async function guardFinalDelegation(projectId:string,capability:string){if(!capability.startsWith('reseller_'))return;if(!finalEnabled('reseller'))throw new CoreError(403,'reseller_access_not_enabled');await finalReseller.guardDelegate(projectId,capability);}
