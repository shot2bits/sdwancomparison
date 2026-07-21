"use client";

/**
 * Netify Security Sourcing advisor (Phase B step 2). ONE TRUTH: this
 * component imports assessSecurityRequirement, the exact function the
 * assess_security_requirement MCP tool runs; the on-page verdict is a live
 * preview and project creation recomputes it server-side, with the input
 * digest proving both are identical (Article 3, 17).
 *
 * Rendering obligations (Constitution): the summary block shows what is
 * recommended, conditional and NOT recommended with reasons; the
 * againstInterest entries render in their own prominent block; gaps render
 * as the questions to answer next; confidence is shown, never implied.
 */

import { useEffect, useMemo, useState } from "react";
import {
  assessSecurityRequirement,
  type SecurityRequirementInput,
  type SecurityScopeVerdict,
  type SecurityDriver,
} from "@/lib/security/rulebook";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";

const DRIVERS: Array<{ id: SecurityDriver; label: string }> = [
  { id: "incident", label: "We had (or have) an incident" },
  { id: "audit", label: "An audit is prompting this" },
  { id: "compliance", label: "Compliance obligations" },
  { id: "renewal", label: "A contract renewal" },
  { id: "growth", label: "Growth or change" },
  { id: "consolidation", label: "Consolidating point tools" },
  { id: "ransomware_concern", label: "Ransomware concern" },
];

const CLOUDS = ["m365", "google", "aws", "azure", "other_saas"];
const COMPLIANCE = ["iso27001", "pci_dss", "cyber_essentials_plus", "fca", "nhs_dspt"];

const NEEDED_STYLE: Record<string, string> = {
  required: "border-emerald-300 bg-emerald-50 text-emerald-900",
  recommended: "border-amber-300 bg-amber-50 text-amber-900",
  not_indicated: "border-zinc-300 bg-zinc-100 text-zinc-700",
  cannot_assess: "border-zinc-200 bg-white text-zinc-500",
};

