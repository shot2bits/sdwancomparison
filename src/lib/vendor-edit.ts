/**
 * The supplier record wiki: proposals, review, approval.
 *
 * Two lanes, and the separation is constitutional rather than a preference.
 *
 * FACTS may be proposed by the supplier itself. A supplier correcting its own
 * PoP count with a page that proves it makes the dataset better, and refusing
 * that help would be pride rather than rigour. Every proposal must carry a
 * source URL and the sentence on that page, because the standard for a
 * supplier-supplied fact is the standard we hold ourselves to.
 *
 * JUDGEMENT may never be proposed by a supplier, not even as a suggestion.
 * The summary, the differentiators, the best-fit statement and above all the
 * watch-outs are the Netify View. Article 7 makes a supplier influence channel
 * into the rules the highest-severity defect in the platform, and the
 * against-interest verdicts are the entire reason an engine cites us rather
 * than a listicle. A vendor who can soften their own watch-outs has removed
 * the moat. This is enforced server side, not by hiding a field in the UI.
 *
 * Nothing here writes to a vendor record directly. Approval moves a proposal
 * into an overlay; the overlay is folded into data/vendors/*.json by
 * scripts/apply-vendor-overrides.ts at build time, so the pages stay static,
 * the record stays a file, and git keeps the audit trail. A proposal is never
 * lost and never silently applied.
 */

import { kvGetJson, kvSetJson, kvRaw, kvConfigured } from "@/lib/rfp-store";

/* ------------------------------------------------------------------ */
/* What may be edited, and by whom                                     */
/* ------------------------------------------------------------------ */

/** Facts. Supplier may propose; Netify approves. Evidence is mandatory. */
export const FACT_FIELDS = [
  "pop_count",
  "sla_availability_pct",
  "underlay_ownership",
  "sse_layer_ownership",
  "regulatory_documentation",
  "delivery_model",
  "published_pricing",
  "website",
  "product_focus",
  "cost_model",
] as const;

/** Grouped facts, addressed as group.key, e.g. sectors.healthcare. */
export const FACT_GROUPS = ["sectors", "regions", "organisation_fit", "capabilities"] as const;

/** Judgement. Netify only. A supplier proposal touching these is refused. */
export const JUDGEMENT_FIELDS = [
  "shortlist_summary",
  "key_differentiators",
  "best_fit_for",
  "watch_outs",
  "category",
  "evidence_summary",
] as const;

export type FieldClass = "fact" | "judgement" | "unknown";

