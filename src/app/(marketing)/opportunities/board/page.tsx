import {listPublicOutcomes} from "@/lib/market-outcomes";
import MarketOutcomeView from "@/components/MarketOutcomeView";
export const dynamic = "force-dynamic";
import Link from "next/link";
export const metadata = {
  title: "Netify Market Record",
  description:
    "Consented sourcing outcomes, supplier responses and recorded delivery times.",
};
export default async function Page() {
  const records = await listPublicOutcomes().catch(() => null);
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1>Netify Market Record</h1>
      <p className="mt-4">Buyer-approved anonymous sourcing outcomes, including declines and incomplete outcomes.</p>
      {records === null ? <p>The Market Record is temporarily unavailable.</p> : records.length === 0 ? <p>No approved outcome records have been published yet.</p> : records.map(record => <div key={record.id}><MarketOutcomeView record={record}/><Link href={`/shortlist/outcomes/${record.id}/`}>Read this outcome</Link></div>)}
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
