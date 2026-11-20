import {randomUUID} from 'node:crypto';
import {sessionFromRequest} from '@/lib/auth';
import {identityRate} from '@/lib/core-identity';
import {recordFinalEvent} from '@/lib/final-funnel';
import {platformOwner,requireFinalFlag} from '@/lib/final-platform-flags';
import {coreEnvironment} from '@/lib/core-host';
import {buyerCoreSmokeAllowed} from '@/lib/core-launch-smoke';
import {privateHeaders} from '@/lib/final-owner';
export async function POST(req:Request){try{requireFinalFlag('funnel');if(req.headers.get('origin')!==new URL(req.url).origin)return new Response(null,{status:403});await identityRate('reseller-enquiry-start:'+(req.headers.get('x-forwarded-for')??'not_provided'),30);const body=await req.text();if(body.length>2000)return new Response(null,{status:413});const a=JSON.parse(body);if(!/^[A-Za-z0-9_-]{16,100}$/.test(a.id??''))return new Response(null,{status:422});const session=await sessionFromRequest(req);await recordFinalEvent('reseller_enquiry_started',null,a.id,{actor:session?.email??a.id,owner:session?.email===platformOwner(),fixture:await buyerCoreSmokeAllowed(req),source:'reseller',environment:coreEnvironment(),crawler:/bot|crawler|spider|Netify.*(?:test|verification)|HeadlessChrome/i.test(req.headers.get('user-agent')??'')});return Response.json({recorded:true,id:randomUUID()},{headers:privateHeaders});}catch{return Response.json({recorded:false},{status:503,headers:privateHeaders});}}