export function classifyField(field: string): FieldClass {
  if ((JUDGEMENT_FIELDS as readonly string[]).includes(field)) return "judgement";
  if ((FACT_FIELDS as readonly string[]).includes(field)) return "fact";
  const [group] = field.split(".");
  if ((FACT_GROUPS as readonly string[]).includes(group) && field.includes(".")) return "fact";
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Guidance: the editor is a brief, not a form                         */
/* ------------------------------------------------------------------ */

export type FieldGuidance = { question: string; standard: string; good: string; bad: string };

export const GUIDANCE: Record<string, FieldGuidance> = {
  shortlist_summary: {
    question: "In two or three sentences, what is this supplier actually for, and who should not buy it?",
    standard: "Judgement, not description. It should be useful to a buyer who has already read the feature grid and still cannot choose.",
    good: "Strongest where a distributed retail or branch estate wants MPLS and local firewalls gone in one move. Weakest for an agent-only remote workforce, where paying for edge hardware and a private backbone buys nothing.",
    bad: "A leading provider of innovative SASE solutions for the modern enterprise.",
  },
  key_differentiators: {
    question: "What can this supplier do that its closest three rivals cannot?",
    standard: "Each point must be falsifiable and specific. If a rival could claim the same sentence, it is not a differentiator.",
    good: "Licensed in-country PoPs in Beijing, Shanghai and Shenzhen, which is rare and matters for cross-border performance into mainland China.",
    bad: "Best-in-class performance and security.",
  },
  best_fit_for: {
    question: "Describe the buyer who should shortlist this supplier first.",
    standard: "Name the shape of the estate, the team, and the constraint. Not the industry alone.",
    good: "Mid-market multi-site organisations with a lean IT team that wants one console for network and security rather than two.",
    bad: "Enterprises of all sizes.",
  },
  watch_outs: {
    question: "What would make a buyer regret choosing this supplier, and what should they ask before signing?",
    standard: "This is the against-interest section and it is why we get cited. Vague hedging is worse than saying nothing. Name the specific question to ask.",
    good: "Tier-to-feature mapping is not published, so confirm in writing which tier includes DLP and CASB before comparing prices.",
    bad: "As with any provider, buyers should carefully evaluate their requirements.",
  },
  category: {
    question: "Which of the agreed categories does this supplier belong in?",
    standard: "One of the agreed set, mutually exclusive. Not a description.",
    good: "Managed provider and carrier",
    bad: "Global managed SD-WAN / SASE provider with security capability",
  },
  evidence_summary: {
    question: "One sentence on what the sources collectively establish about this supplier.",
    standard: "What the evidence supports, not what the supplier claims.",
    good: "Cato's own sources evidence a cloud-native private backbone and a Private PoP option; the pricing position rests on a single marketplace listing.",
    bad: "Cato is a leading SASE vendor.",
  },
};

export const FACT_GUIDANCE: FieldGuidance = {
  question: "What is the correct value, and which page proves it?",
  standard:
    "A source URL and the exact sentence on that page are both required. We check the sentence is really there before anything is applied. A supplier's own published page is the strongest source for a claim about itself.",
  good: 'Value 180. Source: the supplier\'s network page. Quote: "Our backbone now spans 180 points of presence worldwide."',
  bad: "Value 180. Source: our internal roadmap.",
};

/* ------------------------------------------------------------------ */
/* The proposal record                                                 */
/* ------------------------------------------------------------------ */

export type ProposalStatus = "pending" | "approved" | "rejected";

export type Proposal = {
  id: string;
  vendor_slug: string;
  field: string;
  field_class: FieldClass;
  proposed_value: string;
  source_url: string | null;
  quote: string | null;
  rationale: string | null;
  /** Who proposed it. "supplier" is the vendor itself; "netify" is Harry or an admin. */
  proposed_by: "supplier" | "netify";
  proposer_email: string;
  proposed_at: string;
  status: ProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

const KEY_ALL = "vendoredit:proposals";
const KEY_OVERLAY = "vendoredit:overlay";

/** Approved facts, keyed vendor -> field -> value + provenance. Read at build. */
export type Overlay = Record<
  string,
  Record<string, { value: string; source_url: string | null; quote: string | null; approved_at: string; approved_by: string }>
>;

export function editingConfigured(): boolean {
  return kvConfigured();
}

export async function listProposals(status?: ProposalStatus): Promise<Proposal[]> {
  const all = (await kvGetJson<Proposal[]>(KEY_ALL)) ?? [];
  const sorted = [...all].sort((a, b) => b.proposed_at.localeCompare(a.proposed_at));
  return status ? sorted.filter((p) => p.status === status) : sorted;
}

export async function addProposal(p: Omit<Proposal, "id" | "proposed_at" | "status" | "reviewed_by" | "reviewed_at" | "review_note">): Promise<Proposal> {
  const all = (await kvGetJson<Proposal[]>(KEY_ALL)) ?? [];
  const rec: Proposal = {
    ...p,
    id: `vp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    proposed_at: new Date().toISOString(),
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  };
  all.push(rec);
  await kvSetJson(KEY_ALL, all);
  return rec;
}

export async function reviewProposal(
  id: string,
  decision: "approved" | "rejected",
  reviewer: string,
  note: string | null,
): Promise<{ ok: boolean; proposal?: Proposal; error?: string }> {
  const all = (await kvGetJson<Proposal[]>(KEY_ALL)) ?? [];
  const i = all.findIndex((p) => p.id === id);
  if (i === -1) return { ok: false, error: "No such proposal." };
  if (all[i].status !== "pending") return { ok: false, error: `Already ${all[i].status}.` };

  all[i] = { ...all[i], status: decision, reviewed_by: reviewer, reviewed_at: new Date().toISOString(), review_note: note };
  await kvSetJson(KEY_ALL, all);

  if (decision === "approved") {
    const overlay = (await kvGetJson<Overlay>(KEY_OVERLAY)) ?? {};
    const v = (overlay[all[i].vendor_slug] ??= {});
    v[all[i].field] = {
      value: all[i].proposed_value,
      source_url: all[i].source_url,
      quote: all[i].quote,
      approved_at: all[i].reviewed_at!,
      approved_by: reviewer,
    };
    await kvSetJson(KEY_OVERLAY, overlay);
  }
  return { ok: true, proposal: all[i] };
}

export async function getOverlay(): Promise<Overlay> {
  return (await kvGetJson<Overlay>(KEY_OVERLAY)) ?? {};
}

/** Used by the build script after it has folded the overlay into the files. */
export async function clearOverlay(): Promise<void> {
  await kvRaw(["DEL", KEY_OVERLAY]);
}
