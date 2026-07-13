/**
 * /sase/cost-estimator: minimal mount for the SASE cost and TCO estimator.
 *
 * Exists so the estimator and its RFP builder handoff are verifiable
 * end to end on this app (Phase 1 verification), and as the canonical
 * on-platform home of the widget. The cost and TCO article on the apex
 * domain (Phase 2) embeds its own twin against the same API, following
 * the established cross-repo widget mechanism. Flagged at the Phase 1
 * stop point: remove the route if you would rather the estimator only
 * ever renders inside the article.
 */
import type { Metadata } from "next";
import { CostEstimator } from "@/components/CostEstimator";
import { SITE_URL } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "SASE Cost and TCO Estimator",
  description:
    "Estimate indicative SASE monthly cost and three year TCO bands by users, sites, regions, security depth, delivery model and term. Netify SASE Methodology v2026.1.",
  alternates: { canonical: `${SITE_URL}/cost-estimator` },
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
        SASE Cost and TCO Estimator
      </h1>
      <p className="mt-2 text-zinc-600">
        Model the cost shape of a SASE programme, then turn the estimate into a structured RFP.
      </p>
      <div className="mt-6">
        <CostEstimator />
      </div>
    </main>
  );
}
