import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
process.env.NODE_ENV='test';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://fixture.test/sase/admin/'});
for(const k of ['window','document','HTMLElement','Element','MutationObserver','Event','CustomEvent','location','history','localStorage','sessionStorage'])globalThis[k]=dom.window[k];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');globalThis.React=React;
const {render,screen,waitFor,cleanup,fireEvent}=await import('@testing-library/react');
const {default:Admin}=await import('../src/components/AdminClient.tsx');
let authenticated=false,failOverview=true,expired=false,approved=false;
const writes=[];
function overview(){return {admin_email:'support@netify.com',sessions:[],users:[],vendors:[],blocklist:{builtin_count:0,custom:[]},pending:[],claims:[{slug:'fortinet',status:approved?'approved':'pending',email:'fixture@fortinet.com',domain:'fortinet.com',requested:1}],opportunities:[],rfps:[{id:'rfp_fixture',title:'Read-only fixture project',admin_url:'/sase/admin/projects/rfp_fixture/',format:'RFI',status:'published',owner_email:'buyer@example.test',contact_email:null,organisation:'Fixture',sector:null,scope:'SD-WAN',sections:0,questions:0,invited_vendors:0,responses:1,created:1,updated:1}],funnel:{buyer_accounts:1,accounts_with_rfp:1,rfps_total:1,rfps_account_owned:1,rfps_anonymous:0,rfps_published:1,supplier_responses:1,draft_link_captures:0}};}
globalThis.fetch=async(url,init={})=>{
 const u=String(url);
 if(u.includes('/auth/session'))return Response.json({authenticated,admin:authenticated,email:authenticated?'support@netify.com':undefined,role:authenticated?'netify':undefined});
 if(u.includes('/auth/challenge'))return Response.json({challenge:'fixture'});
 if(u.includes('/auth/request'))return Response.json({emailed:true});
 if(u.includes('/auth/verify')){authenticated=true;return Response.json({ok:true});}
 if(u.includes('/auth/logout')){authenticated=false;return Response.json({ok:true});}
 if(u.includes('/api/admin')){
  if(init.method==='POST'){const body=JSON.parse(init.body);writes.push(body);approved=true;return Response.json({ok:true});}
  if(expired)return Response.json({error:'Sign in required.'},{status:401});
  if(failOverview)return Response.json({error:'Unavailable'},{status:503});
  return Response.json(overview());
 }
 throw new Error('Unexpected fixture request '+u);
};
render(React.createElement(Admin));
await waitFor(()=>assert.ok(screen.getByLabelText('Work email')));
fireEvent.change(screen.getByLabelText('Work email'),{target:{value:'support@netify.com'}});
await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Email me a code'}).disabled,false));
fireEvent.click(screen.getByRole('button',{name:'Email me a code'}));
await waitFor(()=>assert.ok(screen.getByLabelText('6-digit code from the email')));
fireEvent.change(screen.getByLabelText('6-digit code from the email'),{target:{value:'123456'}});
fireEvent.click(screen.getByRole('button',{name:'Confirm with code'}));
await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Try again'})));
assert.match(screen.getByRole('alert').textContent,/Could not load projects/,'load errors must be visible, not a permanent loading screen');
failOverview=false;fireEvent.click(screen.getByRole('button',{name:'Try again'}));
await waitFor(()=>assert.ok(screen.getByRole('heading',{name:'Projects'})));
assert.equal(screen.getByRole('link',{name:'Read-only fixture project'}).getAttribute('href'),'/sase/admin/projects/rfp_fixture/');
assert.ok(screen.getByRole('heading',{name:'Supplier approvals'}));
fireEvent.click(screen.getByRole('button',{name:'Approve',exact:true}));
await waitFor(()=>assert.ok(screen.getByText('Supplier approved.')));
assert.deepEqual(writes,[{action:'approve_claim',slug:'fortinet'}]);
assert.equal(screen.queryByRole('button',{name:'Approve',exact:true}),null);
fireEvent.click(screen.getByRole('button',{name:'Sign out',exact:true}));
await waitFor(()=>assert.ok(screen.getByLabelText('Work email')));
assert.equal(screen.queryByRole('heading',{name:'Projects'}),null);cleanup();
authenticated=true;expired=true;
render(React.createElement(Admin));
await waitFor(()=>assert.ok(screen.getByLabelText('Work email')));
assert.ok(screen.getByRole('alert'));assert.equal(screen.queryByText('Loading admin console...'),null);cleanup();
console.log('PASS actual admin page: email-code login without reload, retryable load failure, admin project links, supplier approval, sign-out and expired-session recovery');
