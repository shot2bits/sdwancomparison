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
import { explanationForInput } from "@/lib/workspace/explanations";

export type Provenance = "stated" | "inferred";

export type FieldUpdate = {
  path: AllowedPath;
  value: unknown;
  provenance: Provenance;
  quote?: string;
  reason?: string;
  /** Fact Ledger Reliability Gate (13 Aug 2026): the literal buyer-text
   *  span this update traces to, ONLY when that span is not already
   *  carried by `quote` — i.e. an `infer()` call whose reason names a
   *  trigger word that isn't itself the buyer's stated value (organisation
   *  .sector's "health" indicates this sector" being the exact case that
   *  exposed the gap). `quote` already IS a verified literal span for
   *  every `say()` call and every model proposal vetModelProposals()
   *  marks "stated" (line ~918: `lower.includes(quote.toLowerCase())`),
   *  so clause-coverage checking (below) treats `quote` as the anchor
   *  first and only falls back to `matchedText` when `quote` is absent.
   *  Never used to change provenance -- purely an internal coverage
   *  signal, optional and additive, so nothing outside this file needs it. */
  matchedText?: string;
  /** Occurrence-aware coverage (13 Aug 2026, amendment round -- Codex's
   *  review): the character offset in the ORIGINAL buyer text where
   *  `matchedText` (or, if absent, `quote`) actually sits. Without this,
   *  clause coverage could only ask "does this anchor's TEXT appear
   *  ANYWHERE in the message", which wrongly let one occurrence of a word
   *  (e.g. "Azure" in "We use Azure today") cover a LATER, unrelated
   *  sentence containing the same word ("We also require Azure
   *  ExpressRoute..."). With a real position, coverage asks "does this
   *  SPECIFIC occurrence fall inside THIS clause's own character range" --
   *  the same discipline `hit()` already uses to find only the first
   *  regex occurrence (see hit()'s own comment). Optional and additive,
   *  same footing as matchedText: nothing outside coverage-checking reads
   *  it, and its absence only ever degrades to the old, more permissive
   *  behaviour (a redundant receipt at worst, never a silent drop). */
  matchStart?: number;
};

/**
 * Seventh amendment (13 Aug 2026), Robert's finding on the sixth
 * amendment's `mergeRequirementBase()`: unioning a resumed session's list
 * fields against the persisted base means a buyer can add a new value but
 * can never RETRACT one the base already holds -- "we no longer use MPLS"
 * correctly avoids ADDING mpls as a false positive (the negation window
 * below already guaranteed that), but nothing ever told the merge to
 * actually drop the base's own existing mpls value either, so the
 * immutable source ledger records the correction while the structured
 * requirement keeps insisting the opposite. A `FieldRemoval` is that
 * missing signal: a specific path+value the buyer has explicitly retracted
 * this turn, carrying the same quote/matchedText/matchStart anchors a
 * `FieldUpdate` does so it can also count toward clause coverage. It is
 * never itself written into `updates` -- see removalsIn()'s own comment
 * for why a negated phrase must never become a positive fact either way. */
export type FieldRemoval = {
  path: AllowedPath;
  value: unknown;
  quote: string;
  matchedText?: string;
  matchStart?: number;
};

