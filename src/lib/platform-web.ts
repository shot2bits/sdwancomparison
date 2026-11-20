import 'server-only';
import {withTrustedMeasurement} from './final-measurement-context';
import {coreLiveEnabled,coreCanonicalOrigin,coreOriginAllowed,coreEnvironment} from './core-host';
import {privateMailEnabled} from './core-mail';
import {finalEnabled} from './final-platform-flags';
import {serverResellerClient,disabledResellerClient,disabledWorkspaceMode} from './final-reseller-client';
import {finalWorkspaceClient} from './final-workspace-client';
import {honestPlatformStatus,finalPlatformClient} from './final-public-status';
import {withPlatformLoading,platformLoadingScript} from './platform-loading';
import {isIndexableLanding,withIndexableLanding} from './marketplace-landing-seo';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {contextPreviewHandler} from '../../scripts/context-space-preview';
/** Serve the existing platform source. No replacement design or duplicated application. */
export async function platformWeb(request:Request){
 const u=new URL(request.url),assetPrefix='/marketplace/assets/',relativePath=u.pathname.replace(/^\/sase(?=\/)/,''),isAsset=relativePath.startsWith('/marketplace/assets/'),rawPath=isAsset?'/'+relativePath.slice('/marketplace/assets/'.length):relativePath.replace(/^\/marketplace(?=\/|$)/,'/locations'),raw=rawPath.startsWith('/api/context-preview')?rawPath.replace(/\/$/,''):rawPath;
 if(!process.env.VERCEL_ENV||process.env.VERCEL_ENV==='preview'||coreLiveEnabled()){
  if(!coreOriginAllowed(u.origin))return Response.json({error:'origin_not_allowed'},{status:403});
  if(isAsset&&raw==='/platform-loading.js')return new Response(platformLoadingScript,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow'}});
  if(isAsset&&raw==='/final-workspace.js')return new Response(finalWorkspaceClient,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'private, no-store'}});
  if(isAsset&&raw==='/final-platform.js')return new Response(finalPlatformClient,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow'}});
  const landing=isIndexableLanding(raw,u.search,request.method),production=process.env.VERCEL_ENV==='production';
  const servingOrigin=coreCanonicalOrigin(u.origin);
  const bytes=request.method==='GET'||request.method==='HEAD'?null:new Uint8Array(await request.arrayBuffer());if(bytes&&bytes.byteLength>5_000_000)return Response.json({error:'request_too_large'},{status:413});
  const req=Object.assign(Readable.from(bytes?[Buffer.from(bytes)]:[]),{method:request.method,url:raw+u.search,headers:{...Object.fromEntries(request.headers),host:new URL(servingOrigin).host},socket:{remoteAddress:request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'platform-adapter'}}) as unknown as IncomingMessage;
  let status=200;const headers=new Headers(),chunks:Buffer[]=[];
  const res={setHeader:(k:string,v:any)=>{headers.set(k,String(v));return res;},writeHead:(code:number,values?:Record<string,string>)=>{status=code;for(const [k,v]of Object.entries(values??{}))headers.set(k,v);return res;},write:(b:any)=>{chunks.push(Buffer.from(b));return true;},end:(b?:any)=>{if(b!==undefined)chunks.push(Buffer.from(b));}} as unknown as ServerResponse;
  await withTrustedMeasurement(request,()=>contextPreviewHandler(req,res,servingOrigin));let output=Buffer.concat(chunks);
  if(isAsset||raw==='/locations/'||raw==='/locations'){
   const type=headers.get('content-type')??'';
   if(type.includes('text/html')||type.includes('javascript')||type.includes('text/css')){
    let text=output.toString('utf8');if(isAsset&&raw==='/partner-workspace.js')text=finalEnabled('reseller')?serverResellerClient(text):disabledResellerClient;if(isAsset&&raw==='/workspace-mode.js'&&!finalEnabled('reseller'))text=disabledWorkspaceMode(text);if(isAsset&&raw==='/core-identity.js')text="import {mountFinalWorkspace} from './final-workspace.js';\n"+text.replace('queueMicrotask(()=>mountCoreDesk(workspace,core))','queueMicrotask(()=>{mountCoreDesk(workspace,core);mountFinalWorkspace(workspace,core);})');if(finalEnabled('status'))text=honestPlatformStatus(text);text=text.replaceAll('/api/context-preview','/sase/api/context-preview').replaceAll("'/locations/","'/marketplace/").replaceAll('"/locations/','"/marketplace/');
    if(type.includes('text/html'))text=text.replace('<html','<html data-final-agents="'+finalEnabled('agents')+'" data-final-dispatch="'+finalEnabled('dispatch')+'" data-final-comparison="'+finalEnabled('comparison')+'" data-final-reseller="'+finalEnabled('reseller')+'" data-final-status="'+finalEnabled('status')+'" data-final-funnel="'+finalEnabled('funnel')+'"').replace('</body>','<script defer src="/marketplace/assets/final-platform.js"></script></body>');
    if(isAsset&&raw==='/client.js'){text=text.replace('projectView=data;projectPending=false;',"projectView=data;projectPending=false;window.dispatchEvent(new CustomEvent('netify:rfp-generated'));").replace("projectStatus('Private draft downloaded. No requirement has been published or sent.');","window.dispatchEvent(new CustomEvent('netify:rfp-exported'));projectStatus('Private draft downloaded. No requirement has been published or sent.');");text=text.replaceAll("location.pathname.startsWith(path)","location.pathname.replace(/^\\/sase(?=\\/)/,'').replace(/^\\/marketplace(?=\\/|$)/,'/locations').startsWith(path)");text=text.replaceAll("location.pathname.replace(/\\/$/,'')", "location.pathname.replace(/^\\/sase(?=\\/)/,'').replace(/^\\/marketplace(?=\\/|$)/,'/locations').replace(/\\/$/,'')");}
    if(type.includes('text/html'))text=withPlatformLoading(text.replace('<html','<html data-core-environment="'+coreEnvironment()+'" data-core-mail-enabled="'+String(privateMailEnabled())+'" data-core-desk-enabled="'+String(process.env.NETIFY_CORE_DESK_ENABLED==='1')+'" data-bot-protection="'+(process.env.VERCEL?'vercel':'off')+'"'));
    if(type.includes('text/html'))text=text.replace(/(src|href)="\/(?!sase\/|marketplace\/|\/|https?:)([^"?#]+\.(?:js|css))("|\?)/g,'$1="'+assetPrefix+'$2$3');
    if(type.includes('text/html')&&landing)text=withIndexableLanding(text,production);
    output=Buffer.from(text);
   }
  }
  headers.delete('content-length');headers.set('cache-control','private, no-store');headers.set('x-robots-tag',landing&&production&&status===200?'index, follow':'noindex, nofollow');headers.set('referrer-policy','no-referrer');return new Response(output,{status,headers});
 }
 return Response.json({error:'platform_release_not_enabled'},{status:503,headers:{'cache-control':'no-store'}});
}
