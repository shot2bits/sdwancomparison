/**
 * Living Procurement Canvas Phase 2 (14 Aug 2026): the published snapshot.
 *
 * THE PRODUCT RULE (Robert's Phase 2 brief): publication is a boundary, not
 * a UI event. Before it, a buyer's project is a private, editable draft --
 * no project-specific vendor match, no invitation, no export. Publication
 * freezes exactly what was published (content, matches, invitations,
 * consent) into ONE durable, versioned record, so the board notice, the
 * vendor invitations and every later export (Word, PDF, market report) all
 * read from the SAME frozen state -- never "the PDF from one object, the
 * board notice from another, and vendor questions from a third
 * independently mutable draft" (Robert's own words).
 *
 * SCOPE NOTE, updated 17 Aug 2026 (2030 blueprint, full-unification phase)
 * -- superseding the note this replaces. Until now, this snapshot froze
 * only `rfp_sections` + `buyer` (the legacy methodology-question pipeline's
 * output), explicitly NOT a `LivingProcurementDocument`, because that
 * compiler had no production caller yet and freezing a document neither
 * system produced in production would have been dishonest. That is no
 * longer true: `ProjectDesk.tsx` now submits its own already-compiled
 * `LivingProcurementDocument` with every save (`procurement_document` on
 * `ProjectDetails` -- see rfp-types.ts and procurement-document.ts's own
 * "Persistence" section), so a real one now exists to freeze. This
 * snapshot freezes it into `frozen_content.living_document`, ALONGSIDE the
 * legacy `rfp_sections`/`buyer` fields (kept, unchanged, never removed --
 * every snapshot written before this phase, and every reader that has not
 * yet been repointed, keeps working exactly as before). `living_document`
 * is optional and `null` on any snapshot frozen before this phase or from a
 * save whose client had not yet started sending it -- readers (the
 * Procurement Room, every export) treat that honestly as "no living
 * document on this snapshot", falling back to the legacy fields, never
 * fabricating one. `compiler_version` below is still the RFP document
 * pipeline's own real version field (`ProjectDetails.methodology_version`),
 * unchanged by this addition.
 *
 * AFTER-PUBLICATION EDITS -- the ONE safe rule this file implements (Robert
 * asked for exactly one, chosen and documented, not both): a published
 * snapshot is IMMUTABLE once created. The underlying `ProjectDetails`
 * record MAY still be edited after publication (rescope flows, corrections
 * -- existing behaviour, unchanged; see rfp-governed-revision.ts for how
 * those edits are tracked) -- draft version N+1 keeps evolving -- but the
 * live board notice, every export route and the market report all read
 * ONLY from the latest FROZEN snapshot (version N), never from the live,
 * possibly-drifted project, until the buyer explicitly republishes (calls
 * the same publish route again), which -- per rfp-governed-revision.ts's
 * idempotent, content-addressed event identity -- creates a new snapshot
 * version only when the content genuinely changed, and is a safe no-op
 * (never a duplicate board opportunity, invite or notification) when it
 * did not.
 */

import { kvGetJson, kvSetJson } from "@/lib/rfp-store";
import type { ProjectDetails, BuyerContext, RfpSection } from "@/lib/rfp-types";
import type { MarketReport } from "@/lib/market-report";
import type { LivingProcurementDocument } from "@/lib/workspace/procurement-document";
import type { ShortlistInput, ShortlistVendor } from "@/lib/shortlist-core";
import crypto from "node:crypto";

/** Deterministic JSON stringify: object keys sorted recursively, so the
 *  SAME logical content always hashes to the SAME string regardless of
 *  property insertion order (JSON.stringify alone does not guarantee this
 *  across independently-constructed objects). Arrays keep their own order
 *  (order is semantic there). */
