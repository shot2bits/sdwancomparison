import assert from 'node:assert/strict';
import {authorizeConversation,authorizeApprovedRequest,requestFingerprint,sendApprovedProjectRequest,type ConversationActor} from '../src/lib/project-conversation-policy';
const id='20e65654-4301-428d-8c96-30ac49b894b9',now=Date.now(),access={projectId:id,tenantId:'tenant-a',buyerSubject:'owner',approvedProviders:['alpha','beta'],agentSubjects:['agent']};
const actor:ConversationActor={subject:'owner',tenantId:'tenant-a',projectId:id,role:'buyer',verifiedWorkIdentity:true,audience:'netify-project-api',scopes:['conversations:read','messages:send'],expiresAt:now+10000};
assert.equal(authorizeConversation(actor,access,'conversations:read','alpha'),true);
for(const bad of [null,{...actor,subject:'other'},{...actor,projectId:'other'},{...actor,audience:'microsoft-graph'},{...actor,expiresAt:now-1},{...actor,scopes:[]},{...actor,role:'supplier' as const,provider:'beta'}])assert.throws(()=>authorizeConversation(bad,access,'conversations:read','alpha'));
assert.throws(()=>authorizeConversation({...actor,verifiedWorkIdentity:false},access,'messages:send','alpha'));
const request={projectId:id,projectRevision:4,recipients:['alpha'],brief:'The exact brief',message:'The exact message'},approval={subject:'owner',projectId:id,fingerprint:requestFingerprint(request),expiresAt:now+10000,consumed:false};
assert.equal(authorizeApprovedRequest(actor,access,request,approval,4).request.brief,request.brief);
for(const req of [{...request,recipients:['beta']},{...request,brief:'changed'},{...request,message:'changed'},{...request,projectRevision:5}])assert.throws(()=>authorizeApprovedRequest(actor,access,req,approval,4));
assert.throws(()=>authorizeApprovedRequest(actor,access,request,{...approval,consumed:true},4));assert.throws(()=>authorizeApprovedRequest(actor,access,request,{...approval,subject:'other'},4));assert.throws(()=>requestFingerprint({...request,recipients:['alpha','alpha']}));
assert.deepEqual(sendApprovedProjectRequest(actor,access,request,approval,4),{sent:false,error:'delivery_not_configured'});
console.log('PASS: project/tenant audience, supplier thread isolation, scopes, expiry, identity, exact recipient/body/revision approval, replay marker and fail-closed delivery.');

assert.throws(()=>authorizeConversation({...actor,role:'unexpected' as ConversationActor['role']},access,'conversations:read','alpha'));
const agent={...actor,subject:'agent',role:'agent' as const};
assert.throws(()=>authorizeApprovedRequest(agent,access,request,{...approval,subject:'agent'},4));
assert.equal(authorizeApprovedRequest(agent,access,request,approval,4).request.projectId,id);
assert.throws(()=>authorizeApprovedRequest({...actor,role:'supplier',provider:'alpha'},access,request,approval,4));

assert.throws(()=>authorizeConversation({...actor,tenantId:"tenant-b"},access,"conversations:read","alpha"));
