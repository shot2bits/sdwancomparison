import assert from 'node:assert/strict';
import {authorizeBuyingWorkspace} from '../src/lib/buying-workspace-policy';
import type {ConversationActor} from '../src/lib/project-conversation-policy';
const now=Date.now(),access={projectId:'project',tenantId:'tenant',buyerSubject:'buyer',approvedProviders:['alpha'],agentSubjects:['agent']};
const actor:ConversationActor={subject:'buyer',tenantId:'tenant',projectId:'project',role:'buyer',verifiedWorkIdentity:true,audience:'netify-project-api',scopes:['buying:read','buying:write'],expiresAt:now+10000};
assert(authorizeBuyingWorkspace(actor,access,'buying:read'));assert(authorizeBuyingWorkspace(actor,access,'buying:write',true));assert.throws(()=>authorizeBuyingWorkspace(actor,access,'buying:write',false));
for(const bad of [null,{...actor,role:'supplier' as const,provider:'alpha'},{...actor,tenantId:'other'},{...actor,projectId:'other'},{...actor,subject:'other'},{...actor,audience:'microsoft-graph'},{...actor,expiresAt:NaN},{...actor,expiresAt:now-1},{...actor,scopes:[]}])assert.throws(()=>authorizeBuyingWorkspace(bad,access,'buying:read'));
assert(authorizeBuyingWorkspace({...actor,role:'agent',subject:'agent'},access,'buying:write',true));assert.throws(()=>authorizeBuyingWorkspace({...actor,role:'agent',subject:'unapproved-agent'},access,'buying:write',true));
console.log('PASS: private buying tools are owner/delegated-agent only, tenant/project/audience/expiry scoped, and consent-gated for writes. Supplier and unapproved agent access rejected.');
