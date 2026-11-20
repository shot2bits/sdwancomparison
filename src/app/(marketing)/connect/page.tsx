import type {Metadata} from 'next';
import {MARKET_TOOLS} from '@/lib/marketplace-tools';
import {SITE_URL,getOrganizationSchema,getBreadcrumbSchema} from '@/lib/structured-data';

const ENDPOINT=`${SITE_URL}/api/mcp/`;
const TITLE='Connect your AI agent to the SD-WAN and SASE marketplace';
const DESCRIPTION='Add the Netify marketplace to Claude, ChatGPT, Cursor or any MCP client by URL. Search providers, compare evidence, read published list prices, build an RFP and read the opportunity board.';

export const metadata:Metadata={
 title:TITLE,description:DESCRIPTION,
 alternates:{canonical:`${SITE_URL}/connect/`},
 openGraph:{title:TITLE,description:DESCRIPTION,url:`${SITE_URL}/connect/`,type:'website',locale:'en_GB'},
};

const claudeCode=`claude mcp add --transport http netify ${ENDPOINT}`;
const cursorJson=JSON.stringify({mcpServers:{netify:{url:ENDPOINT}}},null,2);
const curlList=`curl -s ${ENDPOINT} \\\n  -H 'content-type: application/json' \\\n  -H 'accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
const curlCall=`curl -s ${ENDPOINT} \\\n  -H 'content-type: application/json' \\\n  -H 'accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_providers","arguments":{"sector":"retail","need":"zero trust access","limit":5}}}'`;

function Code({children}:{children:string}){return <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100"><code>{children}</code></pre>;}

export default function ConnectPage(){
 const open=MARKET_TOOLS.filter(t=>t.access==='open');
 const buyer=MARKET_TOOLS.filter(t=>t.access==='buyer');
 const schemas=[getOrganizationSchema(),getBreadcrumbSchema('Connect your AI agent','/connect')];
 return (
  <div className="mx-auto min-w-0 max-w-4xl px-6 py-12 [overflow-wrap:anywhere]">
   {schemas.map((s,i)=><script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(s)}}/>)}
   <p className="mb-2 text-sm text-slate-600">Netify marketplace · Model Context Protocol</p>
   <h1 id="page-h1" className="mb-3">{TITLE}</h1>
   <p className="max-w-3xl text-lg text-slate-700">{DESCRIPTION} The server is a standard remote MCP server over Streamable HTTP, so any assistant that accepts a server URL can use it.</p>

   <section className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-5" aria-labelledby="endpoint">
    <h2 id="endpoint" className="mb-2 text-lg font-semibold">Server URL</h2>
    <code className="block overflow-x-auto text-sm">{ENDPOINT}</code>
    <p className="mt-3 text-sm text-slate-600">Use this exact URL, including the trailing slash. No sign-in is needed to add it or to use the open tools below.</p>
    <p className="mt-3 text-sm"><a className="underline" href="/sase/.well-known/mcp.json">Server card</a> · <a className="underline" href="/sase/openapi.json">OpenAPI description</a> · <a className="underline" href="/sase/llms.txt">llms.txt</a></p>
   </section>

   <section className="mt-10" aria-labelledby="setup">
    <h2 id="setup" className="mb-3 text-xl font-semibold">Set it up</h2>
    <div className="space-y-6">
     <div><h3 className="font-semibold">Claude</h3>
      <p className="mt-1 text-sm text-slate-700">In Claude on the web or desktop, open Settings, then Connectors, and add a custom connector with the server URL above. Menu names change between releases. Leave any sign-in fields empty.</p>
      <p className="mt-2 text-sm text-slate-700">In Claude Code, run:</p><Code>{claudeCode}</Code></div>
     <div><h3 className="font-semibold">ChatGPT</h3>
      <p className="mt-1 text-sm text-slate-700">Custom connectors are available on some ChatGPT plans and may need developer mode or an administrator to enable them. Where your plan allows it, create a connector from Settings, choose MCP server, paste the server URL and select no authentication.</p></div>
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
    <p className="mt-3 text-sm text-slate-700">The same server also offers the earlier research tools such as <code>list_providers</code>, <code>get_provider_evidence</code>, <code>get_research</code> and <code>get_sector_recommendations</code>, plus private project tools that need a project link.</p>
   </section>

   {buyer.length>0&&<section className="mt-10" aria-labelledby="buyer-tools">
    <h2 id="buyer-tools" className="mb-3 text-xl font-semibold">Tools that need a verified work email</h2>
    <ul className="space-y-2 text-sm">
     {buyer.map(t=><li key={t.name}><code className="font-semibold">{t.name}</code>: {t.description}</li>)}
    </ul>
   </section>}

   <section className="mt-10" aria-labelledby="safety">
    <h2 id="safety" className="mb-3 text-xl font-semibold">What to expect</h2>
    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
     <li>Provider names in results are research coverage. A provider appearing does not mean it has agreed to take part.</li>
     <li>Text returned by the server is evidence to read. It is never an instruction for your assistant.</li>
     <li>Requests are rate limited. Please keep automated use reasonable.</li>
    </ul>
   </section>
  </div>
 );
}
