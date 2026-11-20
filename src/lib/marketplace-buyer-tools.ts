import {z} from 'zod';
import {defineMarketTool,MarketError,RFP_INPUT_SCHEMA,type MarketTool,type MarketContext} from './marketplace-mcp';
import {requestAccessCode,verifyAccessCode,authenticate,publishOpportunity,PublishArgs,listMine,withdrawOpportunity,bundleFor,revokeToken,type Identity} from './agent-access';

const tokenField={access_token:z.string().max(120).optional().describe('Token from verify_access_code. Optional if you send it as a Bearer header.')};
const wrap=(data:unknown)=>({publisher:'Netify',contract_version:'netify-marketplace-tools/1-20261120',generated_at:new Date().toISOString(),data});
export const identityFrom=(args:{access_token?:string},ctx:MarketContext):Promise<Identity>=>authenticate(args.access_token??ctx.token);
const emailSchema=z.object({email:z.string().max(254)}).strict();
const verifySchema=z.object({email:z.string().max(254),code:z.string().max(12)}).strict();
const mineSchema=z.object({...tokenField}).strict();
const oppSchema=z.object({...tokenField,opportunity_id:z.string().max(60)}).strict();
const publishSchema=z.object({...tokenField,...PublishArgs.shape}).strict();
const bundleSchema=z.object({...tokenField,opportunity_id:z.string().max(60),format:z.enum(['json','markdown']).default('markdown')}).strict();

export const BUYER_MARKET_TOOLS:MarketTool[]=[
 defineMarketTool('request_access_code','Email me a verification code','Step 1 of verified access. Sends a one-time code to a business email address. Free webmail such as Gmail, Outlook, Hotmail, Yahoo and iCloud is rejected. Rate limited.',emailSchema,async(a,ctx)=>wrap(await requestAccessCode(a.email,ctx.ip)),'open',false),
 defineMarketTool('verify_access_code','Verify the code and get an access token','Step 2 of verified access. Exchange the six digit code for an access_token (valid 30 days) that your assistant passes to the tools below. Keep the token private.',verifySchema,async a=>{const r=await verifyAccessCode(a.email,a.code);return wrap({access_token:r.token,email:r.email,expires_in_days:r.expires_in_days,use:'Pass access_token to publish_opportunity, list_my_opportunities, get_rfp_bundle and withdraw_opportunity, or send it as an Authorization: Bearer header.'});},'open',false),
 defineMarketTool('publish_opportunity','Publish a requirement to the opportunity board','Publishes your requirement to the public Netify opportunity board and makes it available to Netify\'s curated providers. Needs a verified work email and consent_publish true. The public board is anonymised by default (no names, emails, phone numbers, company or exact addresses). Set show_company true, with company_name, only if you want your company shown publicly. Limited to five a day.',publishSchema,async(a,ctx)=>{const {access_token:_t,...rest}=a;void _t;return wrap(await publishOpportunity(await identityFrom(a,ctx),rest as never));},'buyer',false),
 defineMarketTool('list_my_opportunities','List my published requirements','Lists the requirements published by your verified email, with status, whether they are publicly listed and how many provider responses they have.',mineSchema,async(a,ctx)=>wrap(await listMine(await identityFrom(a,ctx))),'buyer'),
 defineMarketTool('get_rfp_bundle','Get my RFP and recommended providers','Returns the RFP document and the recommended-providers pack as one bundle for a requirement you have published. Needs a verified work email.',bundleSchema,async(a,ctx)=>{const b=await bundleFor(await identityFrom(a,ctx),a.opportunity_id);return wrap(a.format==='json'?{...b,markdown:undefined}:{opportunity_id:b.opportunity_id,markdown:b.markdown,recommended_providers:b.recommended_providers});},'buyer'),
 defineMarketTool('withdraw_opportunity','Withdraw a published requirement','Closes one of your requirements and removes it from the public board.',oppSchema,async(a,ctx)=>wrap(await withdrawOpportunity(await identityFrom(a,ctx),a.opportunity_id)),'buyer',false),
 defineMarketTool('revoke_access_token','Revoke my access token','Invalidates the access token immediately.',mineSchema,async(a,ctx)=>wrap(await revokeToken(await identityFrom(a,ctx))),'buyer',false),
];
export {RFP_INPUT_SCHEMA,MarketError};
