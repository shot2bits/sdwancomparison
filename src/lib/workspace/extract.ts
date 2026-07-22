/**
 * Live Sourcing Workspace: the extraction organ (W0 slice 1, spec v1.3
 * section 4). Free buyer text becomes the EXACT SecurityRequirementInput
 * shape the engine already assesses, so extraction feeds assess/create
 * unchanged (Mandate: the page and an agent build the identical object).
 *
 * Robert's decision (21 July): model-first, AI reads everything. The
 * engineering rail around that choice, also decided: the model PROPOSES
 * field updates but never writes; every proposal passes the deterministic
 * validator (whitelisted paths, enum vocabularies, clamped numbers) before
 * it lands; provenance is proven, not claimed (a proposal is "stated" only
 * when its quote actually appears in the buyer's text); and when the model
 * is absent, slow or down, the deterministic parsers carry on alone so the
 * page never stalls.
 *
 * Truth rule 2 (provenance) is enforced here at the source: every update
 * carries stated | inferred plus the quote or reason.
 */

import type { SecurityRequirementInput, SecurityDriver, SocCapacity } from "@/lib/security/rulebook";

export type Provenance = "stated" | "inferred";

export type FieldUpdate = {
  path: AllowedPath;
  value: unknown;
  provenance: Provenance;
  quote?: string;
  reason?: string;
};

export type ExtractResult = {
  requirement: SecurityRequirementInput;
  updates: FieldUpdate[];
  engine: "model" | "deterministic_fallback";
  model?: string;
  notes: string[];
};

/* ------------------------------------------------------------------ */
/* Vocabularies: one truth with the advisor and the rulebook           */
/* ------------------------------------------------------------------ */

export const WORKSPACE_SECTORS = [
  "Healthcare & pharma",
  "Financial services",
  "Retail & e-commerce",
  "Manufacturing",
  "Energy & utilities",
  "Government & public sector",
  "Education",
  "Transport & logistics",
  "Professional services",
  "Hospitality & leisure",
] as const;

const DRIVER_IDS: SecurityDriver[] = ["incident", "audit", "compliance", "renewal", "growth", "consolidation", "ransomware_concern"];
const SOC_IDS: SocCapacity[] = ["none", "business_hours", "twenty_four_seven"];
const COMPLIANCE_IDS = ["iso27001", "pci_dss", "cyber_essentials_plus", "fca", "nhs_dspt"];
const CLOUD_IDS = ["m365", "google", "aws", "azure", "other_saas"];
const NETWORK_IDS = ["btnet", "bt_broadband", "mpls", "sdwan", "vpn", "leased_line", "broadband"];
const REGION_IDS = ["uk", "ie", "eu", "us", "apac", "me"];

/** What the buyer is BUYING (W0 slice 2): the workspace serves security,
 *  SASE and SD-WAN through one surface, so the loop needs to hear the
 *  difference between what an organisation HAS (estate.existingNetwork)
 *  and what it SEEKS. These two paths are workspace-level facts: they
 *  steer the surface and the publish route, and they never enter
 *  SecurityRequirementInput, whose shape stays exactly the engine's
 *  contract (applyUpdates ignores them by design). */
export const BUYING_IDS = ["managed_security", "sase", "sdwan", "sse"] as const;
export type BuyingId = (typeof BUYING_IDS)[number];
export const OPERATING_MODEL_IDS = ["managed", "co_managed", "diy"] as const;
export type OperatingModelId = (typeof OPERATING_MODEL_IDS)[number];

const ALLOWED_PATHS = [
  "organisation.sector",
  "organisation.sizeBand",
  "organisation.regions",
  "estate.users",
  "estate.sites",
  "estate.cloud",
  "estate.existingSecurity",
  "estate.existingNetwork",
  "drivers",
  "constraints.complianceRequirements",
  "constraints.inHouseSocCapacity",
  "constraints.timeline",
  "constraints.budgetBand",
  "procurement.buying",
  "procurement.operatingModel",
] as const;
export type AllowedPath = (typeof ALLOWED_PATHS)[number];

/* ------------------------------------------------------------------ */
/* Validator rail: the model proposes, this decides                    */
/* ------------------------------------------------------------------ */

const clean = (s: unknown, max = 120) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

