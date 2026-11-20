import type {Metadata} from 'next';
import {liveCatalogue} from '@/lib/mcp-live-catalogue';
import {SITE_URL,getOrganizationSchema,getBreadcrumbSchema} from '@/lib/structured-data';

const ENDPOINT=`${SITE_URL}/api/mcp/`;
const TITLE='Connect your AI agent to the SD-WAN and SASE marketplace';
const DESCRIPTION='Add the Netify marketplace to Claude, ChatGPT, Cursor or any MCP client by URL. Search providers, compare evidence, read published list prices, build an RFP and read the opportunity board.';

export const metadata:Metadata={
 title:TITLE,description:DESCRIPTION,
 alternates:{canonical:`${SITE_URL}/connector/`},
 openGraph:{title:TITLE,description:DESCRIPTION,url:`${SITE_URL}/connector/`,type:'website',locale:'en_GB'},
};

const claudeCode=`claude mcp add --transport http netify ${ENDPOINT}`;
const cursorJson=JSON.stringify({mcpServers:{netify:{url:ENDPOINT}}},null,2);
const curlList=`curl -s ${ENDPOINT} \\\n  -H 'content-type: application/json' \\\n  -H 'accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
const curlCall=`curl -s ${ENDPOINT} \\\n  -H 'content-type: application/json' \\\n  -H 'accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_providers","arguments":{"sector":"retail","need":"zero trust access","limit":5}}}'`;

function Code({children}:{children:string}){return <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100"><code>{children}</code></pre>;}

export default function ConnectorPage(){
 const tools=liveCatalogue();
 const open=tools.filter(t=>t.group==='open');
 const verified=tools.filter(t=>t.group==='verified');
 const project=tools.filter(t=>t.group==='project');
 const hasThreads=verified.some(t=>t.name==='send_message');
 const schemas=[getOrganizationSchema(),getBreadcrumbSchema('Connect your AI agent','/connector'),{
  '@context':'https://schema.org','@type':'SoftwareApplication','@id':`${SITE_URL}/connector/#connector`,
  name:'Netify SASE and SD-WAN Marketplace connector (MCP)',applicationCategory:'BusinessApplication',
  operatingSystem:'Supported Model Context Protocol clients',url:`${SITE_URL}/connector/`,description:DESCRIPTION,
  publisher:{'@id':'https://netify.co.uk/#organization'},
 }];
 return (
  <div className="mx-auto min-w-0 max-w-4xl px-6 py-12 [overflow-wrap:anywhere]">
   {schemas.map((s,i)=><script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(s)}}/>)}
   <p className="mb-2 text-sm text-slate-600">Netify marketplace · Model Context Protocol</p>
   <h1 id="page-h1" className="mb-3">{TITLE}</h1>
   <p className="max-w-3xl text-lg text-slate-700">{DESCRIPTION} The server is a standard remote MCP server over Streamable HTTP, so any assistant that accepts a server URL can use it. The tool list on this page is the same list the server returns.</p>

   <section className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-5" aria-labelledby="endpoint">
    <h2 id="endpoint" className="mb-2 text-lg font-semibold">Server URL</h2>
    <code className="block overflow-x-auto text-sm">{ENDPOINT}</code>
    <p className="mt-3 text-sm text-slate-600">Use this exact URL, including the trailing slash. No sign-in is needed to add it or to use the open tools below. Private project tools use the marketplace authorisation server at <code>https://netify.co.uk/sase</code>.</p>
    <p className="mt-3 text-sm"><a className="underline" href="/sase/.well-known/mcp.json">Server card</a> · <a className="underline" href="/sase/.well-known/oauth-protected-resource/">Protected resource metadata</a> · <a className="underline" href="/sase/openapi.json">OpenAPI description</a> · <a className="underline" href="/sase/llms.txt">llms.txt</a></p>
   </section>

   <section className="mt-10" aria-labelledby="setup">
    <h2 id="setup" className="mb-3 text-xl font-semibold">Set it up</h2>
    <div className="space-y-6">
     <div><h3 className="font-semibold">Claude</h3>
      <p className="mt-1 text-sm text-slate-700">In Claude on the web or desktop, open Settings, then Connectors, and add a custom connector with the server URL above. Menu names change between releases. Leave any sign-in fields empty for the open tools.</p>
      <p className="mt-2 text-sm text-slate-700">In Claude Code, run:</p><Code>{claudeCode}</Code></div>
     <div><h3 className="font-semibold">ChatGPT</h3>
      <p className="mt-1 text-sm text-slate-700">Custom connectors are available on some ChatGPT plans and may need developer mode or an administrator to enable them. Where your plan allows it, create a connector from Settings, choose MCP server, paste the server URL and select no authentication for the open tools.</p></div>
     <div><h3 className="font-semibold">Cursor</h3>
      <p className="mt-1 text-sm text-slate-700">Add this to <code>.cursor/mcp.json</code> in your project, or to your global MCP settings:</p><Code>{cursorJson}</Code></div>
     <div><h3 className="font-semibold">Grok and other MCP clients</h3>
      <p className="mt-1 text-sm text-slate-700">Add a remote MCP server with transport set to Streamable HTTP and the server URL above. Clients that only support local servers can use a bridge such as <code>npx mcp-remote {ENDPOINT}</code>.</p></div>
     <div><h3 className="font-semibold">Check it from a terminal</h3>
      <p className="mt-1 text-sm text-slate-700">List the tools:</p><Code>{curlList}</Code>
      <p className="mt-3 text-sm text-slate-700">Call one:</p><Code>{curlCall}</Code></div>
    </div>
   </section>

   <section className="mt-10" aria-labelledby="open-tools">
    <h2 id="open-tools" className="mb-3 text-xl font-semibold">Open tools, no sign-in</h2>
    <p className="mb-3 text-sm text-slate-700">These read published research. Results carry sources and access dates. They are unverified desk research and not quotes, endorsements or rankings of quality.</p>
    <ul className="space-y-2 text-sm">
     {open.map(t=><li key={t.name}><code className="font-semibold">{t.name}</code>: {t.description}</li>)}
    </ul>
   </section>

   {verified.length>0&&<section className="mt-10" aria-labelledby="buyer-tools">
    <h2 id="buyer-tools" className="mb-3 text-xl font-semibold">Publishing and downloads need a verified work email</h2>
    <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
     <li>Your assistant calls <code>request_access_code</code> with your work email. Free email such as Gmail, Outlook, Hotmail, Yahoo and iCloud is rejected.</li>
     <li>You read the six digit code from your inbox and give it to your assistant, which calls <code>verify_access_code</code> and receives an <code>access_token</code>.</li>
     <li>Your assistant passes the token to the tools below, either as the <code>access_token</code> argument or as an <code>Authorization: Bearer</code> header.</li>
    </ol>
    <p className="mb-3 text-sm text-slate-700">Downloading the RFP and recommended-providers pack needs a work email, your agreement to publish, and an actual publish. Netify then lists the requirement privately with the marketplace&apos;s curated vendors and providers. The public board shows it without your company name unless you opt in. Set <code>show_company</code> with <code>company_name</code> if you want your company named publicly. Naming your company reaches a wider audience of providers and vendors you may not have considered. Your free-text description stays private unless you show your company.</p>
    {hasThreads&&<p className="mb-3 text-sm text-slate-700">Conversations: <code>send_message</code> and <code>request_expert_help</code> open a private thread with a provider or the Netify team, and <code>read_thread</code> shows the replies. Providers reply from a one-time link in their email and need no account. The Netify team can join any thread. You can message a provider once Netify has invited it to your requirement or it has responded. Until provider messaging is switched on, messages to providers are held and the Netify team can see them. Messages to the Netify team work now.</p>}
    <ul className="space-y-2 text-sm">
     {verified.map(t=><li key={t.name}><code className="font-semibold">{t.name}</code>: {t.description}</li>)}
    </ul>
   </section>}

   {project.length>0&&<section className="mt-10" aria-labelledby="project-tools">
    <h2 id="project-tools" className="mb-3 text-xl font-semibold">Private project tools</h2>
    <p className="mb-3 text-sm text-slate-700">These need a project link and, for writes, a verified owner in the web view. Supplier approval and sending are never assistant actions.</p>
    <ul className="space-y-2 text-sm">
     {project.map(t=><li key={t.name}><code className="font-semibold">{t.name}</code>: {t.description}</li>)}
    </ul>
   </section>}

   <section className="mt-10" aria-labelledby="safety">
    <h2 id="safety" className="mb-3 text-xl font-semibold">What to expect</h2>
    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
     <li>Open tools need no account. Publishing, the bundle download and conversations need a verified work email.</li>
     <li>Private project tools use the marketplace authorisation server. The issuer is <code>https://netify.co.uk/sase</code>.</li>
     <li>Research results are desk research with sources. They are not quotes or a recommendation to buy.</li>
     <li>The same rules apply to people on the website and to assistants.</li>
    </ul>
   </section>
  </div>
 );
}
