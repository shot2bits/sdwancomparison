import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
process.env.NODE_ENV='test';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://fixture.test/sase/studio-preview/?project=rfp_saved#project_session=expired'});
for(const k of ['window','document','HTMLElement','Element','MutationObserver','Event','CustomEvent','location','history','localStorage','sessionStorage'])globalThis[k]=dom.window[k];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');globalThis.React=React;
const {render,screen,waitFor,cleanup,fireEvent}=await import('@testing-library/react');
const {useStudioProject}=await import('../src/components/opportunity-studio/useStudioProject.ts');
const {default:Supplier}=await import('../src/components/opportunity-studio/StudioSupplier.tsx');
const {default:Engagement}=await import('../src/components/opportunity-studio/StudioEngagement.tsx');
const draft={format:'rfi',requirement:'The saved private requirement remains available.',scope:'SASE',sites:'10',users:'500',regions:['Europe'],service:'Fully managed',timescale:'Not decided',questionIds:[]};
let signedIn=true;const calls=[];
globalThis.fetch=async(url,init={})=>{
 calls.push({url:String(url),headers:init.headers});
 if(String(url).includes('/auth/session'))return Response.json({authenticated:signedIn,role:'buyer'});
 if(String(url).includes('/auth/challenge'))return Response.json({challenge:'fixture'});
 if(String(url).includes('/recover/'))return signedIn?Response.json({project_reference:'rfp_saved',project_session_token:'fresh',revision:5}):Response.json({error:'Verify your work email.'},{status:401});
 if(String(url).includes('/engagement/'))return Response.json({error:'Sign in to reopen this project.'},{status:401});
 if(init.headers?.authorization!=='Bearer fresh')return Response.json({error:'Project not found.'},{status:404});
 return Response.json({studio_draft:draft,revision:5,buyer:{organisation:'Private company'},publication_complete:true,publication_receipt:{notice_url:'https://netify.co.uk/sase/opportunities/opp_saved/'}});
};
function Harness(){const [loaded,setLoaded]=React.useState('');const p=useStudioProject((d,published)=>setLoaded(d.requirement+' '+published));return React.createElement('div',null,React.createElement('p',null,loaded),React.createElement('p',null,p.error),React.createElement('p',null,p.recoveryProject),React.createElement('button',{onClick:()=>p.run(()=>p.restore())},'Reopen'));}
render(React.createElement(Harness));
await waitFor(()=>assert.ok(screen.getByText(draft.requirement+' true')));
assert(calls.some(c=>c.url.endsWith('/recover/')),'expired browser credential automatically recovers through verified ownership');
assert.match(location.hash,/fresh/);cleanup();
signedIn=false;history.replaceState(null,'','/sase/studio-preview/?project=rfp_saved#project_session=expired');
render(React.createElement(Harness));await waitFor(()=>assert.ok(screen.getByText('rfp_saved')));
signedIn=true;fireEvent.click(screen.getByRole('button',{name:'Reopen'}));await waitFor(()=>assert.ok(screen.getByText(draft.requirement+' true')));cleanup();
render(React.createElement(Engagement,{projectId:'rfp_saved',noticeUrl:'/sase/opportunities/opp_saved/'}));
await waitFor(()=>assert.ok(screen.getByRole('alert')));assert.equal(screen.queryByText('Requests to bid'),null,'failed reads must not invent a zero-request count');assert.equal(screen.queryByText('No supplier requests yet'),null);cleanup();
signedIn=false;history.replaceState(null,'','/sase/studio-preview/?project=rfp_saved#project_session=expired');localStorage.setItem('netify_studio_backup_rfp_saved',JSON.stringify(draft));
function CopyHarness(){const [loaded,setLoaded]=React.useState('');const p=useStudioProject(d=>setLoaded(d.requirement));return React.createElement('div',null,React.createElement('p',null,loaded),p.recoveryCopy&&React.createElement('button',{onClick:p.restartFromCopy},'Use saved copy'));}
render(React.createElement(CopyHarness));await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Use saved copy'})));fireEvent.click(screen.getByRole('button',{name:'Use saved copy'}));await waitFor(()=>assert.ok(screen.getByText(draft.requirement)));assert.equal(location.search,'');cleanup();
globalThis.fetch=async(url,init={})=>String(url).includes('/auth/session')?Response.json({authenticated:true,role:'supplier',email:'supplier@example.test',vendor_slug:'cisco'}):String(url).includes('/supplier/claim/')?Response.json({status:'pending'}):Response.json({error:'Your supplier profile must be approved before viewing details or requesting to bid.'},{status:403});
render(React.createElement(Supplier,{projectId:'rfp_saved'}));await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Request supplier approval'})));fireEvent.click(screen.getByRole('button',{name:'Request supplier approval'}));await waitFor(()=>assert.ok(screen.getByText('Your request is saved for Netify review. No buyer details are accessible until approval.')));assert.equal(screen.queryByText(draft.requirement),null);cleanup();
console.log('PASS Studio UI: expired-owner recovery, same-project return after verification, and no invented zero counts on failed supplier-activity reads');