export type ExtractResult = {
  requirement: SecurityRequirementInput;
  updates: FieldUpdate[];
  engine: "model" | "deterministic_fallback";
  model?: string;
  notes: string[];
  /** Fact Ledger Reliability Gate (13 Aug 2026): declarative clauses of the
   *  buyer's message that landed in NEITHER a structured fact NOR
   *  requirements.bespoke -- surfaced so the caller can keep them as a
   *  visible, unplaced receipt instead of letting them silently vanish.
   *  Empty in the ordinary case where every clause was accounted for. */
  unplacedClauses: string[];
  /** Seventh amendment (13 Aug 2026): explicit retractions of a known
   *  list-vocabulary value this turn -- see FieldRemoval's own comment.
   *  Empty in the overwhelming ordinary case where nothing was retracted. */
  removals: FieldRemoval[];
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

/* Exported (2030 blueprint, full-unification closure pass, 17 Aug 2026):
 * the canonical-envelope's own WorkspaceFactSchema (procurement-document.ts)
 * needs the REAL whitelist to validate an incoming fact's `path`, never a
 * second, hand-copied list that could silently drift from this one. Purely
 * additive -- nothing about ALLOWED_PATHS's own behaviour changes. */
export const ALLOWED_PATHS = [
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
  /* PKM extension (Netify Project Architecture v1.0 s2.2): named
   * technologies/providers, vendors under consideration, named locations
   * and their criticality/resilience, and a bespoke catch-all. All seven
   * are workspace-level facts, same footing as procurement.buying/
   * operatingModel above: they live in the ledger and the Statement of
   * Requirements, but applyUpdates() never writes them into
   * SecurityRequirementInput, so the rulebook engine's contract is
   * unchanged. */
  "estate.namedTechnologies",
  "estate.existingProviders",
  "procurement.vendorsUnderConsideration",
  "estate.namedLocations",
  "estate.locationCriticality",
  "estate.siteResilience",
  "requirements.bespoke",
] as const;
export type AllowedPath = (typeof ALLOWED_PATHS)[number];

/* ------------------------------------------------------------------ */
/* Validator rail: the model proposes, this decides                    */
/* ------------------------------------------------------------------ */

const clean = (s: unknown, max = 120) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

/* Correction pass 2, Priority 2 (Tests 70/71): a marker prefix, not just
 * human prose, so a caller can reliably detect "a quantity was proposed
 * and rejected" without re-parsing note text or duplicating the reasons
 * this function already knows. Every estate.users/estate.sites rejection
 * below uses it, whatever the specific reason (negative, fractional, or
 * merely implausible) — one consistent, greppable shape (Priority 3 reads
 * this same prefix to decide whether a turn needs a buyer-visible "no
 * precise quantity added" activity entry, rather than the note silently
 * existing only in notes[] as before this pass). */
export const QUANTITY_NOT_RECORDED_PREFIX = "Quantity not recorded: ";

/* Correction pass 2, Priority 2 (Tests 70/71): matches a negative or
 * decimal number ANYWHERE in a short source string — deliberately looser
 * than deterministicExtract()'s own NEGATIVE_OR_DECIMAL_COUNT (which must
 * sit immediately before a specific noun, because it has to decide
 * whether to attempt a match at all). This one only ever runs against a
 * short quote/reason already scoped to a single proposed count, so a bare
 * shape check is precise enough and needs no noun anchor. */
const NEGATIVE_OR_DECIMAL_COUNT_ANYWHERE = /-\s?\d+(?:\.\d+)?|\b\d+\.\d+\b/;

/* Fix (correction pass 2, Priority 3 — Test 73, "quite a few sites, maybe
 * a dozen or so"): a hedged, deliberately-imprecise estimate is a
 * different failure mode from Test 72's out-of-range number and from
 * Priority 2's negative/decimal shapes -- here the buyer is explicitly
 * signalling they do NOT know an exact count, so a model that resolves "a
 * dozen or so" to a clean integer (e.g. value:12) would be inventing
 * precision the buyer never gave, which Priority 3 explicitly forbids
 * ("Do not invent a number"). Checked only against sourceText -- the
 * model's own quote/reason for THIS specific proposed count (or the
 * deterministic path's own regex match, which can never contain hedge
 * words since it requires literal digits to match at all) -- never against
 * the buyer's full message, so an unrelated hedge word elsewhere in a
 * longer sentence ("Budget is roughly £200k but we have 45 sites.") can
 * never wrongly reject a genuinely precise count quoted elsewhere in it. */
const VAGUE_QUANTITY_HEDGE =
  /\b(?:quite a few|a few|a couple(?:\s+of)?|several|around|about|roughly|approximately|or so|or thereabouts|or thereabout|give or take|ballpark|not sure exactly|hard to say exactly|maybe|perhaps|possibly)\b/i;

/* Hoisted to module scope (correction pass 2, Priority 2) from inside
 * deterministicExtract(), which still defines its own local NUM-based
 * matching against these same two noun groups — unchanged. Hoisting only
 * lets validate()'s own raw-text check below share the identical noun
 * vocabulary rather than duplicating or drifting from it. */
const USER_NOUN = "users?|staff|employees?|people|seats?|heads";
const SITE_NOUN = "sites?|stores?|branch(?:es)?|offices?|locations?|shops?|practices?|clinics?";

/* Fix (correction pass 2, Priority 2 — Tests 70/71, the actual mechanism):
 * live evidence this pass showed the MODEL itself already strips a
 * negative sign or a decimal fraction from its OWN quote before validate()
 * ever sees it — "We need SASE across -5 sites." came back as
 * {value: 5, quote: "5 sites"}, so a check against the model's quote alone
 * (NEGATIVE_OR_DECIMAL_COUNT_ANYWHERE.test(sourceText) below) never fires,
 * because by that point every trace of the sign is already gone from BOTH
 * the value AND the model's own quote. The only place the original "-5"
 * still exists is the buyer's actual raw text, which the model proposal
 * never carries at all. This mirrors deterministicExtract's own
 * NEGATIVE_OR_DECIMAL_COUNT shape check exactly (a negative or decimal
 * number, at most one word before the noun) but runs it against the FULL
 * ORIGINAL buyer text instead of a model-mediated quote, which is the only
 * reliable source left once a model has already "corrected" the number
 * for us. Scoped tightly (the number must sit right before a
 * site/user noun) specifically so an unrelated negative or decimal number
 * elsewhere in a longer sentence — "Our budget is -£5,000 and we need 15
 * sites." — can never wrongly reject a genuine, unrelated whole count. */
function rawTextShowsNegativeOrDecimalNear(path: AllowedPath, rawBuyerText: string): boolean {
  const noun = path === "estate.users" ? USER_NOUN : path === "estate.sites" ? SITE_NOUN : null;
  if (!noun) return false;
  const re = new RegExp(`(?:${NEGATIVE_OR_DECIMAL_COUNT_ANYWHERE.source})\\s*(?:\\w+\\s+)?(?:${noun})\\b`, "i");
  return re.test(rawBuyerText);
}

function validate(
  path: string,
  value: unknown,
  notes: string[],
  sourceText?: string,
  rawBuyerText?: string,
): { path: AllowedPath; value: unknown } | null {
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
      /* Fix (correction pass 2, Priority 2 — Tests 70/71): the first
       * fix only touched deterministicExtract()'s own regex match, but
       * unionUpdates() always prefers the MODEL's proposal for a path
       * once the model proposes one — and the model was independently
       * turning "-5 sites" into estate.sites=5 (quote "5 sites",
       * silently dropping the minus sign) and "12.5 sites" into a value
       * this function then rounded to 13, so the deterministic-only fix
       * never ran for either reported case. validate() is the one gate
       * BOTH the model and deterministic paths share (this file's own
       * design law — see this function's header comment), so the fix
       * belongs here: inspect the buyer's own quoted source text (never
       * available on the deterministic path in a form that could show
       * this, since that path already omits the field upstream — see
       * deterministicExtract's own NEGATIVE_OR_DECIMAL_COUNT guard —
       * but always available on the model path via `sourceText`) AND
       * the numeric value itself, BEFORE any rounding, for a negative
       * or non-integer shape. Reject outright rather than silently
       * coercing a sign away or rounding a fraction — same "omitted,
       * never mangled" outcome every other out-of-bounds value already
       * gets below, just checked earlier, before Math.round can hide
       * the evidence. The earlier ledger value, if any, is left
       * completely alone; nothing here writes a corrected/rounded
       * number in its place. */
      const raw = Number(value);
      const sourceShowsNegativeOrDecimal = sourceText ? NEGATIVE_OR_DECIMAL_COUNT_ANYWHERE.test(sourceText) : false;
      const valueShowsNegativeOrDecimal = Number.isFinite(raw) && (raw < 0 || !Number.isInteger(raw));
      /* Fix (correction pass 2, Priority 2 continued): sourceText and value
       * are both MODEL-mediated — live evidence proved the model already
       * strips the sign/decimal from its own self-reported quote too
       * ("-5 sites" -> {value:5, quote:"5 sites"}), so neither of the two
       * checks above can ever see the original shape for a model-path
       * proposal. The buyer's own original message is the only place the
       * sign/decimal reliably still exists, so check that directly as a
       * third, independent signal. */
      const rawTextShowsIt = rawBuyerText ? rawTextShowsNegativeOrDecimalNear(p, rawBuyerText) : false;
      const what = p === "estate.users" ? "user" : "site";
      if (sourceShowsNegativeOrDecimal || valueShowsNegativeOrDecimal || rawTextShowsIt) {
        /* Quote whichever text actually shows the negative/decimal shape,
         * preferring the buyer's own original words (rawBuyerText) when
         * that's the only place it's visible — sourceText/value are
         * model-sanitised by the time we get here (see comment above), so
         * quoting them back in this case would misleadingly show a plain
         * positive integer next to the words "is negative or not a whole
         * number". */
        const quoteFor =
          sourceShowsNegativeOrDecimal || valueShowsNegativeOrDecimal
            ? sourceText || String(value)
            : rawBuyerText || sourceText || String(value);
        notes.push(
          `${QUANTITY_NOT_RECORDED_PREFIX}"${clean(quoteFor, 60)}" is negative or not a whole number, so no ${what} count was recorded. The earlier value, if any, is unchanged — restate a whole positive number to set it.`,
        );
        return null;
      }
      const sourceIsVagueEstimate = sourceText ? VAGUE_QUANTITY_HEDGE.test(sourceText) : false;
      if (sourceIsVagueEstimate) {
        notes.push(
          `${QUANTITY_NOT_RECORDED_PREFIX}"${clean(sourceText || String(value), 60)}" reads as an estimate rather than a precise count, so nothing precise was recorded. The earlier value, if any, is unchanged — restate a specific whole number to set it.`,
        );
        return null;
      }
      const n = Math.round(raw);
      if (!Number.isFinite(n) || n < 1 || n > (p === "estate.users" ? 500000 : 20000)) {
        notes.push(
          `${QUANTITY_NOT_RECORDED_PREFIX}"${clean(sourceText || String(value), 60)}" isn't a plausible ${what} count, so nothing precise was recorded. The earlier value, if any, is unchanged.`,
        );
        return null;
      }
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
    /* PKM extension: named free text (technologies, providers, vendors
     * under consideration, locations). Same shape as estate.existingSecurity
     * above: loosely validated, list-accumulating, capped at 8 values. */
    case "estate.namedTechnologies":
    case "estate.existingProviders":
    case "procurement.vendorsUnderConsideration":
    case "estate.namedLocations": {
      const v = asList(value).map((x) => clean(x, 60)).filter((x) => /[a-zA-Z]{2,}/.test(x)).slice(0, 8);
      return v.length ? { path: p, value: v } : null;
    }
    /* PKM extension: free-text clauses (location criticality, site
     * resilience, bespoke requirements). Same philosophy as
     * constraints.timeline/budgetBand: the buyer's whole clause is the
     * value, never paraphrased or normalised away, because the scoping
     * words ("other sites", a named site) are exactly what must survive. */
    case "estate.locationCriticality":
    case "estate.siteResilience":
    case "requirements.bespoke": {
      /* Reliability gate, SECOND amendment (13 Aug 2026, Codex's second
       * review): the first amendment raised the cap and added ONE extra
       * chunk for the remainder -- which still silently lost anything
       * past TWO chunks (a 5,021-character clause kept exactly 4,000 and
       * called it "kept in full" in the note, the same class of quiet
       * loss this gate exists to close, one layer down). Replaced with a
       * loop that keeps chunking until every character of the ORIGINAL
       * value is accounted for, however many chunks that takes, plus the
       * list-length cap (previously `v.slice(0, 12)`, silently dropping
       * item 13 onward) removed outright rather than merely raised --
       * these three paths are exactly where an accumulating buyer
       * message is SUPPOSED to keep growing a list, so an arbitrary cap
       * here is just this same bug in a different shape. */
      const FREE_TEXT_CLAUSE_MAX = 2000;
      const v: string[] = [];
      for (const x of asList(value)) {
        let original = String(x ?? "").replace(/[\r\n\t]+/g, " ").trim();
        if (!original) continue;
        if (!/\s/.test(original) && original.includes("_")) original = original.replace(/_+/g, " ").trim();
        if (!/[a-zA-Z0-9]{2,}/.test(original)) continue;
        const chunks: string[] = [];
        for (let i = 0; i < original.length; i += FREE_TEXT_CLAUSE_MAX) chunks.push(original.slice(i, i + FREE_TEXT_CLAUSE_MAX));
        v.push(...chunks);
        if (chunks.length > 1) {
          notes.push(`A captured clause (${original.length} characters) was too long to keep as one piece and was split into ${chunks.length} parts -- every character was kept, none discarded.`);
        }
      }
      return v.length ? { path: p, value: v } : null;
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
      case "estate.namedTechnologies":
      case "estate.existingProviders":
      case "procurement.vendorsUnderConsideration":
      case "estate.namedLocations":
      case "estate.locationCriticality":
      case "estate.siteResilience":
      case "requirements.bespoke":
        // PKM extension: workspace-level facts, same footing as
        // procurement.buying/operatingModel above. They live in the ledger
        // and the Statement of Requirements, never in SecurityRequirementInput
        // -- the rulebook engine's contract is unchanged.
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

/**
 * Seventh amendment (13 Aug 2026): explicit retraction detection. This is
 * DELIBERATELY separate from negatedAt() above, which only ever answers
 * "should this mention be suppressed from becoming a new positive fact" --
 * that stays exactly as strict and as broad as it already was (F-B is
 * unchanged, and every existing scalar correction/omission fixture keeps
 * passing on that same behaviour). Retracting something already on record
 * is a stronger, more consequential action than merely not-adding it, so
 * the trigger phrasing recognised here is a NARROWER subset: it requires
 * wording that names a change of state ("no longer", "stopped using",
 * "removed", "decommissioned", "don't use ... any more") rather than
 * negatedAt()'s wider net of ordinary negators ("except", "rather than",
 * "instead of") that suppress a false add but do not, on their own,
 * assert that an existing value should be taken off the record.
 */
function removalIntentBefore(before: string): boolean {
  return /\b(?:no longer|not\s+(?:using|use)|don'?t\s+use|doesn'?t\s+use|do not use|does not use|stopped using|no longer (?:have|run|need|require)|removed|dropp?ed|decommission(?:ed|ing)?|retir(?:ed|ing)|migrat(?:ed|ing)\s+(?:away from|off))\s+(?:\w+\s+){0,2}$/.test(before);
}
function removalIntentAfter(after: string): boolean {
  return /^\s{0,3}(?:is |are |has been |have been |was |were )?(?:no longer (?:used|needed|required|in use)\b|not (?:used|needed|required)(?:\s+any\s*more|\s+anymore)?\b|removed\b|decommissioned\b|retired\b)/.test(after);
}
function removalIntentAt(t: string, i: number, len: number): boolean {
  const before = t.slice(Math.max(0, i - 30), i);
  const after = t.slice(i + len, i + len + 30);
  return removalIntentBefore(before) || removalIntentAfter(after);
}

/** Round 9 (13 Aug 2026), Robert's second finding, item 2: a matched
 *  vocabulary term used as a compound ADJECTIVE describing a different
 *  noun -- "UK-BASED SOC coverage", "US-based support team" -- is not
 *  itself the thing being retracted; the retraction's real object is the
 *  noun phrase that follows (SOC coverage, a support team), a completely
 *  different concept from the region/platform/network value whose own
 *  name merely modifies it. "A region must not be removed merely because
 *  its name modifies another concept" (Robert's own wording), applied
 *  here to every vocabulary entry, not only regions, since the identical
 *  ambiguity can occur with any short token ("MPLS-based failover",
 *  "AWS-hosted workloads"). Conservative by design and structural, not a
 *  guess at what the "real" object is: an adjectival mention simply never
 *  becomes a removal candidate, the same way a negated mention never
 *  becomes a positive one. */
function isAdjectivalModifier(t: string, matchEnd: number): boolean {
  return /^-\s?(?:based|only|hosted|specific|focused|native|first|centric)\b|^\s+based\b/.test(
    t.slice(matchEnd, matchEnd + 24),
  );
}

/** The known vocabulary terms retraction can recognise: one row per
 *  enumerated list-field value, reusing the exact same trigger words the
 *  positive rail above matches on (so "MPLS" is recognised as a
 *  retraction target using precisely the same word the rail would have
 *  used to ADD it), deliberately kept as its own small table rather than
 *  refactored to share the rail's inline `hit()` calls -- item 8's "keep
 *  all current scalar correction, source-ledger, ownership and race fixes
 *  unchanged" argues against touching the already-verified positive-path
 *  code to thread a table through it. estate.existingSecurity is
 *  free-text (no enumerated vocabulary), so it is not covered here; the
 *  drop/remove command (ProjectDesk.tsx) reaches it by matching the
 *  buyer's own words against the resumed base's existing free-text
 *  entries directly, the same way it already matches a stated fact.
 *
 *  Round 9 (13 Aug 2026), Robert's second finding, item 2: "microsoft"
 *  alone is not an unambiguous reference to Microsoft 365 -- it is
 *  equally the first word of Microsoft Defender, Microsoft Teams,
 *  Microsoft Azure or plain "Microsoft" the company, so "We no longer use
 *  Microsoft Defender" must never remove m365. Retraction requires an
 *  unambiguous value reference, so the bare company name is dropped from
 *  this table entirely -- only "Microsoft 365"/"M365"/"Office 365"/
 *  "O365" remain, deliberately narrower than the POSITIVE rail's own
 *  bare-"microsoft" rule (deterministicExtract's separate `hit(/microsoft
 *  ... /)` two hundred lines below, item 8's "keep unchanged" -- retracting
 *  is the stronger, more consequential action and stays held to the
 *  stricter standard, exactly as removalIntentBefore/After already hold a
 *  narrower window than negatedAt()). */
const LIST_VALUE_PATTERNS: Array<{ path: AllowedPath; value: string; re: RegExp; quote: string }> = [
  { path: "estate.existingNetwork", value: "mpls", re: /\bmpls\b/, quote: "MPLS" },
  { path: "estate.existingNetwork", value: "sdwan", re: /sd-?wan/, quote: "SD-WAN" },
  { path: "estate.existingNetwork", value: "btnet", re: /\bbtnet\b/, quote: "BTnet" },
  { path: "estate.existingNetwork", value: "bt_broadband", re: /bt broadband/, quote: "BT Broadband" },
  { path: "estate.existingNetwork", value: "vpn", re: /\bvpn\b/, quote: "VPN" },
  { path: "estate.existingNetwork", value: "leased_line", re: /leased lines?/, quote: "leased lines" },
  { path: "estate.existingNetwork", value: "broadband", re: /\bbroadband\b/, quote: "broadband" },
  { path: "estate.cloud", value: "m365", re: /microsoft\s?365|\bm365\b|office\s?365|\bo365\b/, quote: "Microsoft 365" },
  { path: "estate.cloud", value: "azure", re: /\bazure\b/, quote: "Azure" },
  { path: "estate.cloud", value: "google", re: /google workspace|gsuite/, quote: "Google Workspace" },
  { path: "estate.cloud", value: "aws", re: /\baws\b/, quote: "AWS" },
  { path: "constraints.complianceRequirements", value: "iso27001", re: /iso ?27001/, quote: "ISO 27001" },
  { path: "constraints.complianceRequirements", value: "pci_dss", re: /\bpci\b|pci ?dss/, quote: "PCI DSS" },
  { path: "constraints.complianceRequirements", value: "cyber_essentials_plus", re: /cyber essentials/, quote: "Cyber Essentials Plus" },
  { path: "constraints.complianceRequirements", value: "nhs_dspt", re: /nhs dspt|\bdspt\b/, quote: "NHS DSPT" },
  { path: "constraints.complianceRequirements", value: "nis2", re: /\bnis\s?2\b/, quote: "NIS2" },
  { path: "constraints.complianceRequirements", value: "uk_gdpr", re: /\bgdpr\b/, quote: "GDPR" },
  { path: "constraints.complianceRequirements", value: "fca", re: /\bfca\b/, quote: "FCA" },
  { path: "drivers", value: "incident", re: /\bincidents?\b/, quote: "incident" },
  { path: "drivers", value: "ransomware_concern", re: /ransomware/, quote: "ransomware" },
  { path: "drivers", value: "renewal", re: /renewal/, quote: "contract renewal" },
  { path: "drivers", value: "audit", re: /\baudit\b/, quote: "audit" },
  { path: "drivers", value: "growth", re: /growth/, quote: "growth" },
  { path: "drivers", value: "consolidation", re: /consolidation/, quote: "consolidation" },
  { path: "organisation.regions", value: "uk", re: /\buk\b|united kingdom/, quote: "UK" },
  { path: "organisation.regions", value: "ie", re: /(?<!northern )ireland/, quote: "Ireland" },
  { path: "organisation.regions", value: "us", re: /\bu\.?s\.?\b|\busa\b|united states/, quote: "US" },
  { path: "organisation.regions", value: "eu", re: /\beurope\b/, quote: "Europe" },
  { path: "organisation.regions", value: "apac", re: /\bapac\b|asia pacific/, quote: "Asia Pacific" },
  { path: "organisation.regions", value: "me", re: /middle east/, quote: "Middle East" },
];

/**
 * Seventh amendment (13 Aug 2026): the deterministic retraction pass.
 * Scans for a known vocabulary term whose mention sits inside a retraction
 * window (removalIntentAt above) and, when found, emits a FieldRemoval --
 * never a FieldUpdate, so item 3 ("a negated phrase must never itself
 * become a positive fact") holds structurally: this function's output
 * never reaches `updates`, only the separate `removals` channel. Position
 * bookkeeping mirrors deterministicExtract's own hitPos() exactly (`t` is
 * `text` lowercased with one leading padding space, so the same span in
 * the ORIGINAL text sits one character earlier). Deliberately independent
 * of the model layer -- retraction is conservative and rail-only by
 * design, the same way the negation window itself always has been.
 *
 * Round 9 (13 Aug 2026), Robert's second finding, item 1: the previous
 * version called `re.exec(t)` once per term and inspected only that FIRST
 * occurrence -- "We use MPLS today, but we no longer use MPLS." failed to
 * remove MPLS because the first "MPLS" (the positive statement) sits
 * outside the retraction window, and nothing ever looked at the SECOND
 * "MPLS" (the actual retraction) at all. Every pattern now runs as a
 * global regex and every occurrence is checked in turn, left to right,
 * stopping at the first occurrence that (a) sits inside a retraction
 * window AND (b) is not an adjectival modifier of a different noun (item
 * 2, isAdjectivalModifier above) -- so a later, genuine retraction is
 * found even when an earlier, unrelated or merely-adjectival mention of
 * the same word exists elsewhere in the same message. */
export function removalsIn(text: string): FieldRemoval[] {
  const t = ` ${text.toLowerCase()} `;
  const out: FieldRemoval[] = [];
  const seen = new Set<string>();
  for (const { path, value, re, quote } of LIST_VALUE_PATTERNS) {
    const id = `${path}:${value}`;
    if (seen.has(id)) continue;
    const globalRe = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(t))) {
      if (m[0].length === 0) { globalRe.lastIndex += 1; continue; } // never loop forever on a zero-width match
      if (removalIntentAt(t, m.index, m[0].length) && !isAdjectivalModifier(t, m.index + m[0].length)) {
        seen.add(id);
        out.push({ path, value, quote, matchedText: m[0].trim(), matchStart: Math.max(0, m.index - 1) });
        break;
      }
    }
  }
  return out;
}

/**
 * `externalNotes` (correction pass 2, Priority 3): optional, backward
 * compatible — every existing caller (draft.fixtures.ts, verify-*.ts
 * scripts, the `text` regression battery above) calls this with one
 * argument and is completely unaffected. When supplied, this is the SAME
 * array extractRequirement() already returns as `notes` for the model
 * path, so a validate() rejection on the deterministic path (a negative
 * count, a decimal, an implausibly large number, a hedged estimate) is
 * pushed straight into it too, instead of only ever reaching the local
 * `sink` this function used to discard on return. Without this, Priority
 * 3's "do not silently discard validation notes" held for the model path
 * (which already threaded its own `notes` parameter through) but not for
 * the deterministic path, where the exact same rejection happened with no
 * way for the buyer to ever see it. */
export function deterministicExtract(text: string, externalNotes?: string[]): FieldUpdate[] {
  const t = ` ${text.toLowerCase()} `;
  const out: FieldUpdate[] = [];
  const sink: string[] = externalNotes ?? []; // validator notes; omissions surface via the receipt
  /** F-D (design integrity, Robert: "the validator exists so every path
   *  reaches the same truth; the rail shouldn't be exempt"): every rail
   *  statement passes the SAME validate() a model proposal passes. What
   *  fails validation is omitted, and the receipt keeps the clause. */
  const say = (path: AllowedPath, value: unknown, quote: string, matchedText?: string, matchStart?: number) => {
    /* rawBuyerText = text (this function's own input) — defence in depth
     * only; the deterministic path already guards estate.users/sites
     * negative-or-decimal shapes upstream of this call (see
     * NEGATIVE_OR_DECIMAL_COUNT below), but passing it keeps this call
     * consistent with the model path and covers any future deterministic
     * rule that doesn't add its own upstream guard. */
    const ok = validate(path, value, sink, quote, text);
    /* Fact Ledger Reliability Gate (13 Aug 2026): most say() calls pass
     * the actual matched span as `quote`, so it doubles as the coverage
     * anchor with no extra work. A few (this file's "canonical label"
     * calls -- "managed security" for an MDR/MSSP/SOC mention, "SD-WAN"/
     * "UK"/"Microsoft" for a bare regex hit) pass a fixed display string
     * instead, which is NOT guaranteed to appear in the buyer's own
     * clause (an "MDR" mention never contains the word "managed"). An
     * explicit `matchedText` lets those calls keep their buyer-facing
     * display quote unchanged while still giving clause-coverage
     * checking (below) a literal span to anchor on, exactly the same
     * shape `infer()` already carries for the same reason. `matchStart`
     * (amendment round, 13 Aug 2026) is the character offset in the
     * ORIGINAL text where that literal span actually sits, threaded
     * through from the regex match itself wherever one is available --
     * see FieldUpdate's own comment for why this matters. */
    if (ok) out.push({ path: ok.path, value: ok.value, provenance: "stated", quote, ...(matchedText ? { matchedText } : {}), ...(typeof matchStart === "number" ? { matchStart } : {}) });
  };
  const infer = (path: AllowedPath, value: unknown, reason: string, matchedText?: string, matchStart?: number) => {
    const ok = validate(path, value, sink, reason, text);
    if (ok) out.push({ path: ok.path, value: ok.value, provenance: "inferred", reason, ...(matchedText ? { matchedText } : {}), ...(typeof matchStart === "number" ? { matchStart } : {}) });
  };
  /** A match that lands only outside the negation window. */
  const hit = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(t);
    return m && !negatedAt(t, m.index, m[0].length) ? m : null;
  };
  /* Fact Ledger Reliability Gate, amendment round (13 Aug 2026): `hit()`'s
   * match position is against `t` (the lowercased text padded with ONE
   * leading space -- see `t`'s own definition), so the corresponding
   * position in the ORIGINAL `text` is one character earlier, exactly the
   * same adjustment `originalSpan()` below already makes for the same
   * reason. Clamped at 0 so a match right at the start never goes
   * negative. */
  const hitPos = (m: RegExpExecArray): number => Math.max(0, m.index - 1);
  /* Fact Ledger Reliability Gate (13 Aug 2026): `hit()`'s match comes from
   * `t`, the lowercased search text, so `m[0]` on its own is always
   * lowercase -- fine for a hardcoded display label ("UK", "SD-WAN"), but
   * WRONG as a "stated"/"your words" quote, which must show the buyer their
   * own words back (a buyer who typed "Healthcare" should see "Healthcare"
   * quoted, not "healthcare"). `t` is `text` lowercased with one leading
   * padding space (see `t`'s own definition above), so the same span at
   * `m.index - 1` in the ORIGINAL `text` is the buyer's actual casing. */
  const originalSpan = (m: RegExpExecArray): string => {
    const start = Math.max(0, m.index - 1);
    return text.slice(start, start + m[0].length) || m[0];
  };

  // Numbers (F-A, semantic integrity: 2, 2,000 and 2 million users are
  // different procurements). Thousands separators parse; magnitude words
  // multiply; one describing word may still sit between the number and its
  // noun ("50 remote users"). A value outside the validator's bounds is
  // OMITTED rather than mangled, so the clause lands in Notes, unplaced.
  /* Fix (correction pass 2, Priority 3 — Test 72, "50000000 sites"): the
   * bare-digit alternative was capped at 7 digits (\d{1,7}, max 9,999,999),
   * so an implausibly large but comma-free count like "50000000" (8 digits)
   * never matched NUM at all -- not "matched and rejected as implausible"
   * (which validate()'s existing magnitude bound below already handles
   * correctly and explains to the buyer) but "never recognised as a number
   * in the first place", which produced total silence instead of the
   * honest "not recorded" note Priority 3 requires. Widening the cap to 9
   * digits (max 999,999,999 -- comfortably past any real site/user count)
   * costs nothing: it does not change what counts as a VALID count
   * (validate()'s 20,000/500,000 ceilings, untouched, still reject it) --
   * it only lets an obviously-too-large typed number reach that existing
   * check instead of silently vanishing before it. */
  const NUM = "(\\d{1,3}(?:,\\d{3})+|\\d{1,9})\\s*(k\\b|thousand\\b|m\\b|million\\b)?";
  const magnitude = (digits: string, mag: string | undefined): number =>
    Math.round(Number(digits.replace(/,/g, "")) * (mag ? (mag.startsWith("k") || mag.startsWith("t") ? 1e3 : 1e6) : 1));

  /* Fix (negative/decimal counts silently mangled, not omitted — the
   * externally reported gap this closes): NUM above is digits-only, so
   * "-5 sites" quietly drops the minus sign and lands 5, and "12.5 sites"
   * quietly drops the ".5" and lands 12 (or, once the regex backtracks
   * looking for a noun immediately after the integer part, can land on the
   * fractional digits instead and lose the whole number entirely). Both
   * outcomes are a mangled, confidently-wrong count — exactly what the two
   * lines above this promise never happens ("OMITTED rather than
   * mangled"). A site or user count can never legitimately be negative or
   * fractional, so this checks for that shape FIRST, ahead of the ordinary
   * NUM match, and when found, omits the field entirely (same silent-omit
   * outcome every other out-of-bounds value already gets via validate())
   * instead of letting the ordinary match run and pick up a wrong number.
   * A ordinary whole positive count is completely unaffected — this only
   * ever short-circuits the two matches below when the text shape genuinely
   * cannot be a valid whole positive count. */
  const NEGATIVE_OR_DECIMAL_COUNT = "(?:-\\s?\\d{1,7}(?:\\.\\d+)?|\\d{1,7}\\.\\d+)";
  const negativeOrDecimalCountMatch = (noun: string) =>
    hit(new RegExp(`${NEGATIVE_OR_DECIMAL_COUNT}\\s*(?:\\w+\\s+)?(?:${noun})\\b`));

  const USER_NOUN = "users?|staff|employees?|people|seats?|heads";
  const negUserMatch = negativeOrDecimalCountMatch(USER_NOUN);
  if (negUserMatch) {
    /* Fix (correction pass 2, Priority 3): use the same buyer-visible
     * QUANTITY_NOT_RECORDED_PREFIX and quoted-match wording validate()
     * itself uses for the identical rejection reason on the model path,
     * now that this note reaches extractRequirement's returned `notes`
     * (via the externalNotes param above) instead of being discarded --
     * so classifyTurnEntry()'s droppedQuantityNote detection (which keys
     * off this exact prefix) picks it up here too. */
    sink.push(`${QUANTITY_NOT_RECORDED_PREFIX}"${clean(negUserMatch[0].trim(), 60)}" is negative or not a whole number, so no user count was recorded. The earlier value, if any, is unchanged — restate a whole positive number to set it.`);
  } else {
    const users = hit(new RegExp(`${NUM}\\s*(?:\\w+\\s+)?(?:${USER_NOUN})\\b`));
    if (users) say("estate.users", magnitude(users[1], users[2]), users[0].trim(), undefined, hitPos(users));
  }

  /* "clinics" joined the noun list 31 Jul 2026 (round 6 dry run: "60
   * clinics" from an NHS buyer landed nothing while "60 shops" landed;
   * same in-lane precedent as the timeline patterns). */
  const SITE_NOUN = "sites?|stores?|branch(?:es)?|offices?|locations?|shops?|practices?|clinics?";
  const negSiteMatch = negativeOrDecimalCountMatch(SITE_NOUN);
  if (negSiteMatch) {
    sink.push(`${QUANTITY_NOT_RECORDED_PREFIX}"${clean(negSiteMatch[0].trim(), 60)}" is negative or not a whole number, so no site count was recorded. The earlier value, if any, is unchanged — restate a whole positive number to set it.`);
  } else {
    const sites = hit(new RegExp(`${NUM}\\s*(?:\\w+\\s+)?(?:${SITE_NOUN})\\b`));
    if (sites) say("estate.sites", magnitude(sites[1], sites[2]), sites[0].trim(), undefined, hitPos(sites));
  }

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
    /* Fix (relative/yearless dates silently dropped — reproduced live with
     * "Q1 next year" and "by October", and the acceptance sentence "...
     * consolidating across 18 branches by Q2 next year."): DATEISH above
     * always required an explicit four-digit 20xx year, so a quarter,
     * half, season or month named WITHOUT a year — or a plain relative
     * reference ("next year", "this quarter") — landed no timeline at all,
     * even though the comment above already names "a horizon" as one of
     * the buyer date shapes this block exists to catch. Two narrow,
     * additive shapes only: a quarter/half/season plus "next"/"this year"
     * ("Q2 next year", "this autumn"), and a bare month name with no year
     * ("by October"). "may" is deliberately left out of the bare-month
     * list — with no year to anchor it and the text already lowercased,
     * "may" collides with the modal verb ("we may need...") too often to
     * treat as a date on its own; the year-anchored DATEISH above still
     * matches "may 2027" fine, since a year makes that reading safe. As
     * with every timeline match, the captured VALUE stays the buyer's own
     * clause verbatim — this never computes or invents an actual date. */
    const DATEISH_NO_YEAR =
      "(?:(?:q[1-4]|h[12])\\s*(?:next|this)\\s+year|(?:spring|summer|autumn|winter)\\s+(?:next|this)\\s+year|(?:next|this)\\s+(?:spring|summer|autumn|winter|year|quarter|month)|(?:jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?)";
    const ANY_DATEISH = `(?:${DATEISH}|${DATEISH_NO_YEAR})`;
    const timeline =
      hit(new RegExp(`(?:live|go[- ]?live|in place|delivered|deployed|migrat(?:ed|ing)|rolled out|completed?|operational|finished|cut(?:ting)? over|ready|working|done)[^.,;]{0,25}?(?:by|before|during|in|for)\\s+(?:the\\s+)?(?:end of\\s+)?${ANY_DATEISH}`)) ??
      hit(new RegExp(`(?:contract|term|agreement|mpls|circuits?)[^.,;]{0,30}?(?:ends?|expir(?:es?|y|ing)|renews?|renewal|up)[^.,;]{0,12}?${ANY_DATEISH}`)) ??
      hit(new RegExp(`(?:timeline|deadline|target)[^.,;]{0,12}?(?:is|:)?[^.,;]{0,20}?${ANY_DATEISH}`)) ??
      hit(new RegExp(`(?:by|before|no later than)\\s+(?:the\\s+)?(?:end of\\s+)?${ANY_DATEISH}`)) ??
      hit(/within\s+(?:the\s+next\s+)?\d{1,2}\s+(?:weeks?|months?)/) ??
      /* Fix (correction pass 2, Priority 5 — "We need this live in 3
       * months."): the buyer's own relative target, captured as their
       * own words, exactly like every other timeline shape above — no
       * absolute calendar date is computed or invented here, since this
       * product has no agreed rule yet for turning "in 3 months" into a
       * specific date. `\bin\b` cannot accidentally match inside
       * "within" (no word boundary sits between its "h" and "i"), so
       * this never double-fires on the "within" case immediately above. */
      hit(/\bin\s+(?:the\s+next\s+)?\d{1,2}\s+(?:weeks?|months?)\b/);
    if (timeline) say("constraints.timeline", timeline[0].trim(), timeline[0].trim(), undefined, hitPos(timeline));
  }

  /* Fact Ledger Reliability Gate (13 Aug 2026), reliability item 1: a
   * buyer who TYPES THE SECTOR'S OWN NAME -- "Healthcare", "Retail",
   * "Manufacturing", "Financial services" and the like -- has stated
   * their sector, not left it for Netify to guess. Before this, sector
   * had no `say()` path at all: every deterministic sector fact, even off
   * a completely literal, unambiguous mention, came out of the inference
   * map below and rendered "netify guessed" (confirmed live, 13 Aug:
   * Robert typed "Healthcare" and got "\"health\" indicates this
   * sector"). This runs FIRST and stops at the first match so a literal
   * mention always wins; it is deliberately narrow -- only the sector's
   * own name or an unambiguous synonym of it, never the ESTATE words
   * (hospital, GP, dental, care home...) that only imply a sector and
   * must stay inferred. Robert's own ruling (28 Jul, see the comment
   * below): "site(s)/branch(es)/trust/campus/practice/fleet/port(s)/
   * outlet(s)/grid/mat NEVER mapped alone" applies here too, so bare
   * ambiguous words (energy, leisure, education) require a sector-naming
   * companion word rather than firing alone. */
  const directSectorMap: Array<[RegExp, (typeof WORKSPACE_SECTORS)[number]]> = [
    [/healthcare|health care|\bpharma(?:ceutical)?\b/, "Healthcare & pharma"],
    [/retail\s*(?:and|&)\s*e-?commerce|\bretail\b|e-?commerce/, "Retail & e-commerce"],
    [/financial services|finance sector|financial sector/, "Financial services"],
    [/\bmanufacturing\b/, "Manufacturing"],
    [/energy\s*(?:and|&)\s*utilit(?:y|ies)|energy sector|utilities sector/, "Energy & utilities"],
    [/government|public sector/, "Government & public sector"],
    [/\beducation(?:al)?\b/, "Education"],
    [/transport\s*(?:and|&)\s*logistics|\blogistics\b/, "Transport & logistics"],
    [/professional services/, "Professional services"],
    [/hospitality/, "Hospitality & leisure"],
  ];
  /* Reliability gate amendment (13 Aug 2026), blocker 4 (Codex's review):
   * "Government security classifications" must NOT set the sector, while
   * "We are a Government organisation" must. Before this guard, the
   * direct map above fired on the sector's own name ANYWHERE it appeared,
   * with nothing checking what the mention was actually ABOUT -- exactly
   * the same class of mistake the region/SOC-capacity guards elsewhere in
   * this function already fixed for "24x7 UK-based support" (a
   * requirement aimed at the vendor, not a fact about the buyer). A
   * direct sector word only STATES the buyer's own sector when either (a)
   * it is self-identifying language ("we are a Government organisation",
   * "operating as a Retail business") or (b) it is immediately followed
   * by an organisational noun (organisation, business, company, trust,
   * council...) that itself makes it a description of the buyer, not of
   * a requirement or a compliance regime the buyer must meet. Deliberately
   * excluded either way when what follows names a REQUIREMENT the sector
   * word is qualifying ("Government security classifications",
   * "Healthcare compliance standards") -- up to two filler words allowed
   * so "Government security classifications" (word, word) still excludes
   * correctly. A mention that satisfies neither test falls through
   * unclaimed, same as any other guard in this file: no field is written,
   * and the clause keeps its receipt via the coverage gate below rather
   * than being forced into the wrong home. */
  /* Reliability gate amendment (13 Aug 2026), round 3, blocker 4 (Codex's
   * second review): bare "is" in SECTOR_SELF_ID_BEFORE was sufficient to
   * treat ANY "<noun> is <Sector>" sentence as self-identification, so
   * "Our policy is Government approved" was wrongly stated. "is" is
   * removed from that alternation entirely -- self-identification now
   * requires an actual self-referring subject ("we are"/"we're"/"operating
   * as"...) or explicit sector-labelling phrasing ("Sector:", "Sector -",
   * "sector is", "our sector is"). Two false negatives are also closed: a
   * message that IS, in its entirety, nothing but the bare recognised
   * sector word ("Healthcare") now states rather than infers (handled by
   * the whole-message fallback in sectorReadsAsBuyerIdentity below, since
   * there is no self-identifying phrase to anchor on when the sector name
   * is the entire buyer message); and the requirement-object exclusion
   * list gains approved/accredited/compliant/endorsed/assured so
   * "Government approved" is excluded from BOTH the direct map (belt and
   * braces -- it was already excluded once "is" stopped matching) and the
   * INFERRED map below, which shares this same constant and would
   * otherwise still wrongly infer the sector from that exact sentence. */
  const SECTOR_SELF_ID_BEFORE =
    /(?:\b(?:we are|we're|we operate as|we run|we are operating as|operating as)\s+(?:an?\s+)?|\bour sector\s+(?:is\s+)?|\bsector\s*(?:is\s*|[:\-]\s*))$/i;
  const SECTOR_ORG_NOUN_AFTER =
    /^[\s,-]*(?:organisation|organization|business|company|firm|sector|practice|group|authority|provider|department|agency|body|trust|council|charity|institution|entity)\b/i;
  const SECTOR_REQUIREMENT_OBJECT_AFTER =
    /^[\s,-]*(?:\w+\s+){0,2}(?:classification|classifications|compliance|standard|standards|certification|certifications|accreditation|accreditations|accredited|approved|compliant|endorsed|assured|clearance|clearances|regulation|regulations|requirement|requirements|polic(?:y|ies)|laws?|legislation|frameworks?|grades?|ratings?|levels?|contracts?|security)\b/i;
  const sectorReadsAsBuyerIdentity = (m: RegExpExecArray, src: string): boolean => {
    const before = src.slice(Math.max(0, m.index - 30), m.index);
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (SECTOR_REQUIREMENT_OBJECT_AFTER.test(after)) return false;
    if (SECTOR_SELF_ID_BEFORE.test(before) || SECTOR_ORG_NOUN_AFTER.test(after)) return true;
    const wholeMessage = src.trim().replace(/[.!?]+$/, "");
    if (wholeMessage.toLowerCase() === m[0].trim().toLowerCase()) return true;
    return false;
  };
  let sectorStated = false;
  for (const [re, sector] of directSectorMap) {
    const m = hit(re);
    if (m && sectorReadsAsBuyerIdentity(m, t)) { say("organisation.sector", sector, originalSpan(m).trim(), undefined, hitPos(m)); sectorStated = true; break; }
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
  /* Skipped when the direct map above already stated the sector: a literal
   * mention always wins, and running this too would propose a second,
   * inferred update for the same scalar path in the same pass. */
  if (!sectorStated) {
    for (const [re, sector] of sectorMap) {
      const m = hit(re);
      /* Blocker 4 (amendment round): the inferred map shares some
       * trigger words with the direct map above (e.g. "government"), so
       * without the same requirement-object exclusion, a mention the
       * direct map correctly refused ("Government security
       * classifications") would still slip through HERE and infer the
       * sector anyway -- the guard above would be defeated by its own
       * fallback. Only the negative half of the direct map's guard
       * applies here (a requirement-object noun right after still
       * excludes); the positive half (self-identification / an
       * organisational noun) is deliberately NOT required for inferred
       * matches, since most of this map's own trigger words are
       * estate/sector nouns ("hospital", "GP practice"...) that were
       * never meant to require self-identifying phrasing -- only the
       * "clause is actually about a REQUIREMENT, not the buyer" failure
       * mode needs excluding here. */
      if (m && !SECTOR_REQUIREMENT_OBJECT_AFTER.test(t.slice(m.index + m[0].length, m.index + m[0].length + 40))) {
        infer("organisation.sector", sector, `"${m[0].trim()}" indicates this sector`, m[0].trim(), hitPos(m));
        break;
      }
    }
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
    /* Reliability gate amendment (13 Aug 2026), blocker 3 (canonical
     * label audit): quote stays the buyer-facing "UK", but that fixed
     * label doesn't literally appear when the trigger was "united
     * kingdom"/"britain"/"london" -- matchedText carries the ACTUAL
     * matched words so clause-coverage checking has a real anchor. */
    if (uk && regionIsBuyerLocation(uk, t)) say("organisation.regions", ["uk"], "UK", uk[0].trim(), hitPos(uk));
  }
  {
    const ie = hit(/(?<!northern )ireland|\bdublin\b/);
    if (ie && regionIsBuyerLocation(ie, t)) say("organisation.regions", ["ie"], ie[0].trim(), undefined, hitPos(ie));
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
    /* Blocker 3: the fixed "US" quote can literally mismatch a "U.S."
     * (periods) trigger -- matchedText carries the exact matched text,
     * position taken directly from `text` (this match already runs
     * against raw text, unlike hit()'s padded-lowercase `t`, so no
     * hitPos() adjustment is needed here). */
    if (us && regionIsBuyerLocation(us, text)) say("organisation.regions", ["us"], "US", us[0].trim(), us.index);
  }
  for (const [re, region] of [
    [/\bfrance\b|\bgermany\b|\bspain\b|\bitaly\b|netherlands|\bholland\b|\bbelgium\b|\bpoland\b|\bportugal\b|\bsweden\b|\bdenmark\b|\baustria\b|switzerland|\bnorway\b|\bfinland\b|luxembourg|\beurope\b|\bemea\b/, "eu"],
    [/\busa\b|\bu\.s\.\b|united states|north america|\bcanada\b/, "us"],
    [/\baustralia\b|\bsingapore\b|\bjapan\b|\bindia\b|hong kong|\bmalaysia\b|new zealand|\bapac\b|asia pacific|\bchina\b|\bshanghai\b|\bbeijing\b|\bshenzhen\b|south korea|\bvietnam\b|\bthailand\b|\bindonesia\b|\bphilippines\b|\btaiwan\b/, "apac"],
    [/\buae\b|\bdubai\b|\bsaudi\b|\bqatar\b|\bbahrain\b|\bkuwait\b|\bisrael\b|south africa|\bnigeria\b|\bkenya\b|\begypt\b/, "me"],
  ] as Array<[RegExp, string]>) {
    const m = hit(re);
    if (m && regionIsBuyerLocation(m, t)) say("organisation.regions", [region], m[0].trim(), undefined, hitPos(m));
  }

  {
    const m = hit(/microsoft|m365|office ?365|\bo365\b/);
    /* Blocker 3: "Microsoft" is the display label; a bare "M365"/"O365"
     * mention never contains that word, so matchedText carries the real
     * trigger. */
    if (m) say("estate.cloud", ["m365"], "Microsoft", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/azure/);
    if (m) say("estate.cloud", ["azure"], "Azure", undefined, hitPos(m));
  }
  {
    const m = hit(/google workspace|gsuite/);
    // Blocker 3: "gsuite" never contains the words "Google Workspace".
    if (m) say("estate.cloud", ["google"], "Google Workspace", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/\baws\b/);
    if (m) say("estate.cloud", ["aws"], "AWS", undefined, hitPos(m));
  }
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
  {
    const m = hit(/sd-?wan/);
    // Blocker 3: "SD-WAN" (hyphenated) can mismatch a hyphen-free "sdwan" trigger.
    if (m && existingEstateSignal.test(t)) say("estate.existingNetwork", ["sdwan"], "SD-WAN", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/\bmpls\b/);
    if (m) say("estate.existingNetwork", ["mpls"], "MPLS", undefined, hitPos(m));
  }

  {
    const m = hit(/incident|breach|phishing|attack|compromis|hacked/);
    // Blocker 3: "incident" is the display label; "breach"/"phishing"/
    // "attack"/"compromised"/"hacked" never contain that word.
    if (m) say("drivers", ["incident"], "incident", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/ransomware/);
    if (m) say("drivers", ["ransomware_concern"], "ransomware", undefined, hitPos(m));
  }
  {
    const m = hit(/renewal|contract end|contract expir|contract is up|ends? in march|ends? in \w+ 20\d\d/);
    // Blocker 3: "contract renewal" is the display label; most of this
    // regex's own alternatives never contain that exact phrase.
    if (m) say("drivers", ["renewal"], "contract renewal", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/audit/);
    if (m) say("drivers", ["audit"], "audit", undefined, hitPos(m));
  }
  {
    const m = hit(/acquisition|merger|growing fast|expansion/);
    // Blocker 3: "growth" is the display label; none of the trigger words
    // (acquisition/merger/growing fast/expansion) contain it.
    if (m) say("drivers", ["growth"], "growth", m[0].trim(), hitPos(m));
  }

  {
    const m = hit(/iso ?27001/);
    // Blocker 3: quote has a fixed space ("ISO 27001"); a space-free
    // "iso27001" trigger wouldn't literally contain it.
    if (m) say("constraints.complianceRequirements", ["iso27001"], "ISO 27001", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/\bpci\b/);
    if (m) say("constraints.complianceRequirements", ["pci_dss"], "PCI", undefined, hitPos(m));
    else {
      const pciHit = hit(/card payments|take cards|card-present/);
      if (pciHit) infer("constraints.complianceRequirements", ["pci_dss"], "card payments bring PCI DSS into scope", pciHit[0].trim(), hitPos(pciHit));
    }
  }
  {
    const m = hit(/cyber essentials/);
    if (m) say("constraints.complianceRequirements", ["cyber_essentials_plus"], "Cyber Essentials", undefined, hitPos(m));
  }
  {
    const m = hit(/nhs dspt|\bdspt\b/);
    // Blocker 3: a bare "DSPT" mention doesn't literally contain "NHS DSPT".
    if (m) say("constraints.complianceRequirements", ["nhs_dspt"], "NHS DSPT", m[0].trim(), hitPos(m));
  }
  // Harry's 22 July finding: NIS2 named verbatim and silently dropped.
  {
    const m = hit(/\bnis\s?2\b/);
    // Blocker 3: "NIS 2" (with a space) wouldn't literally contain the
    // fixed no-space quote "NIS2".
    if (m) say("constraints.complianceRequirements", ["nis2"], "NIS2", m[0].trim(), hitPos(m));
  }
  {
    const m = hit(/\bgdpr\b/);
    if (m) say("constraints.complianceRequirements", ["uk_gdpr"], "GDPR", undefined, hitPos(m));
  }
  {
    const m = hit(/\bfca\b/);
    if (m) say("constraints.complianceRequirements", ["fca"], "FCA", undefined, hitPos(m));
  }

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
      /* Blocker 3: quote "24/7" is fixed; the trigger regex also matches
       * "24x7"/"around the clock"/"twenty four", none of which literally
       * contain "24/7" -- matchedText carries the real matched text. */
      if (!requirementNoun.test(after) && !needSignal.test(before)) say("constraints.inHouseSocCapacity", "twenty_four_seven", "24/7", soc[0].trim(), hitPos(soc));
    } else {
      /* Blocker 3: this branch used to be a bare `.test()` with a
       * hardcoded quote ("no out-of-hours cover") that never matched any
       * of its own trigger phrases ("nobody watching", "no soc"...) --
       * restructured to `hit()` so the real matched words can be
       * threaded through as matchedText/matchStart, same as every other
       * branch in this function. */
      const noSoc = hit(/nobody watching|no out.of.hours|no overnight|no soc\b|no security team/);
      if (noSoc) say("constraints.inHouseSocCapacity", "none", "no out-of-hours cover", noSoc[0].trim(), hitPos(noSoc));
    }
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
  const managedSecurityHit = hit(/\bmdr\b|\bmssp\b|managed (?:security|detection|soc|siem)|security (?:partner|provider|service|operations centre)|\bsoc\b service|incident response service/);
  const sdwanBuyHit = hit(buyRe("sd-?wan"));
  const sdwanBareHit = hit(/sd-?wan/);
  /* Living Procurement UK Decision-Maker Blueprint, correction pass
   * (Robert, 15 Aug 2026), defect 1: "UK 20 site SD-WAN in the
   * manufacturing sector, full SASE required..." followed later by "...
   * we will consider third-party SOC services" DESTRUCTIVELY overwrote
   * the already-stated `procurement.buying: "sase"` with
   * "managed_security" -- managedSecurityHit's own design (see the
   * comment below) treats a bare MDR/MSSP/SOC mention as strong enough
   * buying intent on its own, which is right for a firm statement ("we
   * run SD-WAN and need a managed SOC" -- draft.fixtures.ts's own
   * existing case) but wrong for HEDGED, tentative language ("will
   * consider", "might explore", "possibly") that is real signal but not
   * a firm purchase decision. `procurement.buying` is a single-value
   * path (mergeUpdates' generic "a later stated value replaces the
   * earlier one" scalar-correction rule), so ANY fired update here can
   * silently replace an already-established scope -- guarding the
   * TRIGGER itself (rather than reaching into the generic merge, which
   * many other paths correctly depend on behaving the same way) is the
   * smallest change that stops the destructive rescope at its root. A
   * suppressed tentative mention is not lost: it stays in the turn's own
   * text, which `coverDeclarativeClauses` leaves unplaced, and
   * `thirdPartySecurityConsiderationClauses()` (procurement-templates.ts)
   * gives it its own additive, non-mandatory clause -- "may add a
   * separate operational/security-service consideration, but must never
   * destructively rescope the project." */
  const TENTATIVE_CONSIDERATION_RE = /\b(?:will|may|might|could|would)\s+consider\b|\bconsidering\b|\bpossibly\b|\bmight explore\b|\bmay explore\b|\bcould explore\b/;
  const managedSecurityIsTentative =
    Boolean(managedSecurityHit) && TENTATIVE_CONSIDERATION_RE.test(t.slice(Math.max(0, managedSecurityHit!.index - 40), managedSecurityHit!.index));
  if (managedSecurityHit && !managedSecurityIsTentative) {
    /* Fact Ledger Reliability Gate (13 Aug 2026): the buyer-facing quote
     * stays the canonical "managed security" (unchanged -- that's the
     * clearer label, and no one asked for it to change), but the actual
     * trigger word ("MDR", "MSSP", "SOC service"...) is threaded through
     * as matchedText so clause-coverage checking recognises this clause
     * as represented even though "managed security" itself never
     * literally appears in it. */
    say("procurement.buying", "managed_security", "managed security", originalSpan(managedSecurityHit).trim(), hitPos(managedSecurityHit));
  } else {
    const saseBuyHit = hit(buyRe("sase"));
    const sseBuyHit = hit(buyRe("sse|security service edge|secure service edge"));
    if (saseBuyHit) say("procurement.buying", "sase", "SASE", saseBuyHit[0].trim(), hitPos(saseBuyHit));
    else if (sseBuyHit) say("procurement.buying", "sse", "SSE", sseBuyHit[0].trim(), hitPos(sseBuyHit));
    else if (sdwanBuyHit) {
      say("procurement.buying", "sdwan", "SD-WAN", sdwanBuyHit[0].trim(), hitPos(sdwanBuyHit));
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
      const bareSase = hit(/\bsase\b/);
      const bareSse = hit(/\bsse\b|security service edge|secure service edge/);
      if (bareSase) say("procurement.buying", "sase", "SASE", undefined, hitPos(bareSase));
      else if (bareSse) say("procurement.buying", "sse", "SSE", bareSse[0].trim(), hitPos(bareSse));
      else if (sdwanBareHit) say("procurement.buying", "sdwan", "SD-WAN", sdwanBareHit[0].trim(), hitPos(sdwanBareHit));
    }
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
    const coManagedHit = hit(/co-?managed/);
    const diyHit = hit(/\bdiy\b|self-?managed|manage (?:it )?ourselves|in-?house managed/);
    if (m && !foreignObject) say("procurement.operatingModel", "managed", m[0].trim(), undefined, hitPos(m));
    // Blocker 3: quote "co-managed" is hyphenated; a hyphen-free
    // "comanaged" trigger wouldn't literally contain it.
    else if (coManagedHit) say("procurement.operatingModel", "co_managed", "co-managed", coManagedHit[0].trim(), hitPos(coManagedHit));
    // Blocker 3: quote "self-managed" is fixed; "diy"/"manage it
    // ourselves"/"in-house managed" never contain that exact phrase.
    else if (diyHit) say("procurement.operatingModel", "diy", "self-managed", diyHit[0].trim(), hitPos(diyHit));
  }

  /* PKM extension (vendors/products under consideration, named locations,
   * location criticality, site resilience, one named bespoke phrase): the
   * model is the primary source for all of these -- proper-noun
   * recognition and "does this fit no other field" judgement are model
   * strengths, not regex strengths -- so the deterministic rail below is a
   * narrow, best-effort safety net in the file's existing style (a single
   * hit()/say() per clause), not a general-purpose detector. Every pattern
   * here runs against the RAW-CASE text, not the lowercased t, because
   * capitalisation is the only signal that separates a proper noun from an
   * ordinary word (the same reason the US-region check above uses raw
   * text). Each still passes through the SAME negation window as every
   * lowercase pattern above (F-B: "the ledger must never briefly say X
   * when the buyer said the opposite"), reindexed onto the padded lowercase
   * t so "we are NOT considering Meraki" is not recorded as consideration. */
  const rawHit = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(text);
    return m && !negatedAt(t, m.index + 1, m[0].length) ? m : null;
  };

  const consideringRe = /\b(?:considering|evaluating|looking at|shortlisting|comparing)\s+([A-Z][\w&+-]*(?:\s+[A-Z][\w&+-]*){0,2})/;
  const consider = rawHit(consideringRe);
  if (consider) say("procurement.vendorsUnderConsideration", [consider[1].trim()], consider[0].trim(), undefined, consider.index);

  const providerRe = /\b(?:provided by|our (?:current|existing) provider is|incumbent (?:provider|vendor) is|currently with)\s+([A-Z][\w&+-]*(?:\s+[A-Z][\w&+-]*){0,2})/;
  const provider = rawHit(providerRe);
  if (provider) say("estate.existingProviders", [provider[1].trim()], provider[0].trim(), undefined, provider.index);

  /* Named locations + criticality. Both need the case-insensitive flag:
   * a buyer writes the abbreviation "HQ" capitalised, and a bare lowercase
   * literal in the pattern would silently never match it. */
  const hqRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\s+(?:hq|headquarters|head office)\b/i;
  const hq = rawHit(hqRe);
  if (hq) say("estate.namedLocations", [`${hq[1].trim()} HQ`], hq[0].trim(), undefined, hq.index);

  const criticalRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2}(?:\s+HQ)?)\s+is\s+(?:our\s+)?(business[- ]critical|critical|our main site|our primary site|flagship)\b/i;
  const critical = rawHit(criticalRe);
  if (critical) say("estate.locationCriticality", [critical[0].trim()], critical[0].trim(), undefined, critical.index);

  /* Site resilience / backup connectivity: the whole clause containing a
   * mobile-connectivity term and "backup", captured verbatim so whatever
   * scoping words the buyer used ("other sites", "remaining sites", a
   * named subset) survive untouched. The boundary class stops at a comma
   * or semicolon as well as sentence punctuation -- deliberately, because
   * a comma-joined clause naming a DIFFERENT location (e.g. "Reading HQ is
   * business-critical, while other sites can use 4G or 5G backup") must
   * never be captured as one fact: that would apply one location's
   * resilience statement to another location's criticality statement.
   * Matched against the RAW-CASE text (via rawHit), not the lowercased t:
   * the 4g/5g/backup terms are matched case-insensitively (the /i flag),
   * but the CAPTURED VALUE must keep the buyer's own capitalisation
   * ("4G or 5G", not "4g or 5g") -- preserving their wording exactly, not
   * just the words. */
  const resilienceRe = /[^.,!?;]*\b(?:4g|5g)\b[^.,!?;]*\bbackup\b[^.,!?;]*/i;
  const resilience = rawHit(resilienceRe);
  if (resilience) say("estate.siteResilience", [resilience[0].trim()], resilience[0].trim(), undefined, resilience.index);

  /* Bespoke requirements: one narrow, named deterministic exception, named
   * because the acceptance case names it directly. The general case (a
   * requirement that fits no other path) is not reliably detectable by
   * regex and is left to the model. The captured VALUE is the buyer's own
   * surrounding clause, comma/period-bounded exactly like the resilience
   * clause above -- never an invented paraphrase standing in for their
   * words. */
  const bespokeThreatRe = /[^.,!?;]*threat protection[^.,!?;]*/i;
  const bespokeThreat = rawHit(bespokeThreatRe);
  if (bespokeThreat) say("requirements.bespoke", [bespokeThreat[0].trim()], bespokeThreat[0].trim(), undefined, bespokeThreat.index);

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
- procurement.vendorsUnderConsideration is a vendor or product the buyer is evaluating or thinking about -- never one already in place or already chosen. Never propose this path for a vendor the buyer describes as already deployed or already selected (use estate.namedTechnologies / estate.existingProviders instead), and never imply selection just because a vendor is named.
- estate.namedLocations, estate.locationCriticality and estate.siteResilience must each be scoped to the specific location or group of locations the buyer names -- copy their scoping words in full (a named site, or an exclusion like "other sites" or "the rest of our sites"). Never generalise a statement about one location to the whole estate, and never let a clause about one location apply to a different named location the buyer did not include in it.
- requirements.bespoke is for a concrete requirement in the buyer's own words that does not fit any other allowed path. Only propose it when the text states a real requirement with no better home; never invent one.
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
    /* Correction pass 2, Priority 2: quote computed BEFORE validate() now
     * (previously computed after), so validate() can inspect the buyer's
     * own quoted words for estate.sites/estate.users — see this
     * function's header comment and validate()'s own comment on that
     * case for why the boundary moved here. Every other use of `quote`
     * below this loop is completely unchanged. */
    const quote = typeof f.quote === "string" ? clean(f.quote, 160) : "";
    /* Correction pass 2, Priority 2 (Tests 70/71 — the actual fix): pass
     * `text`, this function's own full raw buyer message, as validate()'s
     * 5th argument. This is the critical wiring — live evidence showed the
     * model sanitises the sign/decimal out of BOTH f.value and its own
     * f.quote before this line ever runs, so sourceText (from `quote`
     * above) can no longer be trusted alone; only the buyer's original,
     * unprocessed text still shows the original shape. */
    const ok = validate(String(f.path ?? ""), f.value, notes, quote || String(f.reason ?? ""), text);
    if (!ok) continue;
    let value = ok.value;
    const stated = quote.length > 2 && lower.includes(quote.toLowerCase());
    /* F-A extension (24 Jul live catch: "across our sites" proposed
     * sites=1): a numeric estate count must trace to a digit in the
     * words it cites, or in the buyer's text at all. Otherwise OMIT:
     * the receipt keeps the clause verbatim, and no count is invented. */
    if ((ok.path === "estate.sites" || ok.path === "estate.users") && !/\d/.test(`${quote} ${String(f.reason ?? "")}`)) {
      /* Correction pass 2, Priority 3 (Test 73 — "quite a few sites,
       * maybe a dozen or so"): same QUANTITY_NOT_RECORDED_PREFIX marker
       * as validate()'s own rejections, so the client can surface a
       * neutral "no precise quantity added" activity entry for this
       * case too, not just the negative/decimal/out-of-range ones. No
       * number is invented here — this branch is reached precisely
       * because the buyer gave none. */
      notes.push(`${QUANTITY_NOT_RECORDED_PREFIX}no whole number was given for ${ok.path === "estate.sites" ? "a site" : "a user"} count, so nothing precise was recorded.`);
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
    /* PKM extension: a vendor proposed as "under consideration" must not be
     * one the model's own evidence describes as already in place or
     * already chosen -- that is estate.namedTechnologies /
     * estate.existingProviders territory, not this path. Same law as every
     * guard above: the claim is dropped, not relabelled, and the clause
     * keeps its receipt. */
    if (ok.path === "procurement.vendorsUnderConsideration") {
      const evidence = (quote || String(f.reason ?? "")).toLowerCase();
      const alreadyThere = /\b(?:already|currently|existing|incumbent|signed with|going with|selected|chosen|our current)\b/;
      if (alreadyThere.test(evidence)) {
        notes.push("Dropped a vendor-under-consideration claim: the words describe an existing or already-chosen vendor, not one being considered.");
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
        "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+20\\d\\d|(?:q[1-4]|h[12])\\s*20\\d\\d|(?:spring|summer|autumn|winter)\\s+20\\d\\d|\\b20\\d\\d\\b|within\\s+(?:the\\s+next\\s+)?\\d{1,3}\\s+(?:days?|weeks?|months?)|in\\s+(?:the\\s+next\\s+)?\\d{1,3}\\s+(?:days?|weeks?|months?)|no fixed date|as soon as possible|\\basap\\b";
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
  // PKM extension: all seven new paths accumulate (a buyer may name more
  // than one technology, provider, vendor under consideration, location,
  // criticality clause, resilience clause or bespoke requirement).
  "estate.namedTechnologies",
  "estate.existingProviders",
  "procurement.vendorsUnderConsideration",
  "estate.namedLocations",
  "estate.locationCriticality",
  "estate.siteResilience",
  "requirements.bespoke",
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
  return dedupeSiteResilience([...model, ...extra]);
}

/* PKM extension (live-preview finding, 3 Aug 2026): the model and the
 * deterministic rail can each find the SAME site-resilience clause worded
 * slightly differently. The rail's match starts right after the previous
 * clause's comma, so it keeps a leading conjunction ("while other sites
 * can use 4G or 5G backup"); the model's own phrasing typically drops it
 * ("other sites can use 4G or 5G backup"). unionUpdates' ordinary list
 * dedup compares raw lowercased strings, so these two never matched and
 * both landed as separate facts, duplicating one requirement on the
 * document. A leading conjunction carries no meaning of its own for THIS
 * comparison, so it is stripped only for the equality check below -- the
 * surviving fact always keeps its own true, unmodified wording (never a
 * conjunction-stripped or otherwise rewritten value), and the fuller of
 * the two wordings wins so nothing the buyer said is lost. Scoped to
 * estate.siteResilience alone: no other path's dedup behaviour changes,
 * and two clauses whose remaining wording differs (different site sets,
 * different connectivity) keep different keys and both still survive. */
const RESILIENCE_LEADING_CONJUNCTION = /^(?:while|and|but)\s+/i;
const resilienceDedupeKey = (s: string): string =>
  String(s).trim().toLowerCase().replace(RESILIENCE_LEADING_CONJUNCTION, "");

function dedupeSiteResilience(updates: FieldUpdate[]): FieldUpdate[] {
  const path: AllowedPath = "estate.siteResilience";
  const slots: Array<{ entryIndex: number; valueIndex: number; text: string; key: string }> = [];
  updates.forEach((u, entryIndex) => {
    if (u.path !== path || !Array.isArray(u.value)) return;
    (u.value as unknown[]).forEach((v, valueIndex) => {
      const text = String(v);
      slots.push({ entryIndex, valueIndex, text, key: resilienceDedupeKey(text) });
    });
  });
  if (slots.length < 2) return updates;

  const byKey = new Map<string, typeof slots>();
  for (const s of slots) byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);

  const drop = new Set<string>(); // "entryIndex:valueIndex" of the shorter, redundant wording
  for (const group of byKey.values()) {
    if (group.length < 2) continue; // no collision under this key: nothing to drop
    const keep = group.reduce((fullest, s) => (s.text.length > fullest.text.length ? s : fullest));
    for (const s of group) if (s !== keep) drop.add(`${s.entryIndex}:${s.valueIndex}`);
  }
  if (drop.size === 0) return updates;

  return updates
    .map((u, entryIndex) => {
      if (u.path !== path || !Array.isArray(u.value)) return u;
      const kept = (u.value as unknown[]).filter((_, valueIndex) => !drop.has(`${entryIndex}:${valueIndex}`));
      return kept.length ? { ...u, value: kept } : null;
    })
    .filter((u): u is FieldUpdate => u !== null);
}

/* ------------------------------------------------------------------ */
/* Fact Ledger Reliability Gate (13 Aug 2026): clause-level coverage   */
/*                                                                      */
/* The invariant this section exists to hold: every declarative clause */
/* in the buyer's message becomes a structured fact, a bespoke         */
/* requirement, or a visible unplaced receipt. Nothing silently        */
/* disappears -- the specific, live failure this closes was            */
/* ProjectDesk.send() only ever keeping a verbatim receipt when ZERO   */
/* facts landed for a whole message (see that file's send()): a        */
/* five-sentence message where four sentences landed a fact and one    */
/* did not returned early and the fifth sentence's own words were      */
/* never kept anywhere. This module supplies the missing half: which   */
/* of the message's clauses the accepted updates never actually        */
/* touched, so the caller (ProjectDesk.send()) can keep them even when */
/* other facts from the same message landed. Pure, deterministic, no   */
/* model call -- the same "the validator/rail is the source of truth,  */
/* not a caller's guess" law the rest of this file already holds.      */
/* ------------------------------------------------------------------ */

/** A declarative clause (sentence) together with its own character
 *  range in the ORIGINAL, unmodified buyer text. Occurrence-aware
 *  coverage (below) depends on this: an update's `matchStart` and a
 *  clause's `[start, end)` must share one coordinate space, or position
 *  comparisons are meaningless. */
export type ClauseSpan = { text: string; start: number; end: number };

/** Splits a buyer's message into its declarative clauses (sentences),
 *  each carrying its own position in the ORIGINAL text. Pure and
 *  deterministic, no NLP: split on a sentence terminator -- the same
 *  boundary chunkForIngest() (ingest.ts) already uses to cut a paste
 *  into cycle-sized pieces, one law for "where does one buyer statement
 *  end and the next begin", not two competing ones. Punctuation-only
 *  fragments are dropped (a floor of 3 characters, matching runCycle()'s
 *  own `trimmed.length < 3` guard on the whole message).
 *
 *  Reliability gate, third amendment (13 Aug 2026, Codex's third review,
 *  item 5): a newline is now ALSO a strong, deterministic boundary,
 *  alongside a sentence terminator -- explicitly instructed as one of
 *  the only two boundary kinds this gate may ever use for deterministic
 *  separation. Every other candidate boundary this file has tried
 *  (commas, colons, slashes, "with", coordinator words) is deliberately
 *  excluded: none of them reliably marks "one buyer statement ends, the
 *  next begins" the way a full stop or a line break does.
 *
 *  Deliberately does NOT normalise whitespace before splitting (the
 *  first version of this gate did, via a `.replace(/\s+/g, " ")` pass) --
 *  that would shift every clause's position relative to the original
 *  text, which is exactly the coordinate space `matchStart` is computed
 *  in. Leading/trailing whitespace around each clause is trimmed from
 *  the returned `text`, with `start`/`end` adjusted to match, so the
 *  returned span always points at the clause's own trimmed content. */
export function splitDeclarativeClauseSpans(text: string): ClauseSpan[] {
  const s = String(text ?? "");
  const rough: Array<{ start: number; end: number }> = [];
  const boundary = /[.!?]+(?=\s|$)|\n+/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(s))) {
    const end = m.index + m[0].length;
    rough.push({ start: cursor, end });
    cursor = end;
  }
  if (cursor < s.length) rough.push({ start: cursor, end: s.length });
  return rough
    .map(({ start, end }) => {
      const chunk = s.slice(start, end);
      const leading = chunk.length - chunk.trimStart().length;
      const trimmed = chunk.trim();
      return { text: trimmed, start: start + leading, end: start + leading + trimmed.length };
    })
    .filter((c) => c.text.length >= 3);
}

