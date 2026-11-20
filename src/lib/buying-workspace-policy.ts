/** Private buying tools share the trusted project session boundary.
 * Definitions are not registered on the public MCP endpoint by this local preview.
 */
import 'server-only';
import type {ConversationActor,ConversationAccess} from './project-conversation-policy';
export function authorizeBuyingWorkspace(actor:ConversationActor|null,access:ConversationAccess,scope:'buying:read'|'buying:write',consent=false,now=Date.now()){
 if(!actor||actor.audience!=='netify-project-api'||actor.projectId!==access.projectId||actor.tenantId!==access.tenantId||!Number.isFinite(actor.expiresAt)||actor.expiresAt<=now||!actor.scopes.includes(scope))throw Error('buying_project_access_denied');
 if(actor.role==='buyer'?actor.subject!==access.buyerSubject:actor.role==='agent'?!access.agentSubjects.includes(actor.subject):true)throw Error('buying_owner_or_delegated_agent_required');
 if(scope==='buying:write'&&consent!==true)throw Error('explicit_buying_action_consent_required');
 return true;
}
export const buyingWorkspaceToolContracts=[
 {name:'read_buying_plans',scope:'buying:read',readOnly:true,description:'Read the authenticated buyer project’s versioned plans. Never expose competing bids to a supplier.'},
 {name:'compare_buying_plans',scope:'buying:read',readOnly:true,description:'Compare saved plans against current published provider research without changing the active project.'},
 {name:'save_buying_plan',scope:'buying:write',readOnly:false,description:'Save a validated immutable plan after explicit user approval.'},
 {name:'prepare_provider_evidence_question',scope:'buying:write',readOnly:false,description:'Prepare a question in the permitted provider draft. Never sends or changes research evidence.'},
 {name:'record_supplier_proposal',scope:'buying:write',readOnly:false,description:'Record unverified proposal data and its exact requirement basis. Retain previous versions.'},
 {name:'record_buying_decision',scope:'buying:write',readOnly:false,description:'Record buyer rationale, frozen requirements and evidence after explicit approval. Does not accept a contract.'},
 {name:'update_implementation_check',scope:'buying:write',readOnly:false,description:'Record buyer-reviewed implementation evidence without changing the original requirement.'},
 {name:'plan_renewal_review',scope:'buying:write',readOnly:false,description:'Plan a local renewal review. Calendar connection, reminders and supplier contact require separate explicit authorization.'},
] as const;