function validate(path: string, value: unknown, notes: string[]): { path: AllowedPath; value: unknown } | null {
  if (!(ALLOWED_PATHS as readonly string[]).includes(path)) {
    notes.push(`Dropped a proposal for unknown field "${clean(path, 40)}".`);
    return null;
  }
  const p = path as AllowedPath;
  const asList = (v: unknown) => (Array.isArray(v) ? v : [v]);
  const enumList = (ids: string[], v: unknown, label: string) => {
    const out = asList(v).map((x) => clean(x, 40).toLowerCase().replace(/[\s-]+/g, "_")).filter((x) => ids.includes(x));
    if (out.length === 0) { notes.push(`Dropped ${label}: no recognised values.`); return null; }
    return [...new Set(out)];
  };
  switch (p) {
    case "estate.users":
    case "estate.sites": {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 1 || n > (p === "estate.users" ? 500000 : 20000)) { notes.push(`Dropped ${p}: not a sensible number.`); return null; }
      return { path: p, value: n };
    }
    case "organisation.sector": {
      const s = clean(value, 60);
      const hit = WORKSPACE_SECTORS.find((x) => x.toLowerCase() === s.toLowerCase());
      if (hit) return { path: p, value: hit };
      if (/[a-zA-Z]{3,}/.test(s)) return { path: p, value: s };
      notes.push("Dropped sector: needs letters.");
      return null;
    }
    case "organisation.sizeBand": {
      const s = clean(value, 12).toLowerCase();
      return ["small", "medium", "large"].includes(s) ? { path: p, value: s } : null;
    }
    case "organisation.regions": { const v = enumList(REGION_IDS, value, "regions"); return v ? { path: p, value: v } : null; }
    case "estate.cloud": { const v = enumList(CLOUD_IDS, value, "cloud"); return v ? { path: p, value: v } : null; }
    case "estate.existingNetwork": { const v = enumList(NETWORK_IDS, value, "network"); return v ? { path: p, value: v } : null; }
    case "estate.existingSecurity": {
      const v = asList(value).map((x) => clean(x, 60)).filter((x) => /[a-zA-Z]{2,}/.test(x)).slice(0, 8);
      return v.length ? { path: p, value: v } : null;
    }
    case "drivers": { const v = enumList(DRIVER_IDS, value, "drivers"); return v ? { path: p, value: v } : null; }
    case "constraints.complianceRequirements": { const v = enumList(COMPLIANCE_IDS, value, "compliance"); return v ? { path: p, value: v } : null; }
    case "constraints.inHouseSocCapacity": {
      const s = clean(value, 24).toLowerCase().replace(/[\s-]+/g, "_");
      return (SOC_IDS as string[]).includes(s) ? { path: p, value: s } : null;
    }
    case "constraints.timeline":
    case "constraints.budgetBand": {
      const s = clean(value, 80);
      return /[a-zA-Z0-9]{2,}/.test(s) ? { path: p, value: s } : null;
    }
    case "procurement.buying": {
      const s = clean(value, 24).toLowerCase().replace(/[\s-]+/g, "_");
      return (BUYING_IDS as readonly string[]).includes(s) ? { path: p, value: s } : null;
    }
    case "procurement.operatingModel": {
      const s = clean(value, 24).toLowerCase().replace(/[\s-]+/g, "_");
      return (OPERATING_MODEL_IDS as readonly string[]).includes(s) ? { path: p, value: s } : null;
    }
  }
}