const CAP_LABEL: Record<string, string> = {
  endpoint: "Endpoint protection",
  mdr_soc: "Managed detection and response",
  sse: "Secure service edge",
  siem_logging: "SIEM and logging",
  managed_firewall: "Managed firewall",
  awareness: "Security awareness training",
  email_security: "Email security",
  backup_resilience: "Backup and resilience",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none";
const chipCls = (on: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-amber-500 bg-amber-50 text-amber-900" : "border-zinc-300 bg-white text-zinc-600 hover:border-amber-300"}`;

export function SecuritySourcingAdvisor() {
  const [users, setUsers] = useState("");
  const [sites, setSites] = useState("");
  const [computers, setComputers] = useState("");
  const [mobiles, setMobiles] = useState("");
  const [servers, setServers] = useState("");
  const [sector, setSector] = useState("");
  const [cloud, setCloud] = useState<string[]>([]);
  const [special, setSpecial] = useState<Array<"chromebook" | "epos">>([]);
  const [existingSecurity, setExistingSecurity] = useState("");
  const [existingNetwork, setExistingNetwork] = useState("");
  const [drivers, setDrivers] = useState<SecurityDriver[]>([]);
  const [compliance, setCompliance] = useState<string[]>([]);
  const [soc, setSoc] = useState<"" | "none" | "business_hours" | "twenty_four_seven">("");
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState<{ builderPath: string; projectId: string } | null>(null);
  const [verdict, setVerdict] = useState<SecurityScopeVerdict | null>(null);

  const requirement: SecurityRequirementInput = useMemo(() => {
    const num = (s: string) => (s.trim() && Number.isFinite(Number(s)) ? Number(s) : undefined);
    const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    return {
      organisation: sector.trim() ? { sector: sector.trim() } : {},
      estate: {
        users: num(users),
        sites: num(sites),
        devices: { computers: num(computers) ?? 0, mobiles: num(mobiles) ?? 0, servers: num(servers) ?? 0 },
        specialDevices: special,
        cloud,
        ...(existingSecurity.trim() ? { existingSecurity: list(existingSecurity) } : {}),
        ...(existingNetwork.trim() ? { existingNetwork: list(existingNetwork) } : {}),
      },
      drivers,
      constraints: {
        complianceRequirements: compliance,
        ...(soc ? { inHouseSocCapacity: soc } : {}),
      },
    };
  }, [users, sites, computers, mobiles, servers, sector, cloud, special, existingSecurity, existingNetwork, drivers, compliance, soc]);

  useEffect(() => {
    let cancelled = false;
    assessSecurityRequirement(requirement).then((v) => {
      if (!cancelled) setVerdict(v);
    });
    return () => {
      cancelled = true;
    };
  }, [requirement]);

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function createProject() {
    if (creating || !consent) return;
    setCreating(true);
    setCreateError("");
    try {
      const resp = await fetch("/api/security-sourcing/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirement, consent: true }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.project?.id) {
        // Land on the Project Home (Phase D1): the Project is the container,
        // the builder is one surface inside it. The manage key travels so
        // anonymous drafts keep working. Raw anchor below, so the basePath
        // is explicit (the previous builder link was missing it too).
        const manage = data.project?.manage_token ? `?manage=${encodeURIComponent(data.project.manage_token)}` : "";
        setCreated({ builderPath: `/sase/project/${data.project.id}${manage}`, projectId: data.project.id });
      } else {
        setCreateError(data.error || "Could not create the project; try again.");
      }
    } catch {
      setCreateError("Network error; try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* -------- Inputs -------- */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5">
        <p className="text-sm font-semibold text-zinc-900">Your estate and situation</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-zinc-600">Staff
            <input value={users} onChange={(e) => setUsers(e.target.value)} inputMode="numeric" placeholder="e.g. 120" className={inputCls} />
          </label>
          <label className="text-xs font-medium text-zinc-600">Sites (0 = fully remote)
            <input value={sites} onChange={(e) => setSites(e.target.value)} inputMode="numeric" placeholder="e.g. 3" className={inputCls} />
          </label>
          <label className="text-xs font-medium text-zinc-600">Computers
            <input value={computers} onChange={(e) => setComputers(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </label>
          <label className="text-xs font-medium text-zinc-600">Mobiles
            <input value={mobiles} onChange={(e) => setMobiles(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </label>
          <label className="text-xs font-medium text-zinc-600">Servers
            <input value={servers} onChange={(e) => setServers(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </label>
          <label className="text-xs font-medium text-zinc-600">Sector (optional)
            <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. retail" className={inputCls} />
          </label>
        </div>

        <p className="mt-4 text-xs font-medium text-zinc-600">Cloud platforms</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CLOUDS.map((c) => (
            <button key={c} type="button" onClick={() => setCloud(toggle(cloud, c))} className={chipCls(cloud.includes(c))}>{c}</button>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-zinc-600">Special devices</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(["chromebook", "epos"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSpecial(toggle(special, s))} className={chipCls(special.includes(s))}>{s === "epos" ? "EPOS tills" : "Chromebooks"}</button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium text-zinc-600">Existing security tooling (comma-separated; leave blank if unsure)
          <input value={existingSecurity} onChange={(e) => setExistingSecurity(e.target.value)} placeholder="e.g. Defender P2, MSP-managed AV" className={inputCls} />
        </label>
        <label className="mt-3 block text-xs font-medium text-zinc-600">Network estate (comma-separated)
          <input value={existingNetwork} onChange={(e) => setExistingNetwork(e.target.value)} placeholder="e.g. BTnet, MPLS" className={inputCls} />
        </label>

        <p className="mt-4 text-xs font-medium text-zinc-600">What is prompting this?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DRIVERS.map((d) => (
            <button key={d.id} type="button" onClick={() => setDrivers(toggle(drivers, d.id))} className={chipCls(drivers.includes(d.id))}>{d.label}</button>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-zinc-600">Compliance regimes</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COMPLIANCE.map((c) => (
            <button key={c} type="button" onClick={() => setCompliance(toggle(compliance, c))} className={chipCls(compliance.includes(c))}>{c}</button>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-zinc-600">In-house security operations cover</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([["none", "None"], ["business_hours", "Business hours"], ["twenty_four_seven", "24/7"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setSoc(soc === v ? "" : v)} className={chipCls(soc === v)}>{label}</button>
          ))}
        </div>
      </div>

      {/* -------- Verdict -------- */}
      <div className="space-y-4">
        {verdict && (
          <>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">The verdict</p>
                <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
                  {verdict.rulebookVersion} · confidence {verdict.confidence}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {verdict.capabilities.map((c) => (
                  <div key={c.id} className={`rounded-lg border p-3 ${NEEDED_STYLE[c.needed]}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{CAP_LABEL[c.id] ?? c.id}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">{c.needed.replace("_", " ")}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed">{c.reasoning}</p>
                    {c.routeDetail && <p className="mt-1 text-xs opacity-80">{c.routeDetail}</p>}
                  </div>
                ))}
              </div>
            </div>

            {verdict.summary.not_recommended.length > 0 && (
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-5">
                <p className="text-sm font-semibold text-zinc-900">Why we did not recommend</p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                  {verdict.summary.not_recommended.map((n) => (
                    <li key={n.capabilityId}>
                      <span className="font-medium text-zinc-900">{CAP_LABEL[n.capabilityId] ?? n.capabilityId}:</span> {n.reason}
                      {n.alternative && <span className="text-zinc-600"> {n.alternative}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {verdict.againstInterest.length > 0 && (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Said against our own interest</p>
                <ul className="mt-2 space-y-1.5 text-sm text-emerald-900">
                  {verdict.againstInterest.map((a, i) => (
                    <li key={i}>{a.statement}</li>
                  ))}
                </ul>
              </div>
            )}

            {verdict.gaps.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-zinc-900">Answer these to sharpen the verdict</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                  {verdict.gaps.map((g) => (
                    <li key={g.field}>{g.question}</li>
                  ))}
                </ul>
              </div>
            )}

            {created ? (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-900">Your project is created and your RFP is drafted.</p>
                <p className="mt-1 text-sm text-emerald-800">
                  The verdict is attached as its first record, and the RFP has been generated from it:
                  question bank sections for each capability you need, with what was excluded and why
                  recorded in the document. Your project home shows the assessment, the document, any
                  open gaps and what happens next; sign in there to keep it and to publish when ready.
                </p>
                <a href={created.builderPath} className="mt-3 inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-emerald-700">
                  Open your project
                </a>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-amber-400 bg-white p-5">
                <p className="text-sm font-semibold text-zinc-950">Create your Security Sourcing project</p>
                <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  <span>{CREATE_CONSENT_TEXT}</span>
                </label>
                {createError && <p className="mt-2 text-sm text-rose-600">{createError}</p>}
                <button
                  type="button"
                  onClick={createProject}
                  disabled={!consent || creating || verdict.confidence === "low"}
                  className="mt-3 inline-flex items-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create project and build the RFP"}
                </button>
                {verdict.confidence === "low" && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Answer the questions above first: a project is not created on guesswork.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