/** String-only convenience wrapper, kept for callers (and this file's
 *  own regression script) that only need the clause text, not its
 *  position. */
export function splitDeclarativeClauses(text: string): string[] {
  return splitDeclarativeClauseSpans(text).map((c) => c.text);
}

type AnchorSpan = { anchor: string; start: number; end: number };

/** The literal buyer-text span an update traces to, WITH its position,
 *  for occurrence-aware coverage. Reliability gate amendment (13 Aug
 *  2026, Codex's review, blocker 1): the first version of this gate
 *  checked only whether an anchor's TEXT appeared ANYWHERE in the
 *  message -- so one occurrence of "Azure" (in "We use Azure today")
 *  wrongly covered a LATER, unrelated sentence containing the same word
 *  ("We also require Azure ExpressRoute..."). A real position closes
 *  that gap: coverage now asks whether THIS SPECIFIC occurrence falls
 *  inside THIS clause's own range, not merely whether the word exists
 *  somewhere in the buyer's message.
 *
 *  `matchedText` wins over `quote` when both are present -- deliberately
 *  NOT both, unlike the first version of this gate: a canonical-label
 *  call (say()'s own comment: "managed security" for an MDR mention,
 *  "SD-WAN"/"UK"/"Microsoft" for a bare regex hit) carries a `quote` that
 *  is NOT guaranteed to be the buyer's own literal words at all, so
 *  pairing it with matchedText's real position would misrepresent where
 *  a non-literal display label supposedly "sits". `matchedText`, when
 *  present, is always the true literal trigger and always shares its
 *  match's own position; `quote` is used as the anchor only when
 *  matchedText is absent, in which case (every ordinary say() call,
 *  every "stated" model proposal) quote already IS the literal span.
 *
 *  When `matchStart` itself is absent (a call site that predates this
 *  amendment, or a model proposal whose exact position was never
 *  captured), this falls back to the FIRST occurrence of the anchor
 *  text in the message -- the same "hit() only ever finds the first
 *  occurrence" precedent this file already establishes elsewhere, and a
 *  strictly better fallback than the old file-wide substring check,
 *  since it still pins to ONE real position rather than every
 *  occurrence. Anchors under 3 characters are dropped: checked as a
 *  precise position now, not a file-wide substring, so the old
 *  "us"/"uk" collision risk (colliding with "business"/"custom") this
 *  file's previous version guarded against no longer applies with the
 *  same force, but the floor is kept anyway as a second, cheap line of
 *  defence against a stray short anchor landing on the wrong occurrence
 *  entirely. */
