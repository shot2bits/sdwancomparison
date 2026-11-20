/** Server-side authorization boundary for a future shared conversation transport.
 * Actor/grants must come from the trusted session/consent store, never MCP arguments.
 * This preview deliberately supplies no live delivery adapter or public private-project endpoint.
 */
import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
export type ConversationActor={subject:string;tenantId:string;role:'buyer'|'supplier'|'agent';projectId:string;provider?:string;verifiedWorkIdentity:boolean;audience:string;scopes:string[];expiresAt:number};
export type ConversationAccess={projectId:string;tenantId:string;buyerSubject:string;approvedProviders:string[];agentSubjects:string[]};
export function authorizeConversation(actor:ConversationActor|null,access:ConversationAccess,scope:'conversations:read'|'messages:draft'|'messages:send',provider:string,now=Date.now()){
 if(!actor||!['buyer','supplier','agent'].includes(actor.role)||!actor.subject||actor.audience!=='netify-project-api'||!Number.isFinite(actor.expiresAt)||actor.expiresAt<=now||actor.tenantId!==access.tenantId||actor.projectId!==access.projectId||!actor.scopes.includes(scope))throw Error('project_access_denied');
 if(!access.approvedProviders.includes(provider))throw Error('provider_not_approved');
 if(actor.role==='buyer'&&actor.subject!==access.buyerSubject||actor.role==='supplier'&&actor.provider!==provider||actor.role==='agent'&&!access.agentSubjects.includes(actor.subject))throw Error('thread_access_denied');
 if(scope==='messages:send'&&actor.verifiedWorkIdentity!==true)throw Error('verified_work_identity_required');
 return true;
}
const ApprovedRequestSchema=z.object({projectId:z.string().uuid(),projectRevision:z.number().int().min(0),recipients:z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(30),brief:z.string().max(200000),message:z.string().min(1).max(20000)}).strict();
export type ConversationRequest=z.infer<typeof ApprovedRequestSchema>;
export function requestFingerprint(raw:unknown){const p=ApprovedRequestSchema.parse(raw);if(new Set(p.recipients).size!==p.recipients.length)throw Error('duplicate_recipient');return createHash('sha256').update(JSON.stringify({...p,recipients:[...p.recipients].sort()})).digest('hex');}
export type SendApproval={subject:string;projectId:string;fingerprint:string;expiresAt:number;consumed:boolean};
export function authorizeApprovedRequest(actor:ConversationActor|null,access:ConversationAccess,raw:unknown,approval:SendApproval|null,currentRevision:number,now=Date.now()){
 const request=ApprovedRequestSchema.parse(raw),fingerprint=requestFingerprint(request);
 if(!actor||!approval||approval.consumed||approval.subject!==access.buyerSubject||actor.role==='supplier'||approval.projectId!==access.projectId||!Number.isFinite(approval.expiresAt)||approval.expiresAt<=now||approval.fingerprint!==fingerprint||request.projectId!==access.projectId||request.projectRevision!==currentRevision)throw Error('fresh_exact_request_approval_required');
 for(const provider of request.recipients)authorizeConversation(actor,access,'messages:send',provider,now);
 return {request,fingerprint};
}
export const projectConversationToolContracts=[
 {name:'read_project_conversations',scope:'conversations:read',readOnly:true,description:'Read only permitted provider threads for the authenticated project.'},
 {name:'draft_project_message',scope:'messages:draft',readOnly:false,description:'Draft a message linked to a requirement. Does not send.'},
 {name:'send_approved_project_request',scope:'messages:send',readOnly:false,description:'Requires verified identity, an exact unexpired buyer approval, current project revision, recipient authorization and a configured delivery adapter.'},
] as const;
/** Fail closed until a production transport and durable idempotency/outbox are configured. */
export function sendApprovedProjectRequest(actor:ConversationActor|null,access:ConversationAccess,request:unknown,approval:SendApproval|null,revision:number){authorizeApprovedRequest(actor,access,request,approval,revision);return {sent:false as const,error:'delivery_not_configured' as const};}
