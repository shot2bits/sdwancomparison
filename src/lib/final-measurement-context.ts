import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import {sessionFromRequest} from './auth';
import {platformOwner,finalEnabled} from './final-platform-flags';
import {buyerCoreSmokeAllowed} from './core-launch-smoke';
const contexts=new AsyncLocalStorage<{owner:boolean;crawler:boolean;fixture:boolean}>();
export const trustedMeasurementContext=()=>contexts.getStore();
export async function withTrustedMeasurement<T>(request:Request,work:()=>Promise<T>):Promise<T>{if(!finalEnabled('funnel')||request.method==='GET'||!new URL(request.url).pathname.includes('/core'))return work();const s=await sessionFromRequest(request);return contexts.run({owner:s?.email.toLowerCase()===platformOwner(),crawler:/bot|crawler|spider|Netify.*(?:test|verification)|HeadlessChrome/i.test(request.headers.get('user-agent')??''),fixture:await buyerCoreSmokeAllowed(request)},work);}
