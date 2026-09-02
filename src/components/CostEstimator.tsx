"use client";

/**
 * SASE cost and TCO estimator (Phase 1 of the agentic cost build).
 *
 * Plain, fast, no login: posts to /sase/api/cost/estimate (the pre-built
 * Methodology v2026.1 engine) and shows the monthly band, the three year
 * TCO band and the per-driver breakdown. Primary CTA hands the validated
 * inputs to the RFP builder as base64url JSON (?prefill=), turning the
 * estimate into a structured requirement. Embeddable: the insights page
 * on the apex domain renders its own light twin against the same API,
 * following the established cross-repo widget mechanism.
 */

import { useState } from "react";
import Continuation from "@/components/Continuation";
import { deriveContinuationCost } from "@/lib/continuation/derive";

type Band = [number, number];

interface EstimateResult {
  monthlyBandGBP: Band;
  threeYearTcoBandGBP: Band;
  byDriver: Record<string, Band>;
  oneOffImplementationBandGBP: Band;
  methodologyVersion: string;
  disclaimer: string;
  notes: string[];
}

const REGION_OPTIONS = [
  { key: "uk-europe", label: "UK and Europe" },
  { key: "north-america", label: "North America" },
  { key: "apac", label: "Asia Pacific" },
  { key: "middle-east-africa", label: "Middle East and Africa" },
  { key: "latam", label: "Latin America" },
] as const;

const DRIVER_LABELS: Record<string, string> = {
  usersAndDevices: "Users and devices",
  securityDepth: "Security depth",
  sitesAndRegions: "Sites and regions",
  bandwidthProfile: "Bandwidth profile",
  deliveryModel: "Delivery model",
  implementationAndMigration: "Implementation and migration (amortised)",
  hiddenAndRecurring: "Hidden and recurring",
};

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function band(b: Band): string {
  return `${gbp(b[0])} to ${gbp(b[1])}`;
}

export function CostEstimator() {
  const [users, setUsers] = useState(1000);
  const [sites, setSites] = useState(20);
  const [regions, setRegions] = useState<string[]>(["uk-europe"]);
  const [securityDepth, setSecurityDepth] = useState("full-sase");
  const [deliveryModel, setDeliveryModel] = useState("managed");
  const [termYears, setTermYears] = useState(3);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = { users, sites, regions, securityDepth, deliveryModel, termYears };

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/sase/api/cost/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "The estimate could not be calculated. Check the inputs.");
        setResult(null);
      } else {
        setResult(data as EstimateResult);
      }
    } catch {
      setError("The estimator is unavailable right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRegion(key: string) {
    setRegions((r) => (r.includes(key) ? r.filter((x) => x !== key) : [...r, key]));
  }

  return (
    <section id="estimator" aria-label="SASE cost and TCO estimator" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-900">SASE cost and TCO estimator</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Indicative bands from the Netify SASE Methodology v2026.1 calibration, not vendor quotes.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Users</span>
          <input
            type="number"
            min={50}
            max={250000}
            value={users}
            onChange={(e) => setUsers(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Sites</span>
          <input
            type="number"
            min={1}
            max={5000}
            value={sites}
            onChange={(e) => setSites(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <fieldset className="text-sm sm:col-span-2">
          <legend className="font-medium text-zinc-800">Regions in scope</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
            {REGION_OPTIONS.map((r) => (
              <label key={r.key} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={regions.includes(r.key)}
                  onChange={() => toggleRegion(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Security depth</span>
          <select
            value={securityDepth}
            onChange={(e) => setSecurityDepth(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 bg-white"
          >
            <option value="sse-only">SSE only</option>
            <option value="full-sase">Full SASE</option>
            <option value="full-sase-plus-advanced">Full SASE plus advanced</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Delivery model</span>
          <select
            value={deliveryModel}
            onChange={(e) => setDeliveryModel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 bg-white"
          >
            <option value="managed">Managed</option>
            <option value="co-managed">Co-managed</option>
            <option value="diy">DIY / self-managed</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Term</span>
          <select
            value={termYears}
            onChange={(e) => setTermYears(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 bg-white"
          >
            <option value={1}>1 year</option>
            <option value={3}>3 years</option>
            <option value={5}>5 years</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={busy || regions.length === 0}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Calculating…" : "Estimate cost bands"}
      </button>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-5 border-t border-zinc-200 pt-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-zinc-50 p-4">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Monthly band</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900">{band(result.monthlyBandGBP)}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Three year TCO band</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900">{band(result.threeYearTcoBandGBP)}</dd>
            </div>
          </dl>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left">
                <th className="py-1.5 pr-3 font-semibold text-zinc-900">Cost driver</th>
                <th className="py-1.5 font-semibold text-zinc-900">Monthly band</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.byDriver).map(([k, v]) => (
                <tr key={k} className="border-b border-zinc-200">
                  <td className="py-1.5 pr-3 text-zinc-700">{DRIVER_LABELS[k] ?? k}</td>
                  <td className="py-1.5 text-zinc-700">{band(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.notes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-500">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-500">{result.disclaimer}</p>

          {/* The Continuation (DEF wave one): derived from the buyer's own
              scenario once an estimate exists; the legacy prefill button
              retires under One Door. */}
          <div className="mt-5">
            <Continuation
              key={`cost:${users}-${sites}`}
              c={deriveContinuationCost({ hasEstimate: true, users, sites, managed: deliveryModel === "managed" })}
            />
            <p className="mt-3 text-sm">
              <a
                href="https://netify.co.uk/insights/10-best-managed-sase-providers/"
                className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600"
              >
                10 Best Managed SASE Providers guide
              </a>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