function updateAnchorSpan(u: FieldUpdate, fullText: string, fullTextLower: string): AnchorSpan | null {
  const raw = (u.matchedText ?? u.quote)?.trim();
  if (!raw || raw.length < 3) return null;
  const anchor = raw.toLowerCase();
  const start = typeof u.matchStart === "number" && u.matchStart >= 0 ? u.matchStart : fullTextLower.indexOf(anchor);
  if (start < 0) return null;
  return { anchor, start, end: start + anchor.length };
}

/** Reliability gate, THIRD amendment (13 Aug 2026, Codex's third review --
 *  a source-ledger architecture correction, replacing the SECOND
 *  amendment's conjunction/punctuation splitter entirely).
 *
 *  The second amendment split each clause into atomic sub-spans at an
 *  ever-expanding list of coordinator words and punctuation (and/but/
 *  plus/as well as/;), then checked coverage per atomic unit. Codex's
 *  third review showed this is architecturally unsound in BOTH
 *  directions at once, and cannot be patched by adding more words to the
 *  list: (1) natural English coordinates a second requirement in more
 *  shapes than any punctuation list can enumerate -- a comma, a colon, a
 *  slash, the word "with" all silently lost the second requirement,
 *  exactly like "and"/"but"/"plus" did before THIS list existed -- and
 *  (2) splitting on those same words actively DAMAGES ordinary compound
 *  phrases whose own coordinator sits INSIDE a single correct match
 *  ("Energy and utilities", "research and development", "active-active
 *  and active-passive"): the splitter cuts the clause into pieces
 *  smaller than the phrase itself, so an anchor whose real match spans
 *  the cut point reads as covering only the first half, and the second
 *  half surfaces as a stray, nonsense fragment ("utilities business.").
 *
 *  Robert's explicit correction: stop expanding the splitter and replace
 *  it with a source-ledger design. Concretely:
 *   1. Clauses are split ONLY on strong, deterministic boundaries --
 *      sentence terminators and newlines (splitDeclarativeClauseSpans,
 *      above) -- and never subdivided further. No conjunction,
 *      coordinator or punctuation mark is ever used as a cut point here.
 *   2. This function no longer invents requirements.bespoke facts at
 *      all. A bespoke fact is only ever proposed by deterministicExtract's
 *      own named rules (the threat-protection case above is the one
 *      example) or by a vetted model proposal -- i.e. only when "the
 *      extractor/model explicitly returns that complete span" (Robert's
 *      wording). This gate's own job shrinks to one binary judgement per
 *      clause: is there real buyer content here that no accepted update
 *      already accounts for?
 *   3. When the answer is yes, the clause's FULL, ORIGINAL text -- never
 *      a derived substring -- is kept as an unplaced "needs review"
 *      receipt. A receipt sitting alongside a fact the SAME clause also
 *      produced is expected and accepted: duplication is the safe
 *      outcome instruction 4 asks for, strictly preferred over ever
 *      guessing where a fragment begins or ends. */