function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sort((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

/** SHA-256 content hash, hex-encoded. Used both as the snapshot's own
 *  `content_hash` (an auditable, independently-recomputable identifier of
 *  exactly what was published) and, keyed differently, as the publish
 *  event's content-addressable identity (see rfp-governed-revision.ts) --
 *  the same primitive serving two related but distinct honesty properties:
 *  "what did this snapshot contain" and "is this publish request a genuine
 *  repeat of the last one." */
export function contentHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

/**
 * The canonical content snapshot of an RFP's governed, buyer-authored
 * content -- title, buyer context and the full section/question tree.
 * Deliberately EXCLUDES volatile/operational fields (timestamps, history,
 * invited_vendors, business_verification, consents, tokens): those change
 * on every publish/save as a SIDE EFFECT of governance, not because the
 * buyer's actual requirement changed, and including them would make every
 * publish look like a content change even when nothing the buyer wrote
 * differed -- defeating the idempotent-replay detection this snapshot
 * exists to support. Exported so both the publish core and the governed-
 * revision layer hash/diff the exact same shape.
 *
 * DELIBERATELY EXCLUDES `procurement_document` (17 Aug 2026, full-
 * unification phase): that field is a settled OUTPUT of the same
 * source_ledger/decision_ledger/rfp_sections content already hashed here,
 * recompiled client-side on every relevant render -- including it would
 * make the idempotent-replay/MarketUnlock machinery (rfp-governed-
 * revision.ts, market-unlock.ts) sensitive to float rounding or key
 * ordering in a derived recompute rather than to the buyer's own governed
 * content actually changing, which is precisely the risk this whole
 * engagement has repeatedly protected against. The living document is
 * frozen alongside this hash (see frozen_content.living_document), never
 * folded into what defines "the same publish event".
 */
export function rfpContentSnapshot(p: ProjectDetails): Record<string, unknown> {
  return {
    title: p.title,
    buyer: p.buyer,
    rfp_sections: p.rfp_sections,
    nda: p.nda,
  };
}

export type PublishedSnapshot = {
  id: string;
  project_id: string;
  /** This snapshot's own sequence among this project's snapshots (1 for
   *  the first publish, 2 for the first genuine republish, ...) -- the
   *  governed-revision reducer's own `cycle` at the moment this snapshot
   *  was frozen (see rfp-governed-revision.ts), so "published document
   *  version" and "which governed event produced it" are the same number,
   *  never two independently-maintained counters that could drift. */
  document_version: number;
  /** The REAL document pipeline's own version field -- see this file's
   *  top-of-file scope note for why this is not a Canvas-compiler version. */
  compiler_version: string;
  methodology_version: string;
  /** The security-sourcing engine's rulebook version, when this project
   *  carries an engine verdict; null for non-engine (network/wizard)
   *  projects, where no rulebook applies. */
  rulebook_version: string | null;
  published_at: number;
  /** Private: the verified account that executed this publish. Never
   *  included in any public projection. */
  published_by: string;
  consent: { action: string; at: number; granted_by: string; text: string } | null;
  /** SHA-256 of `rfpContentSnapshot()` at the moment this snapshot was
   *  frozen -- an independently-recomputable proof of exactly what content
   *  was published, so "does the current live draft match what's
   *  published" is a plain hash comparison, not a guess. */
  content_hash: string;
  /** The frozen content itself, so every export can render EXACTLY what
   *  was published even if the live project has since been edited --
   *  never regenerated from the (possibly drifted) live project.
   *  `living_document`: see this file's own top-of-file scope note
   *  (updated 17 Aug 2026) -- the real persisted/frozen canonical
   *  envelope going forward; `null`/absent only on a pre-unification
   *  snapshot or a save from a client that had not yet started sending
   *  one. `rfp_sections`/`buyer` remain the legacy fields, kept for every
   *  existing reader and for honest fallback when no living document was
   *  frozen. */
  frozen_content: { title: string; buyer: BuyerContext; rfp_sections: RfpSection[]; living_document?: LivingProcurementDocument | null };
  public_projection: { opportunity_id: string | null; url: string | null };
  private_requirement: { rfp_id: string };
  /** `buildShortlist()`'s own criteria_summary -- the SAME ranking engine
   *  executePublish() already used to select invitees, never a second,
   *  independently-computed match. */
  match_criteria: string;
  /** Ranked slugs from the SAME `buildShortlist()` call executePublish()
   *  used to select invitees -- the project-specific match list that stays
   *  hidden until this snapshot exists. */
  matched_vendor_ids: string[];
  invited_vendor_ids: string[];
  /** Round 4 correction (14 Aug 2026), Robert's findings 4 and 5:
   *  `market_report.matched` below comes from `matchSuppliers()` -- a
   *  DIFFERENT, simpler ranking than `buildShortlist()`, the one that
   *  actually selected `matched_vendor_ids`/`invited_vendor_ids` above.
   *  The two can genuinely diverge (a live-demo run showed an invited
   *  vendor absent from `market_report.matched.names`'s capped top-8).
   *  These carry the REAL vendor NAMES for those two id lists, frozen at
   *  publish time from the SAME buildShortlist()/invite-selection call --
   *  so "exactly as published" is literally true even if a vendor is
   *  later renamed or removed from the live dataset, rather than resolved
   *  against the current directory on every later read. Optional: a
   *  snapshot frozen before this schema addition has neither; callers
   *  fall back to `matched_vendor_ids`/`invited_vendor_ids` (always
   *  present) resolved against the live directory, and label that
   *  honestly rather than claiming it is frozen. */
  matched_vendors?: { slug: string; name: string }[];
  invited_vendors?: { slug: string; name: string; supplier_url: string }[];
  /** Exact provider records and revision identities used for this
   *  publication. Optional for snapshots written before this contract. */
  provider_evidence?: Array<{
    slug: string;
    name: string;
    provider_id: string | null;
    revision_id: string | null;
    dataset_version: string | null;
    record: ShortlistVendor;
  }>;
  provider_provenance?: {
    shortlist_contract_version: string;
    provider_contract_version: string;
    dataset_versions: string[];
    loaded_at: string;
  };
  provider_match_input?: ShortlistInput;
  accepted_assumptions: string[];
  open_decisions: string[];
  /** Cached at publish time so every later read (the report route, a
   *  future export) serves the SAME figures instead of recomputing against
   *  a vendor dataset or estimator that may have moved on since. */
  market_report: MarketReport;
};

/**
 * Market-unlock correction round 2 (16 Aug 2026), requirement 3: the frozen
 * revision `commitMarketUnlock()` must be able to verify BEFORE it commits.
 *
 * This is deliberately smaller than `PublishedSnapshot` above and persisted
 * MUCH earlier in the publish saga (rfp-publish.ts step B, before the board
 * Opportunity is even created, let alone matching/invitations computed) --
 * it freezes only the document content and its hash, the two things that
 * are genuinely fixed the instant the buyer's content is captured. The
 * richer `PublishedSnapshot` (matched/invited vendor lists, market_report)
 * is still written once, at the END of the saga (step G), once those are
 * actually known -- but it reuses THIS SAME id, so "the frozen revision
 * MarketUnlock references" and "the row the full snapshot is saved under"
 * are always one identity, never two independently-minted ones that could
 * drift apart.
 *
 * Immutable once created, like PublishedSnapshot: `saveFrozenRevision()`
 * is a plain create, never called twice for the same id with different
 * content (a genuinely new publish attempt always mints a new id).
 */
export type FrozenRevision = {
  id: string;
  project_id: string;
  content_hash: string;
  /** See PublishedSnapshot.frozen_content's own comment -- `living_document`
   *  added 17 Aug 2026, same optional/fallback treatment. */
  frozen_content: { title: string; buyer: BuyerContext; rfp_sections: RfpSection[]; living_document?: LivingProcurementDocument | null };
  created_at: number;
};

function frozenRevisionKey(id: string): string {
  return `rfp:frozen_revision:${id}`;
}

export async function saveFrozenRevision(revision: FrozenRevision): Promise<void> {
  await kvSetJson(frozenRevisionKey(revision.id), revision);
}

export async function getFrozenRevision(id: string): Promise<FrozenRevision | null> {
  return kvGetJson<FrozenRevision>(frozenRevisionKey(id));
}

function latestKey(rfpId: string): string {
  return `rfp:${rfpId}:published_snapshot`;
}
function historyKey(rfpId: string): string {
  return `rfp:${rfpId}:published_snapshots`;
}

export async function getLatestPublishedSnapshot(rfpId: string): Promise<PublishedSnapshot | null> {
  return kvGetJson<PublishedSnapshot>(latestKey(rfpId));
}

export async function getPublishedSnapshotHistory(rfpId: string): Promise<PublishedSnapshot[]> {
  return (await kvGetJson<PublishedSnapshot[]>(historyKey(rfpId))) ?? [];
}

/** Snapshots are immutable once created: this ALWAYS appends a new record
 *  (or updates the "latest" pointer to it) -- it never mutates an existing
 *  entry. Callers only invoke this when rfp-governed-revision.ts has
 *  confirmed a genuine new event (never on a replay). */
export async function savePublishedSnapshot(rfpId: string, snapshot: PublishedSnapshot): Promise<void> {
  const history = await getPublishedSnapshotHistory(rfpId);
  // Cap history so a project republished hundreds of times cannot grow the
  // record unbounded; the last 50 versions is generous for any real
  // republish cadence and matches this codebase's existing cap convention
  // (rfp-publish.ts's publish:leads list caps at 500).
  const nextHistory = [...history, snapshot].slice(-50);
  await kvSetJson(historyKey(rfpId), nextHistory);
  await kvSetJson(latestKey(rfpId), snapshot);
}
