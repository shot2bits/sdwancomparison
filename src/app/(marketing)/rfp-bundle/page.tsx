import type {Metadata} from 'next';
import RfpBundleForm from '@/components/RfpBundleForm';
import {SITE_URL,getOrganizationSchema,getBreadcrumbSchema} from '@/lib/structured-data';

const TITLE='Get an SD-WAN and SASE RFP and recommended providers';
const DESCRIPTION='Describe your requirement and download a ready-to-send RFP with a pack of recommended providers. Needs a work email, your agreement to publish, and an actual publish of the requirement.';
export const metadata:Metadata={title:TITLE,description:DESCRIPTION,alternates:{canonical:`${SITE_URL}/rfp-bundle/`},openGraph:{title:TITLE,description:DESCRIPTION,url:`${SITE_URL}/rfp-bundle/`,type:'website',locale:'en_GB'}};

export default function RfpBundlePage(){
 const schemas=[getOrganizationSchema(),getBreadcrumbSchema('RFP and recommended providers','/rfp-bundle')];
 return (
  <div className="mx-auto min-w-0 max-w-3xl px-6 py-12 [overflow-wrap:anywhere]">
   {schemas.map((s,i)=><script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(s)}}/>)}
   <h1 id="page-h1" className="mb-3">{TITLE}</h1>
   <p className="text-lg text-slate-700">{DESCRIPTION}</p>
   <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
    <li>Downloading needs a work email, your agreement to publish, and an actual publish. Netify then lists the requirement privately with the marketplace&apos;s curated vendors and providers.</li>
    <li>The public board shows the requirement without your company name, and only the sector, products, number of sites and users, and region, unless you opt in. Naming your company reaches a wider audience of providers and vendors you may not have considered. Your free-text description stays private unless you show your company.</li>
    <li>Free email such as Gmail, Outlook, Hotmail, Yahoo and iCloud cannot be used.</li>
    <li>AI assistants can do the same through the <a className="underline" href="/sase/connector/">MCP connection</a>.</li>
   </ul>
   <div className="mt-8"><RfpBundleForm/></div>
  </div>
 );
}