/* Round 4, live-testing addendum: the first cut of this stoplist only
 * covered pronouns/articles/copula/auxiliaries/modals and a few generic
 * organisational nouns. Running the rewritten reliability gate against
 * ordinary, already-fully-captured buyer sentences ("We are a Healthcare
 * business WITH 20 sites.", "We need SASE ACROSS 50 sites.", "We USE
 * M365.", "We SUFFERED a breach.") surfaced false "not fully explained"
 * verdicts: plain grammatical glue -- prepositions that carry no meaning
 * independent of the noun phrase an anchor already covers, and a handful
 * of generic framing verbs whose OBJECT is what a fact actually records
 * -- was being counted as an unaddressed second requirement. Every
 * addition below is deliberately still free of conjunctions/coordinators
 * (and/but/plus/or/as well as) and of any content noun a fixture depends
 * on ("Ethernet", "circuit", "protection", "ExpressRoute", "research",
 * "development", "active-active", "sales", "marketing" and their kind
 * are never touched) -- this remains a closed-class stoplist of words
 * that never by themselves constitute a buyer requirement, not a second
 * attempt at clause splitting. */
const RESIDUAL_SCAFFOLDING_RE =
  /\b(?:we're|we've|we|our|us|you're|your|you|i'm|my|i|it's|its|it|this|that|these|those|they're|their|they|a|an|the|is|are|am|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|should|shall|may|might|must|business|company|organisation|organization|firm|sector|with|for|of|across|within|throughout|estate|whole|use|uses|used|using|suffered|today|currently|now)\b/gi;

