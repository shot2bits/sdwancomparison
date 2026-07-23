/**
 * The derivation rulebook for the Continuation, one deriver per family
 * (Robert's ruling, 23 Jul 2026: a dispatcher over small, independently
 * testable family derivers, never one enormous function).
 *
 * THE LAW, EXECUTABLE: no derivation, no rendering. Context can exist
 * without being sufficient; every deriver states its own sufficiency
 * rules and returns null when they are not met. The renderer never
 * decides. Changes to this file are rulebook changes: fixtures first,
 * review before ship, version bump in types.ts when rules change.
 */

import type { Vendor } from "@data/schema";
import {
  CONTINUATIONS_VERSION,
  FAMILY_LABELS,
  type Continuation,
  type ContinuationFamily,
} from "./types";

/* ------------------------------------------------------------------ */
/* Sources: a discriminated union, one member per family               */
/* ------------------------------------------------------------------ */

export type ContinuationSource =
  | { kind: "vendor"; vendor: Vendor }
  | { kind: "comparison"; a: Vendor | null | undefined; b: Vendor | null | undefined }
  | { kind: "sector"; sectorKey?: string; sectorLabel?: string; pageTitle: string; pins?: string[] }
  | { kind: "tool_shortlist"; names: string[]; slugs: string[]; considered: number }
  | { kind: "tool_cost"; hasEstimate: boolean; users: number; sites: number; managed: boolean }
  | { kind: "question"; packCount: number; questionCount: number }
  | { kind: "sample_rfp"; sampleTitle: string };

/* ------------------------------------------------------------------ */
/* Shared assembly: every Continuation is built the same way            */
/* ------------------------------------------------------------------ */

