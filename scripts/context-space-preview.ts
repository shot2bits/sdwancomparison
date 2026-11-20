import {coreOriginAllowed,coreEnvironment} from '../src/lib/core-host';
import {identityRate} from '../src/lib/core-identity';
import {buyerMcpResponse} from '../src/lib/core-buyer-mcp';
import {coreIdentityHttp} from './context-identity-http';
import {corePhase1Http} from './context-core-http';
import {estatePlanningRpc} from './context-estate-mcp';
import {pricingWorkflowHttp,pricingWorkflowMcp,pricingSupplierHttp,procurementWorkflowHttp} from './context-pricing-workflow';
import {mockupSupplierDirectory} from '../src/lib/mockup-supplier-directory';
import {partnerPreviewAction,partnerPreviewCookie} from './context-partner-preview';
import {previewPricingAction} from '../src/lib/pricing-preview';
/** Local preview with isolated development project storage. Never contacts suppliers. */
import {existingAIStatus} from './context-existing-ai';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {loadSectorComparisonRecords,loadSectorComparisonRecord} from '../src/lib/sector-comparison-source';
import {contextCatalogue,compareContextProviders,contextDecisionPackMarkdown} from '../src/lib/context-comparison-preview';
import {prepareComparisonRecord,type PublishedProvider} from '../src/lib/sector-comparison';
import {fullResearchAppendixMarkdown} from '../src/lib/sector-research-appendix';
import {buildContextProject,projectQuestionCatalogue,ContextWorkspaceBackupSchema,ContextWorkingBackupSchema} from '../src/lib/context-project-preview';
import {originalBuyerChecklist} from '../src/lib/original-buyer-checklist';
import {saseExtendedQuestions} from '../src/lib/rfp-question-bank';
import {renderRfpDocx} from '../src/lib/rfp-export-docx';
const port=Number(process.env.CONTEXT_PREVIEW_PORT??3017),defaultOrigin='http://127.0.0.1:'+port;
const root=resolve('preview/context-space');
let locationImports=0;
let cache:{providers:PublishedProvider[];unavailable:string[];at:number}|null=null;
let pending:Promise<{providers:PublishedProvider[];unavailable:string[];at:number}>|null=null;
async function records(){if(cache&&Date.now()-cache.at<300000)return cache;if(!pending)pending=loadSectorComparisonRecords().then(r=>(cache={...r,at:Date.now()})).finally(()=>{pending=null;});return pending;}
function send(res:ServerResponse,status:number,data:unknown,type='application/json; charset=utf-8'){
 res.writeHead(status,{'content-type':type,'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer'});res.end(typeof data==='string'||data instanceof Uint8Array?data:JSON.stringify(data));}
function streamDocument(res:ServerResponse,data:string|Uint8Array,type:string){res.writeHead(200,{'content-type':type,'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer'});const bytes=typeof data==='string'?Buffer.from(data):Buffer.from(data);for(let n=0;n<bytes.length;n+=65536)res.write(bytes.subarray(n,n+65536));res.end();}
async function body(req:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>5000000)throw Error('Request exceeds 5,000,000 bytes. Nothing was shortened.');chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