/** Whether `clause` reads as fully accounted for by the updates that
 *  already anchor somewhere inside it -- a BINARY judgement only. It
 *  never decides WHERE an uncovered fragment begins or ends, and it
 *  never returns one: the caller always keeps the clause's own complete
 *  text when this returns false. Each covering anchor's own matched
 *  SPAN (start through end, not merely its start point -- this is what
 *  lets "Energy and utilities" register as fully covered even though
 *  the match crosses the word "and") is removed from the clause; what
 *  is left is stripped of the closed class of pronouns, articles, the
 *  copula and a few generic organisational nouns above (deliberately
 *  NOT conjunctions, coordinators, or any punctuation mark -- this never
 *  makes a splitting decision, only a keep-the-whole-clause-or-not one)
 *  and anything real left over -- a run of three or more letters/digits
 *  -- means the buyer said something this pass has not accounted for. */
function clauseIsFullyExplained(clause: ClauseSpan, covering: AnchorSpan[]): boolean {
  if (covering.length === 0) return false;
  const local = clause.text;
  const covered = new Array(local.length).fill(false);
  for (const a of covering) {
    const s = Math.max(0, a.start - clause.start);
    const e = Math.min(local.length, a.end - clause.start);
    for (let i = s; i < e; i++) covered[i] = true;
  }
  let residual = "";
  for (let i = 0; i < local.length; i++) residual += covered[i] ? " " : local[i];
  const stripped = residual.replace(RESIDUAL_SCAFFOLDING_RE, " ").replace(/[^a-zA-Z0-9]+/g, " ").trim();
  return !/[a-zA-Z]{3,}/.test(stripped);
}

