import {listPublicOutcomes} from "@/lib/market-outcomes";
import MarketOutcomeView from "@/components/MarketOutcomeView";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { SITE_URL } from "@/lib/structured-data";
const TITLE = "UK SD-WAN and SASE requirements board: published buyer outcomes";
const DESCRIPTION =
  "How buyers publish SD-WAN and SASE requirements through the Netify RFP Builder, how suppliers respond, and the approved anonymous outcomes recorded on the public board.";
export const metadata = {
  alternates: { canonical: `${SITE_URL}/opportunities/board/` },
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/opportunities/board/`, type: "website", locale: "en_GB" },
};
export default async function Page() {
  const records = await listPublicOutcomes().catch(() => null);
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1>{TITLE}</h1>
      <p className="mt-4 text-lg">This is the public record of buyer requirements for SD-WAN, SASE and managed network services on Netify. It is the Netify Market Record and lists buyer-approved anonymous sourcing outcomes, including declines and incomplete outcomes.</p>
      <section className="mt-8" aria-labelledby="board-how-buyers">
        <h2 id="board-how-buyers" className="text-xl font-semibold">How buyers post requirements</h2>
        <p className="mt-2">Describe your sector, sites and needs in the <a className="underline" href="https://netify.co.uk/sase-sd-wan-rfp-builder/">RFP Builder</a>. It builds an RFP from your answers in about two minutes. For a shorter request, <Link className="underline" href="/opportunities/">publish an RFI</Link>. Drafts stay private. Publishing shares an anonymous notice, not your contact details or any pricing you receive.</p>
      </section>
      <section className="mt-6" aria-labelledby="board-how-suppliers">
        <h2 id="board-how-suppliers" className="text-xl font-semibold">How suppliers respond</h2>
        <p className="mt-2">Verified vendors and service providers can submit interest and indicative pricing on a published requirement. Pricing stays private to the buyer. Read how to take part on the <Link className="underline" href="/for-suppliers/">for suppliers page</Link>.</p>
      </section>
      <section className="mt-6" aria-labelledby="board-record">
        <h2 id="board-record" className="text-xl font-semibold">What appears below</h2>
      <p className="mt-4">This page records approved outcomes, not every submitted project. Existing project notices and private response rooms remain accessible through their saved links. A submitted requirement does not appear here until an outcome has been reviewed and the buyer has approved publication.</p>
      {records === null ? <p>The Market Record is temporarily unavailable.</p> : records.length === 0 ? <p>No approved outcome records have been published yet.</p> : records.map(record => <div key={record.id}><MarketOutcomeView record={record}/><Link href={`/shortlist/outcomes/${record.id}/`}>Read this outcome</Link></div>)}
      </section>
      <p className="mt-8">
        <Link href="/shortlist/">Ask Netify to prepare a sourcing plan →</Link>
      </p>
      <p className="mt-4">
        Existing buyers and suppliers can continue their private records through
        their existing links. Records have not been deleted.
      </p>
    </div>
  );
}
