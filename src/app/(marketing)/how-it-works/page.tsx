import { SHORTLIST_FAQS } from "@/lib/shortlist-content";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/structured-data";
import { SOURCING_DESCRIPTION, SOURCING_STEPS, sourcingUndertaking, COMMISSION_DESCRIPTION } from "@/lib/sourcing-contract";
export const metadata: Metadata = {
 title: "How Netify coordinates SD-WAN and SASE sourcing",
 description: SOURCING_DESCRIPTION,
 alternates: { canonical: `${SITE_URL}/how-it-works/` },
};
export default function HowItWorksPage() {
 return <main className="max-w-5xl mx-auto px-6 py-16">
  <h1>From provider research to comparable proposals</h1>
  <p className="text-lg my-6">{SOURCING_DESCRIPTION}</p>
  <ol className="grid md:grid-cols-2 gap-8 my-10">
   {SOURCING_STEPS.map((step,i)=><li key={step.title}><h2>{i+1}. {step.title}</h2><p>{step.body}</p></li>)}
  </ol>
  <h2>What Netify undertakes</h2><p>{sourcingUndertaking()}</p>
  <h2 className="mt-8">Research coverage is not supplier participation</h2>
  <p>Our comparison dataset is an evidence resource. Inclusion does not mean a provider has agreed to quote, confirmed suitability for your brief or joined a response panel. Netify checks the route to the providers you approve and records their responses.</p>
  <h2 className="mt-8">Your project stays private</h2>
  <p>No public listing is needed for sourcing. Review the supplier brief and recipients before confirming. Return to your private project by signing in with the same work email. A formal RFP can be developed within that project when needed.</p>
  <h2 className="mt-8">Using an AI assistant</h2>
  <p>A connected assistant can prepare a sourcing plan through the same MCP tools. Sending a request still requires your approval and work-email confirmation.</p>
  <p className="my-6">{COMMISSION_DESCRIPTION}</p>
  <Link href="/shortlist" className="underline">Research providers and prepare your request</Link>
  {" · "}<Link href="/connector" className="underline">Assistant connection</Link>
  <section><h2>Questions about the service</h2>{SHORTLIST_FAQS.map(f=><details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>
 </main>;
}