/** The gate's core: split `text` into clauses (strong boundaries only --
 *  sentence terminators and newlines) and, for every clause no accepted
 *  update already fully accounts for, return its COMPLETE original text
 *  for the caller to keep as an unplaced "needs review" receipt. Never
 *  invents a requirements.bespoke fact and never returns a fragment --
 *  see the design note above. Exported (amendment round, 13 Aug 2026,
 *  blocker 6) so hermetic tests can drive it directly with synthetic
 *  updates, the same way vetModelProposals() already lets tests drive
 *  the model-vetting rail without a real model call. */
export function coverDeclarativeClauses(text: string, updates: FieldUpdate[]): { unplacedClauses: string[] } {
  const fullTextLower = text.toLowerCase();
  const anchorSpans = updates
    .map((u) => updateAnchorSpan(u, text, fullTextLower))
    .filter((a): a is AnchorSpan => a !== null);
  const unplacedClauses: string[] = [];
  for (const clause of splitDeclarativeClauseSpans(text)) {
    if (!/[a-zA-Z]{3,}/.test(clause.text)) continue; // punctuation/number-only fragment: nothing to place
    const covering = anchorSpans.filter((a) => a.start >= clause.start && a.start < clause.end);
    if (!clauseIsFullyExplained(clause, covering)) unplacedClauses.push(clause.text);
  }
  return { unplacedClauses };
}