function build(
  family: ContinuationFamily,
  source: string,
  stamp: string,
  sentence: string,
  pins: string[],
  reassurance: string,
  deepClaim?: string,
): Continuation {
  return {
    version: CONTINUATIONS_VERSION,
    family,
    source,
    stamp,
    sentence,
    label: FAMILY_LABELS[family],
    pins: pins.slice(0, 5),
    reassurance,
    ...(deepClaim ? { deepClaim } : {}),
  };
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------ */
/* Family derivers                                                     */
/* ------------------------------------------------------------------ */

/** Sufficiency: an evaluation date and at least one graded capability.
 *  A vendor record that merely exists derives nothing. */
export function deriveContinuationVendor(vendor: Vendor | null | undefined): Continuation | null {
  if (!vendor?.slug || !vendor.name) return null;
  if (!vendor.last_verified) return null;
  if (!vendor.capabilities || Object.keys(vendor.capabilities).length === 0) return null;
  const provider = /provider/i.test(vendor.category ?? "");
  return build(
    "vendor",
    `vendor:${vendor.slug}`,
    `Continue from this page · ${vendor.name} · evaluated ${fmtDate(vendor.last_verified)}`,
    provider
      ? `We are evaluating ${vendor.name} as a managed provider for our estate.`
      : `We are evaluating ${vendor.name} for our SASE and SD-WAN requirement.`,
    [vendor.slug],
    `${vendor.name} arrives pinned; the evaluated market takes position around your words. Nothing runs until you go, and nothing publishes without your signature.`,
  );
}

/** Sufficiency: both sides must individually derive. Either null, all null. */
export function deriveContinuationComparison(
  a: Vendor | null | undefined,
  b: Vendor | null | undefined,
): Continuation | null {
  const ca = deriveContinuationVendor(a);
  const cb = deriveContinuationVendor(b);
  if (!ca || !cb || !a || !b) return null;
  return build(
    "comparison",
    `comparison:${a.slug}-vs-${b.slug}`,
    `Continue from this comparison · ${a.name} vs ${b.name}`,
    `We are deciding between ${a.name} and ${b.name} for our estate.`,
    [a.slug, b.slug],
    `Both suppliers arrive pinned; the desk's evidence lines show where each stands against the requirements your own words create.`,
  );
}

/** The shipped Sector Bridge wording, carried over verbatim (24 Jul
 *  prefills). A ranked sector page always holds real context (the
 *  shortlist itself); an unmapped sector gets the sentence that is true
 *  everywhere, exactly as the Bridge ruled. The deep claim renders only
 *  for healthcare, where the sector pack genuinely holds it. */
const SECTOR_PREFILL: Record<string, string> = {
  healthcare: "We are a healthcare provider replacing legacy connectivity with managed SD-WAN and SASE.",
  financial_services: "We are a financial services firm consolidating network and security into SASE.",
  retail_ecommerce: "We are a retailer needing a PCI DSS compliant network.",
  manufacturing: "We are a manufacturer securing IT and OT with managed SASE.",
  energy_utilities: "We are an energy and utilities operator needing resilient, secure networking for remote and critical locations.",
  government_public_sector: "We are a public sector organisation buying SD-WAN and SASE with UK data residency.",
  education: "We are an education provider connecting campuses with managed SD-WAN.",
  transport_logistics: "We are a transport and logistics operator connecting depots with resilient SD-WAN.",
  professional_services: "We are a professional services firm consolidating security into SASE for hybrid work.",
  hospitality_leisure: "We are a hospitality operator needing managed SD-WAN across the estate.",
};
const SECTOR_GENERIC = "We are replacing legacy connectivity with managed SD-WAN and SASE.";

export function deriveContinuationSector(src: {
  sectorKey?: string;
  sectorLabel?: string;
  pageTitle: string;
  pins?: string[];
}): Continuation | null {
  if (!src.pageTitle) return null;
  const mapped = src.sectorKey ? SECTOR_PREFILL[src.sectorKey] : undefined;
  const label = src.sectorLabel ?? "your sector";
  return build(
    "sector",
    `sector:${src.sectorKey ?? "general"}`,
    src.sectorLabel ? `Continue from this shortlist · ${src.sectorLabel}` : `Continue from this shortlist`,
    mapped ?? SECTOR_GENERIC,
    src.pins ?? [],
    src.pins?.length
      ? `The suppliers ranked on this page arrive pinned; your ${label.toLowerCase()} sector becomes part of the conversation from your first sentence.`
      : `Your ${label.toLowerCase()} sector becomes part of the conversation from your first sentence, and an anonymous notice reaches the market only when you sign.`,
    src.sectorKey === "healthcare"
      ? "The workspace already understands healthcare: NHS DSPT, clinical change windows and HSCN are part of the conversation."
      : undefined,
  );
}

/** Sufficiency: a non-empty live shortlist. An empty tool derives nothing. */
export function deriveContinuationTool(src: {
  names: string[];
  slugs: string[];
  considered: number;
}): Continuation | null {
  if (!src.names.length || !src.slugs.length) return null;
  const shown = src.names.slice(0, 4);
  return build(
    "tool_shortlist",
    `tool:shortlist:${src.slugs.slice(0, 5).join(",")}`,
    `Continue from your shortlist · ${src.slugs.length >= 5 ? 5 : src.slugs.length} of ${src.considered} suppliers`,
    `Take our shortlist (${shown.join(", ")}) to market.`,
    src.slugs,
    `The shortlist's own criteria seed the position; nothing retyped, and the suppliers arrive pinned.`,
  );
}

/** Sufficiency: an estimate has actually been produced from the buyer's
 *  own inputs. The pristine calculator derives nothing. */
export function deriveContinuationCost(src: {
  hasEstimate: boolean;
  users: number;
  sites: number;
  managed: boolean;
}): Continuation | null {
  if (!src.hasEstimate) return null;
  if (!Number.isFinite(src.users) || !Number.isFinite(src.sites) || src.users <= 0 || src.sites <= 0) return null;
  return build(
    "tool_cost",
    `tool:cost:${src.users}u-${src.sites}s`,
    `Continue from your estimate · ${src.sites} sites · ${src.users} users`,
    `We are budgeting ${src.managed ? "a managed network and security estate" : "a network and security estate"} for ${src.users.toLocaleString("en-GB")} users across ${src.sites} sites.`,
    [],
    `Your scenario's own numbers seed the position; real supplier responses replace the model's bands.`,
  );
}

/** Sufficiency: the bank actually holds questions on this render. */
export function deriveContinuationQuestion(src: { packCount: number; questionCount: number }): Continuation | null {
  if (src.packCount <= 0 || src.questionCount <= 0) return null;
  return build(
    "question",
    `question-bank:${src.questionCount}`,
    `Continue from the question bank · ${src.questionCount} questions in ${src.packCount} packs`,
    `We are preparing a formal SASE or SD-WAN requirement.`,
    [],
    `Your position forms first; when it warrants the formal document, the Workspace recommends the RFP Builder with your words carried in.`,
  );
}

/** Sufficiency: a titled sample document on the page. */
export function deriveContinuationSampleRfp(src: { sampleTitle: string }): Continuation | null {
  if (!src.sampleTitle) return null;
  return build(
    "sample_rfp",
    "sample-rfp",
    `Continue from the sample RFP`,
    `We are preparing an RFP like this one for our own project.`,
    [],
    `Your position forms first; when it warrants the formal document, the Workspace recommends the RFP Builder with your words carried in.`,
  );
}

/* ------------------------------------------------------------------ */
/* The dispatcher: thin by law                                          */
/* ------------------------------------------------------------------ */

export function deriveContinuation(source: ContinuationSource): Continuation | null {
  switch (source.kind) {
    case "vendor": return deriveContinuationVendor(source.vendor);
    case "comparison": return deriveContinuationComparison(source.a, source.b);
    case "sector": return deriveContinuationSector(source);
    case "tool_shortlist": return deriveContinuationTool(source);
    case "tool_cost": return deriveContinuationCost(source);
    case "question": return deriveContinuationQuestion(source);
    case "sample_rfp": return deriveContinuationSampleRfp(source);
    default: return null;
  }
}