/** Merge updates into a requirement by explicit path (no generic setter). */
export function applyUpdates(base: SecurityRequirementInput, updates: FieldUpdate[]): SecurityRequirementInput {
  const r: SecurityRequirementInput = {
    organisation: { ...(base.organisation ?? {}) },
    estate: { ...(base.estate ?? {}) },
    drivers: [...(base.drivers ?? [])],
    constraints: { ...(base.constraints ?? {}) },
  };
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  for (const u of updates) {
    switch (u.path) {
      case "organisation.sector": r.organisation!.sector = u.value as string; break;
      case "organisation.sizeBand": r.organisation!.sizeBand = u.value as "small" | "medium" | "large"; break;
      case "organisation.regions": r.organisation!.regions = uniq([...(r.organisation!.regions ?? []), ...(u.value as string[])]); break;
      case "estate.users": r.estate!.users = u.value as number; break;
      case "estate.sites": r.estate!.sites = u.value as number; break;
      case "estate.cloud": r.estate!.cloud = uniq([...(r.estate!.cloud ?? []), ...(u.value as string[])]); break;
      case "estate.existingSecurity": r.estate!.existingSecurity = uniq([...(r.estate!.existingSecurity ?? []), ...(u.value as string[])]); break;
      case "estate.existingNetwork": r.estate!.existingNetwork = uniq([...(r.estate!.existingNetwork ?? []), ...(u.value as string[])]); break;
      case "drivers": r.drivers = uniq([...(r.drivers ?? []), ...(u.value as SecurityDriver[])]); break;
      case "constraints.complianceRequirements": r.constraints!.complianceRequirements = uniq([...(r.constraints!.complianceRequirements ?? []), ...(u.value as string[])]); break;
      case "constraints.inHouseSocCapacity": r.constraints!.inHouseSocCapacity = u.value as SocCapacity; break;
      case "constraints.timeline": r.constraints!.timeline = u.value as string; break;
      case "constraints.budgetBand": r.constraints!.budgetBand = u.value as string; break;
      case "procurement.buying":
      case "procurement.operatingModel":
        // Workspace-level facts: they steer the surface and the publish
        // route; the requirement object stays exactly the engine's shape.
        break;
    }
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Deterministic parsers: the always-on baseline and the fallback      */
/* ------------------------------------------------------------------ */

export function deterministicExtract(text: string): FieldUpdate[] {
  const t = ` ${text.toLowerCase()} `;
  const out: FieldUpdate[] = [];
  const say = (path: AllowedPath, value: unknown, quote: string) => out.push({ path, value, provenance: "stated", quote });
  const infer = (path: AllowedPath, value: unknown, reason: string) => out.push({ path, value, provenance: "inferred", reason });

  // One describing word may sit between the number and its noun ("18 retail
  // stores", "50 remote users"): the exact shape of Robert's own live
  // sentence the rail missed on 21 July (the rich-sentence test, 13.10).
  const users = /(\d{1,6})\s*(?:\w+\s+)?(?:users?|staff|employees?|people|seats?|heads)\b/.exec(t);
  if (users) say("estate.users", Number(users[1]), users[0].trim());
  const sites = /(\d{1,4})\s*(?:\w+\s+)?(?:sites?|stores?|branch(?:es)?|offices?|locations?|shops?|practices?)\b/.exec(t);
  if (sites) say("estate.sites", Number(sites[1]), sites[0].trim());

  const sectorMap: Array<[RegExp, (typeof WORKSPACE_SECTORS)[number]]> = [
    [/retail|e-?commerce|shops?\b|stores?\b/, "Retail & e-commerce"],
    [/health|nhs|clinic|pharma|hospital|care home/, "Healthcare & pharma"],
    [/bank|financial|insur|fintech|wealth/, "Financial services"],
    [/manufactur|factory|factories|plant\b/, "Manufacturing"],
    [/school|universit|college|educat/, "Education"],
    [/hotel|restaurant|hospitality|leisure|pub\b/, "Hospitality & leisure"],
    [/council|government|public sector/, "Government & public sector"],
    [/logistics|transport|haulage|freight/, "Transport & logistics"],
    [/law firm|solicitor|accountanc|consultanc|professional services/, "Professional services"],
    [/energy|utilit/, "Energy & utilities"],
  ];
  for (const [re, sector] of sectorMap) {
    const m = re.exec(t);
    if (m) { infer("organisation.sector", sector, `"${m[0].trim()}" indicates this sector`); break; }
  }

  if (/\buk\b|united kingdom|britain/.test(t)) say("organisation.regions", ["uk"], "UK");
  if (/microsoft|m365|office ?365|\bo365\b/.test(t)) say("estate.cloud", ["m365"], "Microsoft");
  if (/azure/.test(t)) say("estate.cloud", ["azure"], "Azure");
  if (/google workspace|gsuite/.test(t)) say("estate.cloud", ["google"], "Google Workspace");
  if (/\baws\b/.test(t)) say("estate.cloud", ["aws"], "AWS");
  if (/sd-?wan/.test(t)) say("estate.existingNetwork", ["sdwan"], "SD-WAN");
  if (/\bmpls\b/.test(t)) say("estate.existingNetwork", ["mpls"], "MPLS");

  if (/incident|breach|phishing|attack|compromis|hacked/.test(t)) say("drivers", ["incident"], "incident");
  if (/ransomware/.test(t)) say("drivers", ["ransomware_concern"], "ransomware");
  if (/renewal|contract end|contract expir|contract is up|ends? in march|ends? in \w+ 20\d\d/.test(t)) say("drivers", ["renewal"], "contract renewal");
  if (/audit/.test(t)) say("drivers", ["audit"], "audit");
  if (/acquisition|merger|growing fast|expansion/.test(t)) say("drivers", ["growth"], "growth");

  if (/iso ?27001/.test(t)) say("constraints.complianceRequirements", ["iso27001"], "ISO 27001");
  if (/pci/.test(t)) say("constraints.complianceRequirements", ["pci_dss"], "PCI");
  else if (/card payments|take cards|card-present/.test(t)) infer("constraints.complianceRequirements", ["pci_dss"], "card payments bring PCI DSS into scope");
  if (/cyber essentials/.test(t)) say("constraints.complianceRequirements", ["cyber_essentials_plus"], "Cyber Essentials");
  if (/nhs dspt|\bdspt\b/.test(t)) say("constraints.complianceRequirements", ["nhs_dspt"], "NHS DSPT");
  if (/\bfca\b/.test(t)) say("constraints.complianceRequirements", ["fca"], "FCA");

  if (/24\/7|24x7|around.the.clock|twenty.four/.test(t)) say("constraints.inHouseSocCapacity", "twenty_four_seven", "24/7");
  else if (/nobody watching|no out.of.hours|no overnight|no soc\b|no security team/.test(t)) say("constraints.inHouseSocCapacity", "none", "no out-of-hours cover");

  // What they are BUYING (distinct from what they have). Seeking verbs near
  // a product term read as procurement intent; security service terms are
  // strong enough on their own because they are not estate descriptions.
  const seek = "(?:need|want|looking for|buy|buying|procure|procuring|source|sourcing|tender|rfp|quotes? for|moving to|migrat\\w+ to|replace \\w+ with|roll(?:ing)? out|deploy(?:ing)?)";
  const buyRe = (term: string) => new RegExp(`${seek}[^.!?]{0,60}\\b${term}|\\b${term}\\b[^.!?]{0,30}(?:rollout|roll-out|project|procurement|tender|rfp)`);
  if (/\bmdr\b|\bmssp\b|managed (?:security|detection|soc|siem)|security (?:partner|provider|service|operations centre)|\bsoc\b service|incident response service/.test(t)) {
    say("procurement.buying", "managed_security", "managed security");
  } else if (buyRe("sase").test(t)) say("procurement.buying", "sase", "SASE");
  else if (buyRe("sse|security service edge|secure service edge").test(t)) say("procurement.buying", "sse", "SSE");
  else if (buyRe("sd-?wan").test(t)) {
    say("procurement.buying", "sdwan", "SD-WAN");
    // The SD-WAN mention was a purchase intent, so it is not evidence of
    // the estate: withdraw the blanket existing-network claim above.
    const i = out.findIndex((u) => u.path === "estate.existingNetwork" && Array.isArray(u.value) && (u.value as string[]).includes("sdwan"));
    if (i >= 0) out.splice(i, 1);
  }

  if (/fully managed|managed service|manage it for us|no in.house it|outsourced?/.test(t)) say("procurement.operatingModel", "managed", "managed service");
  else if (/co-?managed/.test(t)) say("procurement.operatingModel", "co_managed", "co-managed");
  else if (/\bdiy\b|self-?managed|manage (?:it )?ourselves|in-?house managed/.test(t)) say("procurement.operatingModel", "diy", "self-managed");

  return out;
}

/* ------------------------------------------------------------------ */
/* The model call: proposes, never writes                              */
/* ------------------------------------------------------------------ */

const MODEL = "claude-haiku-4-5-20251001";
/** 9s, raised from 6s on live evidence (21 July): warm full-sentence calls
 *  measured 3.1 to 4.4s, but cold calls tripped 6s and fell back. The
 *  deterministic rail still catches anything slower, so the page never
 *  stalls; the budget just stops surrendering the model on cold starts. */
const TIMEOUT_MS = 9000;

const SYSTEM_PROMPT = `You extract structured procurement facts from a buyer's free-text description of their business and security/network need. Output ONLY a JSON object, no prose, of the shape {"fields":[{"path":string,"value":any,"quote":string|null,"reason":string|null}]}.
Rules:
- Allowed paths, exactly: ${ALLOWED_PATHS.join(", ")}.
- Enumerations: drivers ${DRIVER_IDS.join("|")}; constraints.inHouseSocCapacity ${SOC_IDS.join("|")}; constraints.complianceRequirements ${COMPLIANCE_IDS.join("|")}; estate.cloud ${CLOUD_IDS.join("|")}; estate.existingNetwork ${NETWORK_IDS.join("|")}; organisation.regions ${REGION_IDS.join("|")}; organisation.sector one of ${WORKSPACE_SECTORS.join("; ")} (or the buyer's own words if none fits); procurement.buying ${BUYING_IDS.join("|")}; procurement.operatingModel ${OPERATING_MODEL_IDS.join("|")}.
- procurement.buying is what they SEEK to buy (managed_security covers MDR, SOC, SIEM, MSSP and managed security services); estate.existingNetwork and estate.existingSecurity are what they already HAVE. Never confuse the two.
- Drivers are exact meanings, not intensities: "incident" only for an actual or ongoing incident (phishing, breach, compromise); "ransomware_concern" only when the buyer names ransomware. Do not escalate one into the other.
- "quote": if the buyer literally said it, copy their exact words (a short verbatim substring). If you inferred it, set quote to null and give a one-line "reason".
- Never invent facts. Omit what the text does not support. Fewer, correct fields beat many guesses.`;

type ModelProposal = { path?: unknown; value?: unknown; quote?: unknown; reason?: unknown };

async function modelExtract(text: string, notes: string[]): Promise<FieldUpdate[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { notes.push("Model extraction unavailable: no API key configured."); return null; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) { notes.push(`Model extraction unavailable (${res.status}); deterministic parsing used.`); return null; }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const jsonText = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(jsonText) as { fields?: ModelProposal[] };
    if (!Array.isArray(parsed.fields)) { notes.push("Model reply was not the agreed shape; deterministic parsing used."); return null; }
    const lower = text.toLowerCase();
    const out: FieldUpdate[] = [];
    for (const f of parsed.fields.slice(0, 30)) {
      const ok = validate(String(f.path ?? ""), f.value, notes);
      if (!ok) continue;
      const quote = typeof f.quote === "string" ? clean(f.quote, 160) : "";
      const stated = quote.length > 2 && lower.includes(quote.toLowerCase());
      out.push({
        path: ok.path,
        value: ok.value,
        provenance: stated ? "stated" : "inferred",
        ...(stated ? { quote } : {}),
        ...(!stated ? { reason: clean(f.reason ?? (quote ? "the quoted words were not found verbatim in your text" : "derived from your description"), 160) } : {}),
      });
    }
    return out;
  } catch (e) {
    notes.push(e instanceof Error && e.name === "AbortError" ? "Model extraction timed out; deterministic parsing used." : "Model extraction failed; deterministic parsing used.");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* The public entry: model-first with the deterministic safety net     */
/* ------------------------------------------------------------------ */

/** Paths that accumulate values; everything else holds one value. Shared
 *  with the draft model's fact ledger. */
export const LIST_FACT_PATHS: ReadonlySet<string> = new Set([
  "organisation.regions",
  "estate.cloud",
  "estate.existingSecurity",
  "estate.existingNetwork",
  "drivers",
  "constraints.complianceRequirements",
]);

/**
 * Union of the model's proposals and the deterministic parse (21 July live
 * finding: model-first-REPLACES lost facts the regex rail hears, a live
 * run missed "300 staff" and a stated SD-WAN buying intent). The model
 * wins per path where both speak; the deterministic parse fills what the
 * model omitted. Provenance travels per update either way, so nothing is
 * relabelled by the merge.
 */
export function unionUpdates(model: FieldUpdate[], det: FieldUpdate[]): FieldUpdate[] {
  const scalarCovered = new Set(model.filter((u) => !LIST_FACT_PATHS.has(u.path)).map((u) => u.path));
  const listCovered = new Map<string, Set<string>>();
  for (const u of model) {
    if (!LIST_FACT_PATHS.has(u.path) || !Array.isArray(u.value)) continue;
    const seen = listCovered.get(u.path) ?? new Set<string>();
    for (const v of u.value as unknown[]) seen.add(String(v).toLowerCase());
    listCovered.set(u.path, seen);
  }
  const extra: FieldUpdate[] = [];
  for (const u of det) {
    if (!LIST_FACT_PATHS.has(u.path)) {
      if (!scalarCovered.has(u.path)) extra.push(u);
      continue;
    }
    const seen = listCovered.get(u.path);
    const vals = (Array.isArray(u.value) ? u.value : [u.value]).filter((v) => !seen?.has(String(v).toLowerCase()));
    if (vals.length) extra.push({ ...u, value: vals });
  }
  return [...model, ...extra];
}

export async function extractRequirement(text: string, base: SecurityRequirementInput = {}): Promise<ExtractResult> {
  const notes: string[] = [];
  const det = deterministicExtract(text);
  const modelUpdates = await modelExtract(text, notes);
  const modelSpoke = Boolean(modelUpdates && modelUpdates.length > 0);
  const updates = modelSpoke ? unionUpdates(modelUpdates!, det) : det;
  const engine = modelSpoke ? "model" : "deterministic_fallback";
  return {
    requirement: applyUpdates(base, updates),
    updates,
    engine,
    ...(engine === "model" ? { model: MODEL } : {}),
    notes,
  };
}

export const WORKSPACE_EXTRACT_MODEL = MODEL;