/** Folds the buyer's own verbatim source turns into a legacy notes
 *  string, in one place, so every caller that persists a buyer-notes
 *  field (the RFP wizard's payload, the security-sourcing create route)
 *  composes it identically (round 4, Codex's third review, item 6:
 *  "ensure the retained source turn flows into saving, publishing...
 *  not merely the transient chat display"). Pure and directly testable,
 *  independent of any particular persistence route. */
export function notesWithSourceTurns(baseNotes: string, sourceTurns: string[] | undefined): string {
  const turns = (sourceTurns ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!turns.length) return baseNotes;
  const line = `Buyer's original wording, preserved verbatim: ${turns.join(" | ")}.`;
  return [baseNotes, line].filter(Boolean).join(" ");
}

export async function extractRequirement(text: string, base: SecurityRequirementInput = {}): Promise<ExtractResult> {
  const notes: string[] = [];
  /* Fix (correction pass 2, Priority 1 — Tests 21, 22, 23, 24, 26, 31,
   * 34): a message explanationForInput() recognises as a glossary
   * question must never be able to mutate the Understanding, however it
   * might otherwise be read. Before this fix, "What is SASE?"/"What is
   * MDR?"/etc. were correctly recognised as glossary questions by
   * classifyTurnEntry()'s C1 branch downstream in QuickSorWorkspace.tsx —
   * but deterministicExtract() ALSO independently fires an unrelated
   * "bare mention = buying/compliance intent" rule for exactly those same
   * seven inputs (SASE/SD-WAN/SSE/MDR/PCI DSS bare-mention rules), and
   * whichever real fact change wins priority over any clarification
   * classification, so the buyer silently got a wrong fact instead of
   * the glossary answer. The model path has no equivalent guard either —
   * nothing stops it independently reaching the same conclusion its own
   * way for a term it happens to recognise.
   *
   * Rather than adding a per-term regex exclusion inside
   * deterministicExtract() for each of the seven (which would need
   * re-discovering and re-patching for every future bare-mention rule,
   * and still wouldn't guard the model path at all), this is ONE
   * precedence rule at the ONE boundary every extraction call already
   * passes through — this function, called identically by the API route
   * and any script — checked first, before either extraction path or the
   * model ever runs: if the text is a recognised glossary question,
   * extraction is skipped entirely, so there is no proposal of any kind
   * for unionUpdates()/validate() to ever consider, and nothing downstream
   * needs to guess which update might have been "the glossary one". A
   * substantive statement that merely mentions an approved term ("We need
   * SASE across 50 sites.", "Suppliers must explain their SD-WAN
   * design.") is not a recognised glossary question — explanationForInput()
   * requires an exact "what is X" / "what does X mean" / "explain X" /
   * "can you explain X" shape after narrow normalisation — so extraction
   * for those proceeds completely unaffected below. */
  if (explanationForInput(text)) {
    notes.push("Recognised as a glossary question; no extraction was attempted so the answer can't be read as a new project fact.");
    return { requirement: base, updates: [], engine: "deterministic_fallback", notes, unplacedClauses: [], removals: [] };
  }
  const det = deterministicExtract(text, notes);
  const modelUpdates = await modelExtract(text, notes);
  const modelSpoke = Boolean(modelUpdates && modelUpdates.length > 0);
  const unionedUpdates = modelSpoke ? unionUpdates(modelUpdates!, det) : det;
  const engine = modelSpoke ? "model" : "deterministic_fallback";
  /* Fact Ledger Reliability Gate (13 Aug 2026, third amendment): run
   * AFTER model+det are unioned, so a clause the model or the rail
   * already covered (however it covered it) never ALSO surfaces as an
   * unplaced receipt. Never invents a fact -- see coverDeclarativeClauses'
   * own design note above; `updates` is exactly `unionedUpdates`, nothing
   * appended. */
  const { unplacedClauses } = coverDeclarativeClauses(text, unionedUpdates);
  const updates = unionedUpdates;
  /* Seventh amendment (13 Aug 2026): retraction detection is rail-only and
   * independent of the model/det union above (see removalsIn()'s own
   * comment) -- computed directly off the buyer's raw text, never off
   * `updates`, so it can never be confused with, or suppressed by,
   * whatever the model or the rail did or didn't propose this turn. */
  const removals = removalsIn(text);
  return {
    requirement: applyUpdates(base, updates),
    updates,
    engine,
    ...(engine === "model" ? { model: MODEL } : {}),
    notes,
    unplacedClauses,
    removals,
  };
}

export const WORKSPACE_EXTRACT_MODEL = MODEL;
