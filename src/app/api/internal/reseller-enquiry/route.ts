import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {platformOwner,requireFinalFlag} from '@/lib/final-platform-flags';
import {recordFinalEvent} from '@/lib/final-funnel';
import {queueOwnerNotification} from '@/lib/final-notifications';
import {privateHeaders} from '@/lib/final-owner';
import {platformStore} from '@/lib/final-platform-store';
import {sealPrivate} from '@/lib/core-identity';
import {coreEnvironment} from '@/lib/core-host';
const Input=z.object({reference:z.string().min(1).max(150),email:z.string().email(),at:z.string().datetime(),environment:z.enum(['production','development','preview']),fixture:z.boolean(),source:z.string().max(100)}).strict();
export async function POST(req:Request){try{requireFinalFlag('funnel');const key=process.env.NETIFY_RESELLER_EVENT_KEY;if(!key)return new Response(null,{status:503});const raw=await req.text();if(Buffer.byteLength(raw)>4000)return new Response(null,{status:413});const timestamp=req.headers.get('x-netify-time')??'',signature=req.headers.get('x-netify-signature')??'',expected=createHmac('sha256',key).update(timestamp+'.'+raw).digest('hex');if(!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>300000||signature.length!==64||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return new Response(null,{status:403});const a=Input.parse(JSON.parse(raw)),owner=a.email.toLowerCase()===platformOwner(),fixture=a.fixture||a.environment!=='production'||coreEnvironment()!=='production';await platformStore.change<any,boolean>('reseller_enquiry',a.reference,prior=>({value:prior??{emailCipher:sealPrivate(a.email),reference:a.reference,at:a.at,source:a.source,excluded:owner||fixture},result:!prior}));await recordFinalEvent('reseller_enquiry_sent',null,a.reference,{actor:a.email,owner,fixture,source:'reseller',environment:coreEnvironment(),crawler:false});if(!owner&&!fixture)await queueOwnerNotification('reseller_enquiry_sent',a.reference);return Response.json({recorded:true},{headers:privateHeaders});}catch{return Response.json({recorded:false},{status:503,headers:privateHeaders});}}