export async function contextPreviewHandler(req:IncomingMessage,res:ServerResponse,origin=defaultOrigin,renderEntrance?:(providers:PublishedProvider[],unavailable:string[])=>string){
 try{
  const url=new URL(req.url??'/',origin);
  if(['/sase/api/mcp/','/sase/api/research-mcp/'].includes(url.pathname)){
   const chunks:Buffer[]=[];let bytes=0;for await(const c of req){const b=Buffer.from(c);bytes+=b.length;if(bytes>1000000){send(res,413,{error:'mcp_request_too_large'});return;}chunks.push(b);}
   const h=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)h.set(k,Array.isArray(v)?v.join(','):v);
   const request=new Request(origin+url.pathname,{method:req.method,headers:h,...(req.method==='POST'?{body:Buffer.concat(chunks).toString('utf8')}:{})});
   const answer=await buyerMcpResponse(request,{},url.pathname.includes('research-mcp'));res.writeHead(answer.status,Object.fromEntries(answer.headers));res.end(Buffer.from(await answer.arrayBuffer()));return;
  }
  if(await coreIdentityHttp(req,res,url,origin))return;
  if(await corePhase1Http(req,res,url,origin))return;
  if(url.pathname==='/api/context-preview/qa-timing'&&req.method==='POST'&&req.headers.origin===origin&&process.env.NETIFY_CORE_ENABLED==='1'){const m=await body(req);if(['load','save','export_docx','export_markdown'].includes(m.action)&&['iab','safari'].includes(m.browser)&&typeof m.projectId==='string'&&/^[a-f0-9-]{36}$/.test(m.projectId)&&Number.isFinite(m.ms))console.log('PHASE1B_QA '+JSON.stringify({action:m.action,browser:m.browser,projectId:m.projectId,ms:m.ms,requestBytes:m.requestBytes,outputBytes:m.outputBytes}));send(res,200,{recorded:true});return;}
  if(['/api/context-preview/pricing-workflow','/api/context-preview/pricing-supplier','/api/context-preview/pricing-mcp','/api/context-preview/procurement'].includes(url.pathname)){
   if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host??'')||req.headers.origin&&![origin,'http://localhost:'+port].includes(req.headers.origin)){send(res,403,{error:'Local private pricing origin required.'});return;}
   if(req.method!=='POST'){send(res,405,{error:'Authenticated POST required. No public pricing or private project discovery.'});return;}
   if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'JSON required.'});return;}
   try{const input=await body(req),auth=req.headers.authorization??'',result=url.pathname.endsWith('/procurement')?await procurementWorkflowHttp(auth,input):url.pathname.endsWith('/pricing-mcp')?await pricingWorkflowMcp(auth,input):url.pathname.endsWith('/pricing-supplier')?await pricingSupplierHttp(auth,input):await pricingWorkflowHttp(auth,input);res.setHeader('mcp-protocol-version','2025-06-18');send(res,result===null?202:200,result??'');}catch(e){send(res,403,{publisher:'Netify',environment:'test',error:e instanceof Error?e.message:'private_pricing_action_denied'});}return;
  }
  const partnerLanding={'/resell/sase/':'sase','/resell/sd-wan/':'sdwan','/resell/programme/':'programme'} as const;
  if((url.pathname.startsWith('/partners')||url.pathname==='/api/context-preview/partners'||url.searchParams.has('partner_project'))&&![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host??'')){send(res,403,{error:'Local workspace host required.'});return;}
  if(req.method==='GET'&&(Object.hasOwn(partnerLanding,url.pathname)||url.pathname==='/partners/')){res.writeHead(302,{location:'/locations/?workspace=partner','cache-control':'no-store'});res.end();return;}
  if(req.method==='POST'&&url.pathname==='/api/context-preview/partners'){
   if(![origin,'http://localhost:'+port].includes(req.headers.origin??'')||!req.headers['content-type']?.startsWith('application/json')){send(res,403,{error:'Use the local partner workspace.'});return;}
   try{send(res,200,await partnerPreviewAction(req.headers.cookie??'',await body(req)));}catch(e){send(res,403,{error:e instanceof Error?e.message:'Partner action unavailable.'});}return;
  }
  let partnerProject='';
  if(req.method==='GET'&&url.searchParams.has('partner_project')){
   partnerProject=url.searchParams.get('partner_project')??'';
   if(!/^[-a-f0-9]{36}$/.test(partnerProject)||url.pathname!=='/locations/'||url.searchParams.get('qa')!=='partner-'+partnerProject){send(res,400,{error:'Use the customer project link in the partner workspace.'});return;}
   try{const access=await partnerPreviewAction(req.headers.cookie??'',{action:'access',projectId:partnerProject}) as {allowed:boolean};if(!access.allowed)throw Error('Customer authorisation required.');}catch(e){send(res,403,{error:e instanceof Error?e.message:'Project unavailable.'});return;}
  }
  if(req.method==='POST'&&url.pathname==='/api/context-preview/pricing'){
   if(![origin,'http://localhost:'+port].includes(req.headers.origin??'')||!req.headers['content-type']?.startsWith('application/json')){send(res,403,{error:'Use the private local pricing preview.'});return;}
   try{send(res,200,previewPricingAction(await body(req)));}catch(e){send(res,400,{error:e instanceof Error?e.message:'Check the pricing fields. Nothing was sent.'});}return;
  }
  if(req.method==='POST'&&req.headers.origin&&![origin,'http://localhost:'+port].includes(req.headers.origin)){send(res,403,{error:'Origin not allowed.'});return;}
  if(url.pathname==='/api/context-preview/network-presence'&&req.method==='GET'){send(res,200,await readFile('data/network-presence/catalogue.json','utf8'));return;}
  if(url.pathname==='/api/context-preview/estate-mcp'&&req.method==='POST'){if(!coreOriginAllowed(origin)||!req.headers['content-type']?.startsWith('application/json')||(process.env.VERCEL_ENV&&req.headers.origin!==origin)){send(res,403,{error:'Same-origin JSON project snapshot required.'});return;}const input=await body(req);if(coreEnvironment()==='production'&&input?.params?.name==='get_ai_project_advice'){await identityRate('advisor:'+req.socket.remoteAddress,10);await identityRate('advisor:global',100);}send(res,200,await estatePlanningRpc(input,origin));return;}
  if(req.method==='GET'&&url.pathname==='/api/context-preview/location-ai-status'){send(res,200,process.env.CONTEXT_AI_SERVICE==='netify'?await existingAIStatus():{configured:Boolean(process.env.ANTHROPIC_API_KEY),mode:'local_provider'});return;}
  if(req.method==='POST'&&url.pathname==='/api/context-preview/location-import'){if(locationImports>=2){send(res,429,{error:'Two sources are already being read. Try again when one finishes.'});return;}locationImports++;try{send(res,200,await (await import('./context-location-import')).importLocations(await body(req)));}finally{locationImports--;}return;}
  if(req.method==='POST'&&url.pathname==='/api/context-preview/resolve-city'){const data=await body(req);if(typeof data.city!=='string'||!data.city.trim()||data.city.length>200||typeof data.country!=='string'||data.country.length>200)throw Error('Enter a city and optional country.');send(res,200,await (await import('./context-location-import')).resolveCity(data.city,data.country));return;}
  if(req.method==='POST'&&url.pathname==='/api/context-preview/business-brief'){send(res,200,await (await import('./context-business-helper')).draftBusinessBrief(await body(req)));return;}
  if(req.method==='GET'&&url.pathname==='/api/context-preview/marketplace-catalogue'){const source=await records();send(res,200,{publisher:'Netify',contract:'netify-mockup-supplier-directory/1',generatedAt:new Date().toISOString(),environment:'test',suppliers:mockupSupplierDirectory(source.providers),unavailable:source.unavailable,notice:'Complete researched catalogue. No supplier is represented as onboarded.'});return;}
  if(req.method==='GET'&&url.pathname==='/api/context-preview/library'){const source=await records();send(res,200,{provider_records:source.providers,buyer_checklists:Object.fromEntries(source.providers.map(p=>[p.provider.slug,originalBuyerChecklist(p.provider.slug,p.revision.dataset_version)])),governed_questions:projectQuestionCatalogue(),extended_sase_questions:saseExtendedQuestions(),sector_contexts:contextCatalogue(),unavailable_providers:source.unavailable});return;}
  if(req.method==='GET'&&url.pathname==='/api/context-preview/catalog'){send(res,200,{...contextCatalogue(),questions:projectQuestionCatalogue()});return;}
  if(req.method==='GET'&&/^\/api\/context-preview\/provider\/[a-z0-9-]+$/.test(url.pathname)){const slug=url.pathname.split('/').at(-1)!;const record=await loadSectorComparisonRecord(slug);send(res,record?200:404,record??{error:'Provider not found.'});return;}
  if(req.method==='POST'&&url.pathname==='/api/context-preview/validate-backup'){send(res,200,ContextWorkingBackupSchema.parse(await body(req)));return;}
  if(req.method==='POST'&&url.pathname==='/api/context-preview/project'){
   const payload=await body(req),built=buildContextProject(payload.project,payload.estate);
   if(!payload.format||payload.format==='json'){send(res,200,built);return;}
   if(!['markdown','docx'].includes(payload.format)){send(res,400,{error:'Unknown document format.'});return;}
   if(payload.expected_fingerprint!==built.fingerprint){send(res,409,{error:'The project changed. Refresh the written brief before exporting.'});return;}
   let markdown=built.markdown;
   if(payload.include_research){
    const source=await records(),result=compareContextProviders(built.project.input,source.providers,source.unavailable);
    const selected=built.project.selectedProviders;
    if(!selected.length||selected.some(s=>!result.providers.some(p=>p.slug===s))){send(res,400,{error:'Select available provider records before attaching research.'});return;}
    if(selected.some(s=>payload.expected_evidence?.[s]!==result.providers.find(p=>p.slug===s)!.evidence_fingerprint)){send(res,409,{error:'Provider evidence changed. Refresh the comparison before exporting research.'});return;}
    markdown+='\n\n# Buyer research appendix: not a supplier response\n\n'+contextDecisionPackMarkdown(result,selected)+'\n\n'+fullResearchAppendixMarkdown(source.providers.filter(p=>selected.includes(p.provider.slug)).map(prepareComparisonRecord));
   }
   res.setHeader('content-disposition','attachment; filename="netify-private-'+built.project.document.format+'.'+(payload.format==='docx'?'docx':'md')+'"');
   streamDocument(res,payload.format==='docx'?new Uint8Array(await renderRfpDocx(markdown,'Private '+built.project.document.format.toUpperCase())):markdown,payload.format==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/markdown; charset=utf-8');return;
  }
  if(req.method==='POST'&&url.pathname==='/api/context-preview/compare'){
   const payload=await body(req),source=await records(),result=compareContextProviders(payload.input,source.providers,source.unavailable);
   if(!payload.format||payload.format==='json'){send(res,200,result);return;}
   if(!['markdown','docx','research_json','research_archive'].includes(payload.format)){send(res,400,{error:'Unknown download format.'});return;}
   const selected=payload.format==='research_archive'?result.providers.map(p=>p.slug):Array.isArray(payload.providers)?[...new Set(payload.providers as string[])]:[];
   if(payload.format==='research_archive'&&source.unavailable.length){send(res,503,{error:'Some records are unavailable. Rebuild before downloading the complete library.'});return;}
   if(!selected.length||(payload.format!=='research_archive'&&selected.length>4)||selected.some(s=>!result.providers.some(p=>p.slug===s))){send(res,400,{error:'Choose one to four available providers.'});return;}
   if(selected.some(s=>{const p=result.providers.find(p=>p.slug===s)!;return payload.expected_fingerprints?.[s]!==p.evidence_fingerprint||payload.expected_revisions?.[s]!==p.revision_id;})){send(res,409,{error:'Research has changed. Refresh the comparison before downloading.'});return;}
   const originals=source.providers.filter(p=>selected.includes(p.provider.slug)),interpreted=originals.map(prepareComparisonRecord);
   if(payload.format==='research_json'||payload.format==='research_archive'){const json=JSON.stringify({version:result.context_version,input:result.original_context,providers:result.providers.filter(p=>selected.includes(p.slug)),complete_published_records:originals,interpreted_comparison_records:interpreted},null,2);res.setHeader('content-disposition','attachment; filename="netify-context-research.'+(payload.format==='research_archive'?'json.gz':'json')+'"');send(res,200,payload.format==='research_archive'?gzipSync(json):json,payload.format==='research_archive'?'application/gzip':'application/json');return;}
   const markdown=contextDecisionPackMarkdown(result,selected)+(payload.include_full_research!==false?'\n\n'+fullResearchAppendixMarkdown(interpreted):'');
   res.setHeader('content-disposition','attachment; filename="netify-context-decision-pack.'+(payload.format==='docx'?'docx':'md')+'"');
   if(payload.format==='docx'){send(res,200,new Uint8Array(await renderRfpDocx(markdown,'SD-WAN and SASE context decision pack')),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');return;}
   send(res,200,markdown,'text/markdown; charset=utf-8');return;
  }
  if(req.method==='GET'&&['/','/locations','/locations/','/providers','/providers/', '/partner-project-session.js','/partner-project.css','/workspace-mode.js','/workspace-mode.css','/partner-workspace.js','/partner-workspace.css','/pricing-workspace.js','/pricing-workspace.css','/provider-first.js','/provider-first.css','/location-workspace.js','/location-model.js','/estate-projection.js','/qa-timing.js','/location-map-motion.js','/location-workspace.css','/vendor/leaflet.js','/vendor/botid.js','/vendor/leaflet.css','/client.js','/core-persistence.js','/core-identity.js','/core-desk.js','/core-backup-import.js','/orbit-controls.js','/knowledge-map.js','/map-navigation.js','/company-overview.js','/project-room.js','/conversation-model.js','/buying-model.js','/buying-workspace.js','/buying-workspace.css','/styles.css'].includes(url.pathname)){
   const providerFirst=['/providers','/providers/'].includes(url.pathname);const locationMode=providerFirst||['/locations','/locations/'].includes(url.pathname);const name=url.pathname==='/'||locationMode?'index.html':url.pathname.slice(1);let text=await readFile(resolve(root,name),'utf8');if(locationMode)text=text.replace('<head>','<head><link rel="stylesheet" href="/pricing-workspace.css"><link rel="stylesheet" href="/vendor/leaflet.css"><link rel="stylesheet" href="/location-workspace.css"><script src="/vendor/leaflet.js"></script>').replace('Netify · Connected context preview','Netify · Location-led marketplace');
   if(name==='index.html'){res.setHeader('set-cookie',partnerPreviewCookie());text=text.replace('<head>','<head><link rel="stylesheet" href="/partner-workspace.css"><link rel="stylesheet" href="/workspace-mode.css">').replace('<button class="ns-subtle-button" id="ns-edit-brief"','<a class="ns-subtle-button" href="/locations/?workspace=partner">Work with your customers</a><button class="ns-subtle-button" id="ns-edit-brief"');}
   if(partnerProject){text=text.replace('<head>','<head><link rel="stylesheet" href="/partner-project.css"><script type="module" src="/partner-project-session.js"></script>').replace('<body style=', '<body data-partner-project="'+partnerProject+'" style=').replace('<div aria-label="Netify full-screen 3D context room concept"','<aside class="rp-project-banner"><div><strong>Customer project / Partner view / LOCAL TEST</strong><p>Same estate, evidence, RFP and pricing engine. Customer permissions are simulated. No supplier authority or commission granted.</p></div><a href="/partners/">← Customers and opportunities</a></aside><div aria-label="Netify full-screen 3D context room concept"');}
   if(providerFirst){const source=await records();const entrance=(renderEntrance?renderEntrance(source.providers,source.unavailable):'').replaceAll('<div class="pf-provider-body">','<div class="pf-provider-body">');text=text.replace('<head>','<head><link rel="stylesheet" href="/provider-first.css">').replace('<body style=', '<body data-provider-first="true" data-pf-stage="catalogue" style=').replace('<div aria-label="Netify full-screen 3D context room concept"',entrance+'<div aria-label="Netify full-screen 3D context room concept"');}
   if(name==='index.html')res.setHeader('content-security-policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:${locationMode?' https://tile.openstreetmap.org':''}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
   if(providerFirst&&req.headers['accept-encoding']?.includes('gzip')){res.setHeader('content-encoding','gzip');res.setHeader('vary','Accept-Encoding');send(res,200,gzipSync(text),'text/html; charset=utf-8');return;}
   send(res,200,text,name.endsWith('.js')?'application/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');return;
  }
  send(res,404,{error:'This preview only supports public research, comparison and decision-pack downloads. Only local document rendering is available. No marketplace project or publication routes exist.'});
 }catch(e){const error=e instanceof Error?e.message:'Research unavailable.';send(res,error.includes('validation')||error.includes('Provide one known')||error.startsWith('[')?400:503,{error});}
}
export function serveContextPreview(renderEntrance?:(providers:PublishedProvider[],unavailable:string[])=>string){return createServer((req,res)=>contextPreviewHandler(req,res,defaultOrigin,renderEntrance)).listen(port,'127.0.0.1',()=>console.log(defaultOrigin+'/'));}
