/** Server-only foundation for account-free, narrow thread access.
 * Persist hashes, never raw tokens. Deliver tokens only through a configured,
 * approved recipient channel. This module does not expose or deliver links.
 */
import 'server-only';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {authorizeConversation,type ConversationAccess,type ConversationActor} from './project-conversation-policy';
export type ThreadAccessRecord={id:string;tokenHash:string;projectId:string;tenantId:string;provider:string;issuedBy:string;expiresAt:number;revoked:boolean;consumedAt:number|null};
export interface ThreadAccessStore{
 put(record:ThreadAccessRecord):Promise<void>;
 /** Must atomically reject consumed, revoked or expired records and consume once. */
 consume(tokenHash:string,now:number):Promise<ThreadAccessRecord|null>;
}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function issueThreadAccess(actor:ConversationActor,access:ConversationAccess,provider:string,store:ThreadAccessStore,ttlMs=15*60*1000,now=Date.now()){
 authorizeConversation(actor,access,'conversations:read',provider,now);
 if(actor.role!=='buyer'||actor.subject!==access.buyerSubject||actor.verifiedWorkIdentity!==true)throw Error('verified_project_owner_required');
 if(!Number.isFinite(ttlMs)||ttlMs<60000||ttlMs>60*60*1000)throw Error('invalid_access_link_lifetime');
 const token=randomBytes(32).toString('base64url');
 const record:ThreadAccessRecord={id:randomUUID(),tokenHash:digest(token),projectId:access.projectId,tenantId:access.tenantId,provider,issuedBy:actor.subject,expiresAt:now+ttlMs,revoked:false,consumedAt:null};
 await store.put(record);
 return {token,expiresAt:record.expiresAt};
}
export async function redeemThreadAccess(token:string,store:ThreadAccessStore,access:ConversationAccess,now=Date.now()):Promise<ConversationActor>{
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('thread_link_unavailable');
 const record=await store.consume(digest(token),now);
 if(!record||record.revoked||!Number.isFinite(record.expiresAt)||record.expiresAt<=now||record.projectId!==access.projectId||record.tenantId!==access.tenantId||!access.approvedProviders.includes(record.provider))throw Error('thread_link_unavailable');
 // Possession opens only this thread. It does not verify company representation,
 // approve a request, or authorize delivery. Exchange server-side into a short
 // HttpOnly/Secure/SameSite session; never retain the raw link in browser storage.
 return {subject:'thread-guest:'+record.id,tenantId:record.tenantId,projectId:record.projectId,provider:record.provider,role:'supplier',verifiedWorkIdentity:false,audience:'netify-project-api',scopes:['conversations:read','messages:draft'],expiresAt:Math.min(record.expiresAt,now+15*60*1000)};
}
