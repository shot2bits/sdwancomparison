import Link from "next/link";
export const metadata = {
  title: "Netify Market Record",
  description:
    "Consented sourcing outcomes, supplier responses and recorded delivery times.",
};
export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1>Netify Market Record</h1>
      <p className="mt-4">
        Consented sourcing outcomes will appear here. No completed records have
        been published in this release.
      </p>
      <div className="overflow-x-auto">
        <table className="mt-8 w-full text-left">
          <thead>
            <tr>
              {[
                "Sector / scale",
                "Scope",
                "Providers approached",
                "Responses / declines",
                "Days to proposals",
                "Outcome",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
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
