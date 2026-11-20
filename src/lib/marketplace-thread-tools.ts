import {z} from 'zod';
import {defineMarketTool,MarketError,type MarketTool} from './marketplace-mcp';
import {identityFrom} from './marketplace-buyer-tools';
import {listResponses,listThreads,readThread,startOrReply,requestExpertHelp} from './agent-threads';

const tokenField={access_token:z.string().max(120).optional().describe('Token from verify_access_code. Optional if you send it as a Bearer header.')};
const wrap=(data:unknown)=>({publisher:'Netify',contract_version:'netify-marketplace-tools/1-20261120',generated_at:new Date().toISOString(),data});
const oppId=z.string().max(60);
const threadId=z.string().max(60);

export const THREAD_MARKET_TOOLS:MarketTool[]=[
 defineMarketTool('list_responses','List provider responses to my requirement','Lists the responses providers have posted to a requirement you published, with any pricing, evidence links and answers, plus your conversations with providers and the Netify team. Needs a verified work email.',
  z.object({...tokenField,opportunity_id:oppId}).strict(),async(a,ctx)=>wrap(await listResponses(await identityFrom(a,ctx),a.opportunity_id)),'buyer'),
 defineMarketTool('list_threads','List my conversations','Lists your conversations with providers and the Netify team, newest first, and whether each is waiting for your reply.',
  z.object({...tokenField,opportunity_id:oppId.optional()}).strict(),async(a,ctx)=>wrap(await listThreads(await identityFrom(a,ctx),a.opportunity_id)),'buyer'),
 defineMarketTool('read_thread','Read a conversation','Returns every message in one of your conversations, with the sender, time and whether a message to a provider was sent or held.',
  z.object({...tokenField,thread_id:threadId}).strict(),async(a,ctx)=>wrap(await readThread(await identityFrom(a,ctx),a.thread_id)),'buyer'),
 defineMarketTool('send_message','Message a provider or the Netify team','Replies in an existing conversation with thread_id, or starts one with opportunity_id and either to "netify_team" or a provider_slug. You can message a provider once Netify has invited it to your requirement or it has responded. Providers read your message as written and reply from an emailed link with no sign-in, so leave out names and contact details unless you want the provider to see them. Messages to providers are held until provider messaging is switched on.',
  z.object({...tokenField,thread_id:threadId.optional(),opportunity_id:oppId.optional(),to:z.enum(['provider','netify_team']).optional(),provider_slug:z.string().max(80).optional(),body:z.string().min(1).max(4000)}).strict()
   .refine(v=>v.thread_id||v.opportunity_id,{message:'Give thread_id to reply, or opportunity_id to start a conversation.'}),
  async(a,ctx)=>wrap(await startOrReply(await identityFrom(a,ctx),a)),'buyer',false),
 defineMarketTool('request_expert_help','Ask the Netify team for help','Sends a question to the Netify team, who reply in a conversation you can read with read_thread. Use it to ask for a provider to be added, to sense-check a requirement or to get help with responses. Limited to five a day.',
  z.object({...tokenField,question:z.string().min(1).max(4000),opportunity_id:oppId.optional()}).strict(),async(a,ctx)=>wrap(await requestExpertHelp(await identityFrom(a,ctx),a)),'buyer',false),
];
export {MarketError};
