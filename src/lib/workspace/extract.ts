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
const COMPLIANCE_IDS = ["iso27001", "pci_dss", "cyber_essentials_plus", "fca", "nhs_dspt", "nis2", "uk_gdpr"];
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
      /* The model sometimes returns a compound free-text answer as an id,
       * because the prompt asks for ids on the enumerated paths and it
       * over-applies the habit: "contract signed by December 2026, live by
       * March 2027" came back as
       * contract_signed_december_2026_live_march_2027 and would have
       * rendered verbatim in the buyer's own downloaded document (30 Jul
       * 2026). These two paths are FREE TEXT, so an underscored token with
       * no spaces is always a slugged sentence, never a real answer. */
      let s = clean(value, 80);
      if (!/\s/.test(s) && s.includes("_")) s = s.replace(/_+/g, " ").trim();
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

/** The negation window (F-B, Robert's highest-priority verdict, 22 July:
 *  "the ledger must never briefly say Fully managed when the buyer said the
 *  opposite; the correction mechanism is not a licence to record something
 *  known to be the opposite of what was said"). A match lands only when no
 *  negator sits just before it or just after it. Conservative by design:
 *  wrongly suppressing costs an omission the receipt catches; wrongly
 *  landing records a lie. */
function negatedAt(t: string, i: number, len: number): boolean {
  const before = t.slice(Math.max(0, i - 28), i);
  const after = t.slice(i + len, i + len + 26);
  if (/\b(?:no|not|never|without|except|excluding|apart from|rather than|instead of|don'?t|doesn'?t|do not|does not|won'?t|wouldn'?t|isn'?t|aren'?t|can'?t|cannot|stopped using|moving (?:away|off)|moved (?:away|off))\s+(?:\w+\s+){0,2}$/.test(before)) return true;
  if (/^\s{0,3}(?:is |are |was |were )?(?:not\b|no longer\b|never\b|doesn'?t\b|does not\b|isn'?t\b|aren'?t\b)/.test(after)) return true;
  return false;
}

export function deterministicExtract(text: string): FieldUpdate[] {
  const t = ` ${text.toLowerCase()} `;
  const out: FieldUpdate[] = [];
  const sink: string[] = []; // validator notes; omissions surface via the receipt
  /** F-D (design integrity, Robert: "the validator exists so every path
   *  reaches the same truth; the rail shouldn't be exempt"): every rail
   *  statement passes the SAME validate() a model proposal passes. What
   *  fails validation is omitted, and the receipt keeps the clause. */
  const say = (path: AllowedPath, value: unknown, quote: string) => {
    const ok = validate(path, value, sink);
    if (ok) out.push({ path: ok.path, value: ok.value, provenance: "stated", quote });
  };
  const infer = (path: AllowedPath, value: unknown, reason: string) => {
    const ok = validate(path, value, sink);
    if (ok) out.push({ path: ok.path, value: ok.value, provenance: "inferred", reason });
  };
  /** A match that lands only outside the negation window. */
  const hit = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(t);
    return m && !negatedAt(t, m.index, m[0].length) ? m : null;
  };

  // Numbers (F-A, semantic integrity: 2, 2,000 and 2 million users are
  // different procurements). Thousands separators parse; magnitude words
  // multiply; one describing word may still sit between the number and its
  // noun ("50 remote users"). A value outside the validator's bounds is
  // OMITTED rather than mangled, so the clause lands in Notes, unplaced.
  const NUM = "(\\d{1,3}(?:,\\d{3})+|\\d{1,7})\\s*(k\\b|thousand\\b|m\\b|million\\b)?";
  const magnitude = (digits: string, mag: string | undefined): number =>
    Math.round(Number(digits.replace(/,/g, "")) * (mag ? (mag.startsWith("k") || mag.startsWith("t") ? 1e3 : 1e6) : 1));
  const users = hit(new RegExp(`${NUM}\\s*(?:\\w+\\s+)?(?:users?|staff|employees?|people|seats?|heads)\\b`));
  if (users) say("estate.users", magnitude(users[1], users[2]), users[0].trim());
  /* "clinics" joined the noun list 31 Jul 2026 (round 6 dry run: "60
   * clinics" from an NHS buyer landed nothing while "60 shops" landed;
   * same in-lane precedent as the timeline patterns). */
  const sites = hit(new RegExp(`${NUM}\\s*(?:\\w+\\s+)?(?:sites?|stores?|branch(?:es)?|offices?|locations?|shops?|practices?|clinics?)\\b`));
  if (sites) say("estate.sites", magnitude(sites[1], sites[2]), sites[0].trim());

  /* Timeline (round three, 31 Jul 2026; the P1 lane's finding made real:
   * nothing here ever landed constraints.timeline, while R7 holds the
   * signature shut on it, so every buyer who stated their date naturally
   * was told the timeline was missing. Buyers state time as a date with a
   * delivery verb ("live by June 2027"), a contract event ("the MPLS
   * contract ends March 2027": the work must land before the estate goes
   * dark, so the phrase IS the timeline), a horizon ("within 9 months")
   * or a bare deadline ("before Q2 2027"). Every pattern requires a dated
   * anchor, so "by our team" can never land. The buyer's whole clause is
   * the value: the path is free text and their words beat normalisation. */
  {
    const DATEISH = "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+20\\d\\d|(?:q[1-4]|h[12])\\s*20\\d\\d|(?:spring|summer|autumn|winter)\\s+20\\d\\d|20\\d\\d)";
    const timeline =
      hit(new RegExp(`(?:live|go[- ]?live|in place|delivered|deployed|migrat(?:ed|ing)|rolled out|completed?|operational|finished|cut(?:ting)? over|ready|working|done)[^.,;]{0,25}?(?:by|before|during|in|for)\\s+(?:the\\s+)?(?:end of\\s+)?${DATEISH}`)) ??
      hit(new RegExp(`(?:contract|term|agreement|mpls|circuits?)[^.,;]{0,30}?(?:ends?|expir(?:es?|y|ing)|renews?|renewal|up)[^.,;]{0,12}?${DATEISH}`)) ??
      hit(new RegExp(`(?:timeline|deadline|target)[^.,;]{0,12}?(?:is|:)?[^.,;]{0,20}?${DATEISH}`)) ??
      hit(new RegExp(`(?:by|before|no later than)\\s+(?:the\\s+)?(?:end of\\s+)?${DATEISH}`)) ??
      hit(/within\s+(?:the\s+next\s+)?\d{1,2}\s+(?:weeks?|months?)/);
    if (timeline) say("constraints.timeline", timeline[0].trim(), timeline[0].trim());
  }

  /* The sector inference map, widened under Robert's intake-truth ruling
   * (28 Jul 2026, mapping reviewed and approved by him): buyers describe
   * their ESTATE, not their sector, so the estate vocabulary carries the
   * inference. Ambiguity is handled with compound patterns, never with
   * guesses. Rows run in order and the first match wins, so compound
   * professional terms (law practice) sit below healthcare, whose own
   * compounds (gp, dental) would otherwise never fire. Every inference
   * renders labelled with its trigger and stays correctable.
   *
   * NEVER MAPPED ALONE, by design, with reasons: site(s) is the
   * platform's own estate vocabulary; branch(es) belongs to banks and
   * retailers alike; trust alone is financial as often as NHS; campus
   * alone is corporate as often as academic; practice alone is medical
   * as often as legal; fleet alone describes device estates; port(s) is
   * network vocabulary here; outlet(s) is electrical as often as retail;
   * grid alone is compute vocabulary; mat alone collides with ordinary
   * words (their compounds map below); agency and department are too
   * generic to carry any sector. */
  const sectorMap: Array<[RegExp, (typeof WORKSPACE_SECTORS)[number]]> = [
    [/health|nhs trust|hospital trust|foundation trust|\bnhs\b|clinic|pharma|hospital|care home|care group|surger(?:y|ies)\b|\bwards?\b|\bgp\b|dental|dentist|veterinary|vet practice|pharmac(?:y|ies)|hospice/, "Healthcare & pharma"],
    [/retail|e-?commerce|shops?\b|stores?\b|showrooms?\b|dealerships?\b|supermarkets?\b|convenience store|high street|retail outlets?|outlet stores?|\btills\b|click and collect/, "Retail & e-commerce"],
    [/bank|financial|insur|fintech|wealth|building societ|credit union|asset management|brokerage|\blenders?\b|lending|mortgage|underwrit/, "Financial services"],
    [/manufactur|factory|factories|plant\b|production line|assembly plant|foundr(?:y|ies)|\bmills?\b|fabrication|packaging line/, "Manufacturing"],
    [/school|universit|college|educat|academ(?:y|ies)\b|multi-?academy|academy trust|sixth form|nurser(?:y|ies)|school campus|university campus/, "Education"],
    [/hotel|restaurant|hospitality|leisure|pub\b|\bgyms?\b|\bspas?\b|cinemas?\b|casinos?\b|holiday park|caravan park|golf club|stadium|\bbars?\b|caf(?:e|es)\b|coffee shop/, "Hospitality & leisure"],
    [/council|government|public sector|\bborough\b|housing association|\bpolice\b|fire service|emergency services|ministry/, "Government & public sector"],
    [/logistics|transport|haulage|freight|depots?\b|distribution centre|warehouses?\b|couriers?\b|\bhgvs?\b|lorr(?:y|ies)|vehicle fleet/, "Transport & logistics"],
    [/law firm|solicitor|accountanc|consultanc|professional services|\bchambers\b|law practice|accountancy practice|architects?\b|surveyors?\b|recruitment agenc/, "Professional services"],
    [/energy|utilit|substations?\b|power grid|national grid|water compan|renewables|wind farm|solar farm/, "Energy & utilities"],
  ];
  for (const [re, sector] of sectorMap) {
    const m = hit(re);
    if (m) { infer("organisation.sector", sector, `"${m[0].trim()}" indicates this sector`); break; }
  }

  /* Round 9 catch (2 Aug 2026, live QA finding): "24x7 UK-based support"
   * landed organisation.regions=uk off the bare word "UK", with nothing
   * checking WHAT the mention describes. "UK-based support" names where
   * a VENDOR must operate, not where the buyer is -- the exact same
   * mistake as every operating-model/timeline guard above, just living
   * in the rail instead of the vetting layer, and worse here because
   * "UK"/"US"/country names are common words that show up constantly in
   * requirement clauses that have nothing to do with the buyer's own
   * location (support, vendors, references, data residency). A region
   * only counts as the buyer's own location when the words right after
   * it are not naming a requirement the vendor/service must meet; there
   * is no field yet for "the vendor must be UK-based", so those clauses
   * are left alone and fall through to their receipt rather than being
   * forced into the wrong home. */
  const regionRequirementNoun = /^[\s,-]*(?:based\s+)?(?:support|engineers?|vendors?|suppliers?|providers?|references?|coverage|cover\b|presence|data\s*(?:centre|center)|hosting|response|help\s*desk|helpdesk|\bsla\b)\b/i;
  const regionIsBuyerLocation = (m: RegExpExecArray | null, src: string): boolean => {
    if (!m) return false;
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 30);
    return !regionRequirementNoun.test(after);
  };

  // Regions, including country names (F-C: "France and Germany" must not
  // vanish inside a clause credited to other facts). The mapped region is
  // stated with the country as its quote: operating there is their claim.
  {
    const uk = hit(/\buk\b|united kingdom|britain|northern ireland|\blondon\b/);
    if (uk && regionIsBuyerLocation(uk, t)) say("organisation.regions", ["uk"], "UK");
  }
  {
    const ie = hit(/(?<!northern )ireland|\bdublin\b/);
    if (ie && regionIsBuyerLocation(ie, t)) say("organisation.regions", ["ie"], ie[0].trim());
  }
  /* US and CHINA, the two Harry named and the rail could not see (30 Jul
   * 2026). China was absent from the map entirely, and a bare "US" is
   * unmatchable once the text is lowercased because "us" is the English
   * pronoun and would fire on "tell us" or "for us". So on any turn where
   * the model over-reached (his run recorded four regions quoting the
   * single word "Global"), nothing could override it. The country test
   * runs against the RAW text, where the pronoun is lower case and the
   * country is not. */
  {
    const us = /\bUS\b|\bU\.S\.\b/.exec(text);
    if (us && regionIsBuyerLocation(us, text)) say("organisation.regions", ["us"], "US");
  }
  for (const [re, region] of [
    [/\bfrance\b|\bgermany\b|\bspain\b|\bitaly\b|netherlands|\bholland\b|\bbelgium\b|\bpoland\b|\bportugal\b|\bsweden\b|\bdenmark\b|\baustria\b|switzerland|\bnorway\b|\bfinland\b|luxembourg|\beurope\b|\bemea\b/, "eu"],
    [/\busa\b|\bu\.s\.\b|united states|north america|\bcanada\b/, "us"],
    [/\baustralia\b|\bsingapore\b|\bjapan\b|\bindia\b|hong kong|\bmalaysia\b|new zealand|\bapac\b|asia pacific|\bchina\b|\bshanghai\b|\bbeijing\b|\bshenzhen\b|south korea|\bvietnam\b|\bthailand\b|\bindonesia\b|\bphilippines\b|\btaiwan\b/, "apac"],
    [/\buae\b|\bdubai\b|\bsaudi\b|\bqatar\b|\bbahrain\b|\bkuwait\b|\bisrael\b|south africa|\bnigeria\b|\bkenya\b|\begypt\b/, "me"],
  ] as Array<[RegExp, string]>) {
    const m = hit(re);
    if (m && regionIsBuyerLocation(m, t)) say("organisation.regions", [region], m[0].trim());
  }

  {
    const m = hit(/microsoft|m365|office ?365|\bo365\b/);
    if (m) say("estate.cloud", ["m365"], "Microsoft");
  }
  if (hit(/azure/)) say("estate.cloud", ["azure"], "Azure");
  if (hit(/google workspace|gsuite/)) say("estate.cloud", ["google"], "Google Workspace");
  if (hit(/\baws\b/)) say("estate.cloud", ["aws"], "AWS");
  /* 1 Aug 2026, Robert's live catch: a bare "SD-WAN" (his very first word in
   * a brand-new project) landed as estate.existingNetwork -- "you already
   * run this" -- when he meant the opposite, he wanted to buy it. The
   * unqualified mention is genuinely ambiguous, but a fresh project with no
   * existing-estate language is buying intent far more often than not, so
   * the existing-network read now requires one of its own signal words.
   * Qualified mentions ("we're on SD-WAN already", "replacing our SD-WAN")
   * still land here exactly as before; the buying-intent fallback below
   * covers the bare case, symmetrically with SASE/SSE/managed security. */
  const existingEstateSignal = /\b(?:already|currently|current|existing|today|right now|at the moment|in place|we (?:run|have|use|are on)|running on|our current|legacy)\b/;
  if (hit(/sd-?wan/) && existingEstateSignal.test(t)) say("estate.existingNetwork", ["sdwan"], "SD-WAN");
  if (hit(/\bmpls\b/)) say("estate.existingNetwork", ["mpls"], "MPLS");

  if (hit(/incident|breach|phishing|attack|compromis|hacked/)) say("drivers", ["incident"], "incident");
  if (hit(/ransomware/)) say("drivers", ["ransomware_concern"], "ransomware");
  if (hit(/renewal|contract end|contract expir|contract is up|ends? in march|ends? in \w+ 20\d\d/)) say("drivers", ["renewal"], "contract renewal");
  if (hit(/audit/)) say("drivers", ["audit"], "audit");
  if (hit(/acquisition|merger|growing fast|expansion/)) say("drivers", ["growth"], "growth");

  if (hit(/iso ?27001/)) say("constraints.complianceRequirements", ["iso27001"], "ISO 27001");
  if (hit(/\bpci\b/)) say("constraints.complianceRequirements", ["pci_dss"], "PCI");
  else if (hit(/card payments|take cards|card-present/)) infer("constraints.complianceRequirements", ["pci_dss"], "card payments bring PCI DSS into scope");
  if (hit(/cyber essentials/)) say("constraints.complianceRequirements", ["cyber_essentials_plus"], "Cyber Essentials");
  if (hit(/nhs dspt|\bdspt\b/)) say("constraints.complianceRequirements", ["nhs_dspt"], "NHS DSPT");
  // Harry's 22 July finding: NIS2 named verbatim and silently dropped.
  if (hit(/\bnis\s?2\b/)) say("constraints.complianceRequirements", ["nis2"], "NIS2");
  if (hit(/\bgdpr\b/)) say("constraints.complianceRequirements", ["uk_gdpr"], "GDPR");
  if (hit(/\bfca\b/)) say("constraints.complianceRequirements", ["fca"], "FCA");

  {
    const soc = hit(/24\/7|24x7|around.the.clock|twenty.four/);
    if (soc) {
      /* Round 9 catch (2 Aug 2026, live QA finding): "24x7 UK-based
       * support" -- a want, aimed at the vendor -- landed
       * inHouseSocCapacity=twenty_four_seven, a claim that the BUYER
       * already runs 24/7 security operations in house. Same shape of
       * mistake as the SD-WAN existing-vs-buying bug fixed in round 2:
       * this field is about what the buyer already has, so a "24/7"
       * immediately next to a support/cover/response word, or right
       * after a need/want verb, reads as a requirement of the vendor,
       * not a statement of the buyer's own capability, and is left
       * alone (there is no field yet for "vendor must offer 24/7
       * support", so it falls through to its receipt instead). */
      const after = t.slice(soc.index + soc[0].length, soc.index + soc[0].length + 30);
      const before = t.slice(Math.max(0, soc.index - 30), soc.index);
      // The requirement noun may sit right after a region qualifier
      // ("24x7 UK-based support"), so an optional "<word>-based" is
      // allowed between the match and the noun that actually matters.
      const requirementNoun = /^[\s,-]*(?:[a-z]+-?based\s+)?(?:support|cover(?:age)?|engineers?|response|help\s*desk|helpdesk)\b/;
      const needSignal = /\b(?:need|want|require|looking for|must have)\s*$/;
      if (!requirementNoun.test(after) && !needSignal.test(before)) say("constraints.inHouseSocCapacity", "twenty_four_seven", "24/7");
    } else if (/nobody watching|no out.of.hours|no overnight|no soc\b|no security team/.test(t)) say("constraints.inHouseSocCapacity", "none", "no out-of-hours cover");
  }

  // What they are BUYING (distinct from what they have). Seeking verbs near
  // a product term read as procurement intent; security service terms are
  // strong enough on their own because they are not estate descriptions.
  // "move to" joined the seeking verbs on Harry's Section 1 sentence
  // (28 Jul 2026: "looking to move to SASE" reached the ledger only via
  // the model layer; the rail's own verbs never matched). The negation
  // window already keeps "moving away" and "moved off" out.
  // "replacing X with Y" joined the seeking verbs on the P1 rail check
  // (30 Jul 2026): only the bare infinitive "replace X with" was listed, so
  // "we are replacing MPLS with fully managed SASE" reached the ledger with
  // its sector, sites, users and regions and no scope at all, which is one
  // of the core five a notice cannot publish without (R7). Present
  // participle only: "replaced X with Y" is an estate they already have,
  // not a purchase they are making, and must keep reading that way.
  // 1 Aug 2026, Robert's live catch continued: "replac(?:e|ing) \w+ with"
  // only ever matched a single bare word between "replacing" and "with",
  // so real sentences ("replacing our legacy MPLS with SD-WAN") never
  // qualified and the whole clause silently missed procurement.buying.
  // Widened to up to four words, still bounded so it cannot run past a
  // clause boundary and swallow an unrelated "with" later in the sentence.
  const seek = "(?:need|want|looking for|buy|buying|procure|procuring|source|sourcing|tender|rfp|quotes? for|move to|moving to|migrat\\w+ to|replac(?:e|ing) (?:\\w+\\s+){0,3}\\w+ with|roll(?:ing)? out|deploy(?:ing)?)";
  const buyRe = (term: string) => new RegExp(`${seek}[^.!?]{0,60}\\b${term}|\\b${term}\\b[^.!?]{0,30}(?:rollout|roll-out|project|procurement|tender|rfp)`);
  if (hit(/\bmdr\b|\bmssp\b|managed (?:security|detection|soc|siem)|security (?:partner|provider|service|operations centre)|\bsoc\b service|incident response service/)) {
    say("procurement.buying", "managed_security", "managed security");
  } else if (hit(buyRe("sase"))) say("procurement.buying", "sase", "SASE");
  else if (hit(buyRe("sse|security service edge|secure service edge"))) say("procurement.buying", "sse", "SSE");
  else if (hit(buyRe("sd-?wan"))) {
    say("procurement.buying", "sdwan", "SD-WAN");
    // The SD-WAN mention was a purchase intent, so it is not evidence of
    // the estate: withdraw the blanket existing-network claim above.
    const i = out.findIndex((u) => u.path === "estate.existingNetwork" && Array.isArray(u.value) && (u.value as string[]).includes("sdwan"));
    if (i >= 0) out.splice(i, 1);
  } else if (!existingEstateSignal.test(t)) {
    /* 1 Aug 2026, Robert's live catch: none of the seeking-verb patterns
     * above require one, so a buyer who typed nothing but the bare term --
     * "SASE" on its own reached the ledger not at all; "SD-WAN" on its own
     * reached it as the wrong field (see above) -- got silence or a lie.
     * A bare mention with no existing-estate language is buying intent:
     * this is the parity fallback, same four terms, same priority order,
     * landed with the bare word as its own quote. */
    if (hit(/\bsase\b/)) say("procurement.buying", "sase", "SASE");
    else if (hit(/\bsse\b|security service edge|secure service edge/)) say("procurement.buying", "sse", "SSE");
    else if (hit(/sd-?wan/)) say("procurement.buying", "sdwan", "SD-WAN");
  }

  // Operating model: the managed words must attach to the SERVICE BEING
  // BOUGHT, not to some other object in the sentence. "Fully managed SaaS
  // services" is a statement about their software, not an instruction to
  // buy the SASE fully managed (Harry's Section 1 finding, 28 Jul 2026:
  // the ledger said Fully managed [stated] off exactly that clause). Same
  // philosophy as the negation window: wrongly suppressing costs an
  // omission the receipt catches; wrongly landing records a lie. The
  // quote is the words actually matched, never a canned phrase.
  {
    const m = hit(/fully managed|managed service|manage it for us|no in.house it|outsourced?/);
    const after = m ? t.slice(m.index + m[0].length, m.index + m[0].length + 44) : "";
    const foreignObject = /^\s*(?:\w+\s+)?(?:saas\b|software\b|apps?\b|applications?\b|desktops?\b|laptops?\b|endpoints?\b|devices?\b|printers?\b|payroll\b|crm\b|erp\b|m365\b|office ?365\b)/.test(after);
    if (m && !foreignObject) say("procurement.operatingModel", "managed", m[0].trim());
    else if (hit(/co-?managed/)) say("procurement.operatingModel", "co_managed", "co-managed");
    else if (hit(/\bdiy\b|self-?managed|manage (?:it )?ourselves|in-?house managed/)) say("procurement.operatingModel", "diy", "self-managed");
  }

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
- Drivers are exact meanings, not intensities: "incident" only for an actual or ongoing incident (phishing, breach, compromise); "ransomware_concern" only when the buyer names ransomware. Do not escalate one into the other. "renewal" only when the buyer names a contract, renewal, expiry or agreement ending; replacing outdated, legacy or end-of-life equipment is NOT a renewal, and if no driver fits, omit drivers entirely.
- Mobile connectivity (4G, 5G) is not "broadband". If the estate runs on mobile and no listed network id fits, omit the field rather than approximating.
- "quote": if the buyer literally said it, copy their exact words (a short verbatim substring). If you inferred it, set quote to null and give a one-line "reason".
- Never invent facts. Omit what the text does not support. Fewer, correct fields beat many guesses.`;

export type ModelProposal = { path?: unknown; value?: unknown; quote?: unknown; reason?: unknown };

/**
 * The vetting rail for model proposals, extracted pure so the fixtures can
 * hold it to account. Every guard here is the same law: a claim the model
 * proposes must trace to words the buyer actually used, or it is omitted
 * and the clause keeps its receipt. Nothing is ever mangled into a
 * different claim.
 */
export function vetModelProposals(fields: ModelProposal[], text: string, notes: string[]): FieldUpdate[] {
  const lower = text.toLowerCase();
  const out: FieldUpdate[] = [];
  for (const f of fields.slice(0, 30)) {
    const ok = validate(String(f.path ?? ""), f.value, notes);
    if (!ok) continue;
    let value = ok.value;
    const quote = typeof f.quote === "string" ? clean(f.quote, 160) : "";
    const stated = quote.length > 2 && lower.includes(quote.toLowerCase());
    /* F-A extension (24 Jul live catch: "across our sites" proposed
     * sites=1): a numeric estate count must trace to a digit in the
     * words it cites, or in the buyer's text at all. Otherwise OMIT:
     * the receipt keeps the clause verbatim, and no count is invented. */
    if ((ok.path === "estate.sites" || ok.path === "estate.users") && !/\d/.test(`${quote} ${String(f.reason ?? "")}`)) {
      notes.push(`Dropped ${ok.path === "estate.sites" ? "a site" : "a user"} count with no stated number.`);
      continue;
    }
    /* Harry's 24 July catch: "replacing outdated firewalls and remote
     * VPN" came back as drivers:["renewal"], and the desk then asked
     * when the contract ends. Same law: a renewal driver must trace to
     * contract words the buyer used (contract, renewal, expiry,
     * agreement), or that driver is omitted. Replacing outdated kit is
     * a lifecycle statement, not a renewal. */
    if (ok.path === "drivers" && Array.isArray(value) && (value as string[]).includes("renewal") && !/renew|contract|expir|agreement/.test(lower)) {
      notes.push("Dropped a contract-renewal driver: no contract or renewal words in your description.");
      value = (value as string[]).filter((d) => d !== "renewal");
      if ((value as string[]).length === 0) continue;
    }
    /* The 5G mishearing (Harry's first platform round): an estate on
     * mobile is not "broadband". If the buyer said 4G or 5G and never
     * said broadband, the approximation is omitted and their words keep
     * their receipt. */
    if (ok.path === "estate.existingNetwork" && Array.isArray(value) && (value as string[]).includes("broadband") && /\b[45]g\b/.test(lower) && !/broadband|adsl|fttc|fttp|\bdsl\b|fibre/.test(lower)) {
      notes.push("Dropped a broadband claim: the description says mobile (4G or 5G), which is not broadband.");
      value = (value as string[]).filter((n) => n !== "broadband");
      if ((value as string[]).length === 0) continue;
    }
    /* Harry's Section 1 catch (28 Jul 2026): "fully managed SaaS services"
     * came back as operatingModel managed [stated]. Same law as the rail's
     * object guard: a managed operating model must attach to the network
     * or security service being bought. A quote whose managed words attach
     * to software (SaaS, apps, M365 and friends) with no network object in
     * it is omitted; the receipt keeps the clause and the operating-model
     * question stays open for the buyer to answer. */
    if (ok.path === "procurement.operatingModel" && value === "managed") {
      const q = quote.toLowerCase();
      const managesSoftware = /\bmanaged?\b[^.!?]{0,34}\b(?:saas|software|apps?|applications?|desktops?|laptops?|endpoints?|devices?|printers?|payroll|crm|erp|m365|office ?365)\b/.test(q);
      const managesTheService = /\b(?:sase|sd-?wan|sse|network|wan\b|security|soc\b|service edge|firewall|connectivity)\b/.test(q);
      if (managesSoftware && !managesTheService) {
        notes.push("Dropped fully managed: those words describe the software mentioned, not the service being bought.");
        continue;
      }
    }
    /* The same clause's second life (Harry's Section 1, 28 Jul 2026): the
     * artefact read "The estate runs on other SaaS [stated]" off "fully
     * managed SaaS services". SaaS named as the OBJECT of a managed or
     * buying phrase is not an estate statement; the claim is omitted and
     * the clause keeps its receipt. */
    if (ok.path === "estate.cloud" && Array.isArray(value) && (value as string[]).includes("other_saas")) {
      const q = quote.toLowerCase().trim();
      const objectOfManaged = q.length > 2 && new RegExp(`\\bmanaged?\\s+(?:\\w+\\s+)?${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 60)}`).test(lower);
      const bareSaasEcho = /^(?:other\s+)?saas(?:\s+services?)?$/.test(q) && /\b(?:managed|buying|move to|moving to)\b[^.!?]{0,30}\bsaas\b/.test(lower) && !/\b(?:run|runs|running|use|uses|using|estate|currently|today)\b[^.!?]{0,30}\bsaas\b/.test(lower);
      if (objectOfManaged || bareSaasEcho) {
        notes.push("Dropped an estate claim: the SaaS words name what is being managed, not what the estate runs on.");
        value = (value as string[]).filter((c) => c !== "other_saas");
        if ((value as string[]).length === 0) continue;
      }
    }
    /* Round 8 catch (2 Aug 2026, live QA finding): the model proposed a
     * managed operating model off "a dedicated account manager who
     * visits our sites quarterly for a face to face review" — a support
     * want, not an operating-model decision, and it landed as "your
     * words" on the statement. Same law as every guard above: the claim
     * must trace to real operating-model words, the exact vocabulary the
     * deterministic rail itself requires for this same field, not mere
     * proximity to "manager"/"manage" used in an unrelated sense. */
    if (ok.path === "procurement.operatingModel") {
      const opAnchor = /\b(?:fully managed|managed service|manage it for us|no in.house it|outsourced?|co-?managed|diy|self-?managed|manage (?:it )?ourselves|in-?house managed|runs? it (?:for us|day to day|themselves)|operates? it (?:for us|themselves)|vendor(?:-| )run)\b/i;
      if (!opAnchor.test(lower)) {
        notes.push("Dropped an operating-model claim: no operating-model words (managed, co-managed, self-managed) in your description.");
        continue;
      }
    }
    /* Round 9 catch, part two (2 Aug 2026, live QA finding): fixing the
     * deterministic rail's "24x7 UK-based support" bug (see the comment
     * above deterministicExtract's regionIsBuyerLocation) only closed the
     * regex path. The MODEL runs independently and can reach the exact
     * same wrong conclusion its own way — live evidence showed
     * organisation.regions=uk landing as an INFERRED claim with reason
     * "24x7 UK-based support implies UK operations", never touching the
     * rail at all. Same law as every guard in this function: the words
     * the model cites as evidence (its quote if stated, its reason if
     * inferred) must read as the buyer describing their OWN location, not
     * as a requirement clause aimed at the vendor. A quote/reason naming
     * a requirement noun (support, engineers, vendors, coverage, presence,
     * hosting, SLA...) with no location language of its own is omitted;
     * the receipt keeps the buyer's actual words and the question stays
     * open. */
    if (ok.path === "organisation.regions") {
      const evidence = (quote || String(f.reason ?? "")).toLowerCase();
      const requirementWords = /\b(?:support|engineers?|vendors?|suppliers?|providers?|references?|coverage|cover\b|presence|data\s*(?:centre|center)|hosting|response|help\s*desk|helpdesk|\bsla\b)\b/;
      const locationWords = /\b(?:based in|headquartered|operations? (?:span|cover|are)|offices? in|sites? (?:are|in|based)|located|our (?:hq|headquarters)|we (?:are|operate) in|head office)\b/;
      if (requirementWords.test(evidence) && !locationWords.test(evidence)) {
        notes.push("Dropped a region claim: the words describe a requirement (support, engineers, coverage...) aimed at the vendor, not the buyer's own location.");
        continue;
      }
    }
    /* Same live finding, same law, for the SOC-capacity field: a 24/7
     * claim the model justifies with support/coverage/response words (a
     * want aimed at the vendor) rather than the buyer's own in-house
     * capability is omitted, mirroring the deterministic rail's
     * requirementNoun/needSignal guard above. */
    if (ok.path === "constraints.inHouseSocCapacity" && value === "twenty_four_seven") {
      const evidence = (quote || String(f.reason ?? "")).toLowerCase();
      const requirementNoun = /\b(?:[a-z]+-?based\s+)?(?:support|cover(?:age)?|engineers?|response|help\s*desk|helpdesk)\b/;
      const needSignal = /\b(?:need|want|require|looking for|must have)\b/;
      const capabilityWords = /\b(?:we (?:run|have|operate)|our (?:soc|security team|team)|in-?house|already)\b/;
      if ((requirementNoun.test(evidence) || needSignal.test(evidence)) && !capabilityWords.test(evidence)) {
        notes.push("Dropped a 24/7 in-house capability claim: the words describe a requirement aimed at the vendor, not the buyer's own capability.");
        continue;
      }
    }
    /* Round 8 catch (2 Aug 2026, live QA finding): the model proposed
     * constraints.timeline "30 day poc" off "a 30 day proof-of-concept
     * trial before we sign a contract" — a procurement condition, not a
     * date the project must land by, and unreadable besides.
     * constraints.timeline is deliberately free text (see the 30 Jul
     * finding above), so nothing here validates its WORDS, only that it
     * traces to an actual dated or horizon anchor: the same vocabulary
     * the deterministic rail already requires for this same field. */
    if (ok.path === "constraints.timeline") {
      const DATEISH =
        "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+20\\d\\d|(?:q[1-4]|h[12])\\s*20\\d\\d|(?:spring|summer|autumn|winter)\\s+20\\d\\d|\\b20\\d\\d\\b|within\\s+(?:the\\s+next\\s+)?\\d{1,3}\\s+(?:days?|weeks?|months?)|no fixed date|as soon as possible|\\basap\\b";
      if (!new RegExp(DATEISH, "i").test(lower)) {
        notes.push("Dropped a timeline claim: no dated anchor (a month, quarter, year, or a stated number of days/weeks/months) in your description.");
        continue;
      }
    }
    out.push({
      path: ok.path,
      value,
      provenance: stated ? "stated" : "inferred",
      ...(stated ? { quote } : {}),
      ...(!stated ? { reason: clean(f.reason ?? (quote ? "the quoted words were not found verbatim in your text" : "derived from your description"), 160) } : {}),
    });
  }
  return out;
}

/**
 * Objectives the buyer states in their own words (Harry, 24 July 2026:
 * "best of breed services", written near-verbatim, was raised back as an
 * open question instead of landing). A phrase in the cycle's text is the
 * buyer's own statement: the desk notes the objective as solid ink and
 * the shape question stays suppressed. Strict phrases only; nothing here
 * infers.
 */
export const STATED_OBJECTIVE_PHRASES = [
  { id: "obj-bob", label: "Best-of-breed stack", re: /best[ -]of[ -]breed/i },
  { id: "obj-unified", label: "Single-vendor SASE platform", re: /single[ -]vendor|\bone platform\b|single platform|unified (?:sase )?platform/i },
] as const;

export function statedObjectivesIn(text: string): Array<{ id: string; label: string }> {
  return STATED_OBJECTIVE_PHRASES.filter((o) => o.re.test(text)).map(({ id, label }) => ({ id, label }));
}

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
    return vetModelProposals(parsed.fields, text, notes);
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
