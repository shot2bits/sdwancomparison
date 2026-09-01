import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, publicProject, hasAcceptedNda, kvConfigured } from "@/lib/rfp-store";
import { ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { recordRfpBenchmark, recordDemandSample, indexRfpForBuyer } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { isMarketUnlocked, getMarketUnlock } from "@/lib/market-unlock";
import { mergeSourceLedger, parseIncomingSourceTurns } from "@/lib/workspace/source-ledger";
import { mergeDecisionLedger, parseIncomingDecisionTurns } from "@/lib/workspace/decision-ledger";
import { buildEnvelopeUpdate } from "@/lib/workspace/envelope";
import { rfpContentSnapshot, contentHash } from "@/lib/published-snapshot";
import { applyGovernedEvent } from "@/lib/rfp-governed-revision";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** The supplier projection: what a share-token holder may see. */
function supplierView(project: ProjectDetails, ndaAccepted: boolean) {
  const pub = publicProject(project);
  if (project.nda.required && !ndaAccepted) {
    return {
      ...pub,
      rfp_sections: [], // redacted until the NDA is accepted
      nda_required: true,
      teaser: {
        sector: project.buyer.sector,
        organisation_size: project.buyer.organisation_size,
        product_scope: project.buyer.product_scope,
        operating_model: project.buyer.operating_model,
        region_count: project.buyer.regions.length,
        question_count: project.rfp_sections.filter((s) => s.included).reduce((n, s) => n + s.questions.length, 0),
      },
    };
  }
  return { ...pub, viewer: "supplier" };
}

/**
 * Read an RFP. The id alone grants nothing: it appears in every supplier link,
 * so an id-open read would leak the full project (and, before this gate, the
 * editable builder) to any supplier who trimmed the URL.
 *
 *   owner (manage_token via body/header/?manage=, owner session, or Netify)
 *     → full project (credentials stripped);
 *   ?token={share_token}
 *     → supplier view, NDA teaser respected;
 *   otherwise → 401.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  const url = new URL(req.url);

  // Owner read: full project. Kept exactly schema-shaped (no marker keys),
  // because the builder PUTs this object straight back and the schema is
  // strict — the market-unlock fields below are therefore attached as
  // SIBLING keys on the JSON response, never merged into the project object
  // itself (a stray `market_unlocked` surviving a later PUT's blind spread
  // would fail ProjectDetailsSchema's strict parse and break every save).
  const access = await requireRfpOwner(req, project);
  if (access.ok) {
    const unlock = await getMarketUnlock(id);
    return Response.json({ ...publicProject(project), market_unlocked: unlock !== null, market_unlock: unlock }, { headers: cors });
  }

  // Supplier read: requires the share token from the response link.
  const shareToken = (url.searchParams.get("token") ?? "").trim();
  if (shareToken && shareToken === project.share_token) {
    // Row-8 hotfix (16 Aug 2026), amended in the market-unlock correction
    // round (16 Aug 2026): this branch previously returned the full
    // supplierView (rfp_sections, buyer details, project-specific content)
    // to anyone holding the share token, with no check on publish state.
    // The token is minted at project creation and the "Response link"
    // control in the UI copies it unconditionally, so before the row-8 fix
    // a draft-stage link handed out (or guessed, given rfp-store.ts's
    // non-cryptographic newId()) granted the same disclosure that fix
    // closed for the owner-driven invite/vendor-panel paths. The row-8 fix
    // gated this on `hasPublished(project.status)`; that is now replaced
    // with the canonical `isMarketUnlocked()` check, since a project can
    // satisfy hasPublished() while its board listing (and therefore its
    // market unlock) has failed. Responds identically to "not found" — not
    // a distinct "not published yet" or "not unlocked yet" message — so
    // this path cannot be used to distinguish a draft/locked project from
    // one that doesn't exist.
    if (!(await isMarketUnlocked(id))) {
      return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
    }
    const vendor = (url.searchParams.get("vendor") ?? "").trim();
    const accepted = project.nda.required ? await hasAcceptedNda(project, vendor) : true;
    return Response.json(supplierView(project, accepted), { headers: cors });
  }

  return ownerRequired("Reading this RFP workspace", cors);
}

/** Full update (the agent and the UI both PUT the whole ProjectDetails). */
export async function PUT(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const existing = await getProject(id);
  if (!existing) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  // Mutation is owner-only. A plain buyer session is NOT enough — that would
  // let any signed-in visitor (including a supplier who signed up as a buyer)
  // rewrite any RFP whose id they saw in a share link.
  const access = await requireRfpOwner(req, existing, body);
  if (!access.ok) return ownerRequired("Editing this RFP", cors);

  const regenerate = body.regenerate === true;
  delete body.regenerate;

  // Fourth amendment (13 Aug 2026), gap 2/3 fix: this PUT is the wizard's
  // pre-publish refresh path (and every subsequent non-security Save), so
  // it needs the exact same treatment as the security-scope re-scope route.
  // `source_turns` is a request-body convenience shape, not a
  // ProjectDetailsSchema field (the schema's canonical field is
  // `source_ledger`, an array of validated entries) — pulled out and
  // deleted BEFORE the blind spread below, so it can never pass through raw
  // (wrong field name/shape) or silently overwrite instead of merging.
  const incomingSourceTurns = parseIncomingSourceTurns(body.source_turns);
  delete body.source_turns;
  // Defects 3/4 (correction pass, 15 Aug 2026): same pulled-out-before-the-
  // blind-spread treatment as source_turns immediately above.
  const incomingDecisionTurns = parseIncomingDecisionTurns(body.decision_turns);
  delete body.decision_turns;
  // Full-unification CLOSURE pass (17 Aug 2026), bug found while wiring the
  // canonical envelope in: `position` is NOT a ProjectDetailsSchema field
  // (it never was -- POST /api/rfp only ever reads it transiently, to pick
  // the earned bank set at creation, never persists it) but rfpPayload()
  // (ProjectDesk.tsx) has always sent it on EVERY save, including this PUT.
  // Left in the blind spread below, it made `ProjectDetailsSchema.safeParse`
  // reject the WHOLE save with "Unrecognized key: position" -- meaning every
  // non-security-scope ProjectDesk save AFTER the first (every refreshRecord
  // call) has been silently failing with a 422 pre-dating this pass. Pulled
  // out and deleted, same convention as source_turns/decision_turns
  // immediately above; its `covered_sections` is read below for the
  // canonical envelope's own RFI-set derivation, matching what POST already
  // does at creation.
  const rawPosition = body.position as { covered_sections?: unknown; sector?: unknown } | undefined;
  const coveredSections = rawPosition && Array.isArray(rawPosition.covered_sections) ? rawPosition.covered_sections.map(String) : [];
  delete body.position;
  // Full-unification CLOSURE pass: same "pull out before the blind spread,
  // verify, merge explicitly" treatment for the canonical envelope's own
  // fields -- `facts`/`receipts`/`envelope_revision`/`envelope` must never
  // pass through the blind spread raw (unvalidated, unverified, bypassing
  // envelope.ts entirely); `compiled_document`/`base_revision`/`instrument`
  // are request-body-only convenience fields, not ProjectDetailsSchema
  // fields at all (mirroring source_turns/decision_turns), so they are
  // deleted unconditionally regardless of outcome.
  const mergedSourceLedger = mergeSourceLedger(existing.source_ledger ?? [], incomingSourceTurns);
  const mergedDecisionLedger = mergeDecisionLedger(existing.decision_ledger ?? [], incomingDecisionTurns);
  const envelopeOutcome = await buildEnvelopeUpdate({
    existing: { procurement_document: existing.procurement_document ?? null, envelope_revision: existing.envelope_revision ?? 0 },
    body,
    mergedSourceLedger,
    mergedDecisionLedger,
    coveredSections,
    savedBy: access.session?.email ?? existing.owner_email ?? "unauthenticated",
  });
  delete body.facts;
  delete body.receipts;
  delete body.envelope_revision;
  delete body.envelope;
  delete body.compiled_document;
  delete body.base_revision;
  delete body.instrument;
  // A raw client-submitted `procurement_document` must never pass through
  // the blind spread untouched -- it is ONLY ever set from
  // `envelopeOutcome` below (the server's own verified recompute). This is
  // the exact gap the prior pass left open (a client's compiled-document
  // bytes were trusted outright); closing it here, not just in the new
  // `facts`-bearing path, so an old field name can never resurrect it.
  delete body.procurement_document;
  // Server-owned marketplace projections can only be changed by their
  // dedicated matching/publication services, never by a whole-project PUT.
  delete body.match_preview;
  delete body.marketplace_state;
  delete body.marketplace_revision;
  if (envelopeOutcome.participates && !envelopeOutcome.ok) {
    return Response.json({ error: envelopeOutcome.error }, { status: envelopeOutcome.status, headers: cors });
  }

  // Preserve immutable/credential/ownership fields: a PUT must never rotate the
  // manage_token, reassign identity-bearing tokens, or move the RFP to another
  // account.
  let merged = {
    ...existing,
    ...(body as object),
    id: existing.id,
    share_token: existing.share_token,
    created: existing.created,
    manage_token: existing.manage_token,
    owner_email: existing.owner_email,
    // Merged explicitly (never overwritten by the spread above, and never
    // left to whatever body.source_ledger happened to contain): accretes
    // idempotently by stable turn id, exactly like the re-scope route.
    source_ledger: mergedSourceLedger,
    decision_ledger: mergedDecisionLedger,
    ...(envelopeOutcome.participates && envelopeOutcome.ok
      ? {
          facts: envelopeOutcome.facts,
          receipts: envelopeOutcome.receipts,
          procurement_document: envelopeOutcome.procurement_document,
          envelope_revision: envelopeOutcome.envelope_revision,
          envelope: envelopeOutcome.envelope,
        }
      : {}),
  } as typeof existing;

  // Adopt ownership: a token-authorised save from a signed-in buyer binds the
  // RFP to that account (covers RFPs created before sign-in or before
  // owner_email existed), so account access keeps working across devices.
  if (!merged.owner_email && access.viaToken && access.session && (access.session.role === "buyer" || access.session.role === "netify")) {
    merged = { ...merged, owner_email: access.session.email };
    try { await indexRfpForBuyer(access.session.email, existing.id); } catch { /* best effort */ }
  }

  // Engine records: the document is generated from the project's verdict by
  // its own engine adapter, never by the legacy SASE synthesis (which would
  // replace the security sections wholesale). One truth per engine.
  if (regenerate && existing.engine) {
    return Response.json(
      { error: "This project's document is generated from its scoping verdict. Re-scope through Security Sourcing (a new verdict regenerates the document); the legacy scope regeneration does not apply here." },
      { status: 409, headers: cors },
    );
  }

  // Regenerate methodology sections from buyer context, preserving custom and mandatory choices.
  if (regenerate) {
    const custom = existing.rfp_sections.flatMap((s) => s.questions.filter((q) => q.source === "custom").map((q) => ({ category: s.category, q })));
    const mandatoryIds = new Set(existing.rfp_sections.flatMap((s) => s.questions.filter((q) => q.mandatory).map((q) => q.id)));
    const fresh = synthesiseSections(merged.buyer);
    for (const { category, q } of custom) {
      let sec = fresh.find((s) => s.category === category);
      if (!sec) { sec = { category, included: true, questions: [] }; fresh.push(sec); }
      if (!sec.questions.some((x) => x.id === q.id)) sec.questions.push(q);
    }
    for (const s of fresh) for (const q of s.questions) if (mandatoryIds.has(q.id)) { q.mandatory = true; if (q.priority === "optional") q.priority = "required"; }
    merged = { ...merged, rfp_sections: fresh };
  }

  const parsed = ProjectDetailsSchema.safeParse(merged);
  if (!parsed.success) {
    return Response.json({ error: "Invalid RFP shape.", issues: parsed.error.issues.slice(0, 5) }, { status: 422, headers: cors });
  }
  let saved;
  try {
    saved = await saveProject(parsed.data);
  } catch (e) {
    // Write-gate refusals (append-only history, phase/status consistency,
    // protected transparency content) surface as a clear 409 naming what to
    // restore; the builder keeps the buyer's unsaved edits on screen.
    return Response.json({ error: (e as Error).message }, { status: 409, headers: cors });
  }
  if (existing.status !== "published" && saved.status === "published") {
    const mandatory = saved.rfp_sections.flatMap((s) => s.questions.filter((q) => q.mandatory && q.feature_id !== "custom").map((q) => q.feature_id));
    try { await recordRfpBenchmark(saved.buyer.sector, mandatory); } catch { /* best effort */ }
    // Demand flywheel for the cost/TCO page: anonymised, month-bucketed,
    // real BuyerContext fields only. Never blocks the publish.
    try { await recordDemandSample(saved.buyer, mandatory); } catch { /* best effort */ }
  }

  // Living Procurement Canvas Phase 2 (14 Aug 2026): record this save as a
  // governed "requirement_edit" event -- a direct document edit, exactly
  // the event kind Robert's brief names, now tracked through a REAL
  // production route rather than only the Phase 1 fixtures. Best effort
  // and strictly observational: it never gates or alters the save, which
  // has already fully succeeded above. When `existing.status ===
  // "published"`, this write is precisely "a later draft after
  // publication" (Robert's brief) -- it is recorded here, but it never
  // touches the published snapshot the export/report routes read from
  // (published-snapshot.ts): the snapshot stays frozen until the buyer
  // explicitly republishes, so this save can never silently change what
  // was already published.
  try {
    const before = rfpContentSnapshot(existing);
    const after = rfpContentSnapshot(saved);
    const eventId = `save:${saved.id}:${contentHash({ before, after })}`;
    await applyGovernedEvent(saved.id, "requirement_edit", eventId, before, after);
  } catch { /* observational only, never blocks the save */ }

  const unlock = await getMarketUnlock(saved.id);
  return Response.json({ ...saved, market_unlocked: unlock !== null, market_unlock: unlock }, { headers: cors });
}
