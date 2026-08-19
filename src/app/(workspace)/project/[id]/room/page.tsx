import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, kvConfigured } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { projectPhase } from "@/lib/project-machine";
import { getLatestPublishedSnapshot } from "@/lib/published-snapshot";
import { procurementRoomState } from "@/lib/procurement-room";
import ProjectNav from "@/components/ProjectNav";
import SignIn from "@/components/SignIn";
import { ProvenanceTag } from "@/components/procurement/ProvenanceTag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Procurement Room (2030 blueprint, Checkpoint D, 17 Aug 2026).
 *
 * THE PRODUCT RULE this page exists to honour (published-snapshot.ts's own
 * doc comment, carried forward here): publication freezes exactly what was
 * published into ONE durable record, so the board notice, the invitations
 * and every later export all read from the SAME frozen state. This page is
 * that same rule applied to the buyer's own read surface -- it renders
 * EXCLUSIVELY from `getLatestPublishedSnapshot()`'s `frozen_content` and
 * the snapshot's own cached `market_report`/matched/invited lists, never
 * from the live (possibly since-edited) `ProjectDetails`. If the live
 * project has since changed, this page still shows exactly what was
 * published, labelled as such -- the live draft is one click away
 * (Overview), never blended in here.
 *
 * Three honest states, not one screen pretending to be three:
 *   1. Never published: an explicit "not yet published" placeholder (no
 *      snapshot exists -- nothing to freeze yet).
 *   2. Published, no real snapshot (a legacy record from before Phase 2
 *      introduced PublishedSnapshot): says so plainly rather than
 *      fabricating a frozen view that never existed.
 *   3. Published with a real snapshot: the frozen room itself.
 *
 * Auth mirrors project/[id]/page.tsx exactly (tokenOk || sessionOwner) --
 * this is buyer-private, same as every other Project tab; nothing here is
 * exposed to an unauthenticated reader or to suppliers (who have their own
 * separate, NDA-gated response surfaces).
 */

export const metadata: Metadata = { title: "Procurement Room", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

export default async function ProcurementRoomPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { manage } = await searchParams;
  if (!kvConfigured()) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const jar = await cookies();
  const session = await getSession(jar.get(SESSION_COOKIE)?.value ?? null);
  const tokenOk = Boolean(project.manage_token) && manage === project.manage_token;
  const sessionOwner =
    Boolean(session) &&
    (session?.role === "netify" ||
      (session?.role === "buyer" && Boolean(project.owner_email) && session.email.toLowerCase() === project.owner_email.toLowerCase()));

  if (!tokenOk && !sessionOwner) {
    return (
      <div className="procurement-2030 min-h-[60vh]" style={{ background: "var(--nf-ivory, #F7F1E6)" }}>
        <div className="mx-auto max-w-xl px-6 py-24">
          <p className="m-0 mb-2 text-[11px] font-semibold uppercase" style={{ fontFamily: "var(--nf-font-mono)", letterSpacing: "0.12em", color: "var(--nf-ink-400, #7A7263)" }}>Procurement Room</p>
          <h1 className="m-0 mb-3 text-2xl" style={{ fontFamily: "var(--nf-font-serif)", color: "var(--nf-ink-900, #17140F)" }}>This room is private to the buyer</h1>
          <p className="mb-6 text-sm" style={{ color: "var(--nf-ink-600, #4A4438)" }}>
            Open it from your builder link (it carries your private key), or sign in with the email that created it.
          </p>
          <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this project." /></div>
        </div>
      </div>
    );
  }

  const qs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";
  const engine = project.engine === "security_sourcing";
  const phase = projectPhase(project);
  const snapshot = await getLatestPublishedSnapshot(id);
  const roomState = procurementRoomState(phase, snapshot);

  // 2030 visual pass (18 Aug 2026, decision 3): the Room is "the post-
  // publication state of the same product," so it now carries the same
  // .procurement-2030 tokens/typography roles as States 0/1/2/4 -- ivory
  // canvas, serif document title, mono eyebrows, dark "frozen" card
  // matching Mission Control's own dark treatment (this IS the closest
  // real analogue to the prototype's dark issue-control card for a
  // published state). Every figure below is unchanged, real
  // `PublishedSnapshot` data -- only colour/typography/class changed in
  // this pass, no logic, no new fields.
  const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };
  return (
    <div className="procurement-2030" style={{ background: "var(--nf-ivory, #F7F1E6)" }}>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="m-0 mb-1 text-[11px] font-semibold uppercase" style={{ ...mono, letterSpacing: "0.12em", color: "var(--nf-ink-400, #7A7263)" }}>Procurement Room</p>
        <h1 className="m-0 mb-1 text-2xl" style={{ fontFamily: "var(--nf-font-serif)", color: "var(--nf-ink-900, #17140F)" }}>{project.title || "Untitled project"}</h1>
        <p className="mb-5 text-sm" style={{ color: "var(--nf-ink-600, #4A4438)" }}>
          The frozen record of exactly what was published -- the same content the board notice, your invited vendors and every export all read from.
        </p>

        <ProjectNav id={id} manage={tokenOk ? manage : undefined} active="room" engine={engine} />

        {roomState !== "frozen" || !snapshot ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed p-6 text-center" style={{ borderColor: "var(--nf-ink-200, #DCD3C0)" }}>
            <p className="m-0 text-sm font-semibold" style={{ color: "var(--nf-ink-900, #17140F)" }}>
              {roomState === "published_no_snapshot"
                ? "Published, but no frozen record exists for this project."
                : "This room opens once you publish."}
            </p>
            <p className="m-0 mt-2 text-sm" style={{ color: "var(--nf-ink-600, #4A4438)" }}>
              {roomState === "published_no_snapshot"
                ? "This project was published before the frozen-record system existed, so there is nothing here to show honestly -- the live requirement is still the source of truth for it. Republishing will create one."
                : "Publishing freezes your requirement, your matched vendors and your market report into one durable record. Nothing here is guessed or partial -- it simply does not exist until you publish."}
            </p>
            <p className="m-0 mt-4 text-sm">
              <Link href={`/rfp-builder/${id}/preview${qs}`} className="underline" style={{ color: "var(--nf-orange-strong, #AA3E06)" }}>
                {roomState === "published_no_snapshot" ? "Open your published requirement" : "Preview and publish"}
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 mb-6 rounded-[18px] border p-4" style={{ background: "var(--nf-ink-950, #100E0A)", borderColor: "#2B2519", color: "#EFEAE0" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--nf-emerald, #0B6745)" }} />
                  <span className="text-[13px] font-semibold text-white">Frozen at publication</span>
                  <span style={{ color: "#6E6656" }}>·</span>
                  <span className="text-[12.5px]" style={{ color: "#D8D0BE" }}>Version {snapshot.document_version}</span>
                  <span style={{ color: "#6E6656" }}>·</span>
                  <span className="text-[12.5px]" style={{ color: "#D8D0BE" }}>
                    {new Date(snapshot.published_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <ProvenanceTag kind="approved" dark />
              </div>
            </div>

            <section className="mb-4 rounded-[14px] border p-4" style={{ borderColor: "var(--nf-rule, #E4D9C2)", background: "var(--nf-ivory-card, #FFFDF8)" }}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="m-0 text-[10.5px] font-semibold uppercase" style={{ ...mono, letterSpacing: "0.11em", color: "var(--nf-ink-400, #7A7263)" }}>What was published</p>
                <ProvenanceTag kind="evidence" />
              </div>
              {snapshot.frozen_content.living_document ? (
                // 2030 blueprint, full-unification phase (17 Aug 2026): the
                // real persisted/frozen Living Procurement Document, when
                // this snapshot has one -- clause and readiness figures
                // read straight from it, never recomputed.
                <p className="m-0 text-sm" style={{ color: "var(--nf-ink-800, #252019)" }}>
                  <span className="font-medium">{snapshot.frozen_content.living_document.title}</span> -- {snapshot.frozen_content.living_document.clauses.length} requirement{snapshot.frozen_content.living_document.clauses.length === 1 ? "" : "s"} across {new Set(snapshot.frozen_content.living_document.clauses.map((c) => c.section)).size} section{new Set(snapshot.frozen_content.living_document.clauses.map((c) => c.section)).size === 1 ? "" : "s"}, exactly as they stood at the moment of publication.
                </p>
              ) : (
                // Legacy fallback: a snapshot frozen before this phase, or
                // from a save whose client had not yet started sending a
                // living document -- honest about which content this is
                // rather than fabricating a living-document reading.
                <p className="m-0 text-sm" style={{ color: "var(--nf-ink-800, #252019)" }}>
                  <span className="font-medium">{snapshot.frozen_content.title}</span> -- {snapshot.frozen_content.rfp_sections.length} section{snapshot.frozen_content.rfp_sections.length === 1 ? "" : "s"} of requirements, exactly as they stood at the moment of publication.
                </p>
              )}
              {snapshot.accepted_assumptions.length > 0 && (
                <p className="m-0 mt-2 text-xs" style={{ color: "var(--nf-ink-600, #4A4438)" }}>
                  Accepted assumptions: {snapshot.accepted_assumptions.join("; ")}
                </p>
              )}
              {snapshot.open_decisions.length > 0 && (
                <p className="m-0 mt-2 text-xs" style={{ color: "var(--nf-ink-600, #4A4438)" }}>
                  Open at publication: {snapshot.open_decisions.join("; ")}
                </p>
              )}
            </section>

            <section className="mb-4 rounded-[14px] border p-4" style={{ borderColor: "var(--nf-rule, #E4D9C2)", background: "var(--nf-ivory-card, #FFFDF8)" }}>
              <p className="m-0 mb-2 text-[10.5px] font-semibold uppercase" style={{ ...mono, letterSpacing: "0.11em", color: "var(--nf-ink-400, #7A7263)" }}>Matched and invited</p>
              {snapshot.matched_vendors ? (
                <p className="m-0 text-sm" style={{ color: "var(--nf-ink-800, #252019)" }}>
                  {snapshot.matched_vendors.length} matched at publication ({snapshot.matched_vendors.map((v) => v.name).join(", ") || "none"}); {(snapshot.invited_vendors ?? []).length} invited.
                </p>
              ) : (
                <p className="m-0 text-sm" style={{ color: "var(--nf-ink-800, #252019)" }}>
                  {snapshot.matched_vendor_ids.length} matched at publication; {snapshot.invited_vendor_ids.length} invited. (Names not frozen on this snapshot -- written before this field existed.)
                </p>
              )}
            </section>

            <section className="mb-4 rounded-[14px] border p-4" style={{ borderColor: "var(--nf-rule, #E4D9C2)", background: "var(--nf-ivory-card, #FFFDF8)" }}>
              <p className="m-0 mb-2 text-[10.5px] font-semibold uppercase" style={{ ...mono, letterSpacing: "0.11em", color: "var(--nf-ink-400, #7A7263)" }}>Market report (frozen)</p>
              <p className="m-0 text-sm" style={{ color: "var(--nf-ink-800, #252019)" }}>
                {snapshot.market_report.document.sections} sections, {snapshot.market_report.document.questions} questions.
                {snapshot.market_report.estimate && (
                  <> Indicative monthly band £{snapshot.market_report.estimate.monthly_band_gbp[0].toLocaleString("en-GB")}–£{snapshot.market_report.estimate.monthly_band_gbp[1].toLocaleString("en-GB")}.</>
                )}
              </p>
              {snapshot.market_report.gaps.length > 0 && (
                <p className="m-0 mt-2 text-xs" style={{ color: "var(--nf-ink-600, #4A4438)" }}>Gaps at publication: {snapshot.market_report.gaps.join("; ")}</p>
              )}
            </section>

            <section className="mb-2 rounded-[14px] border p-4" style={{ borderColor: "var(--nf-rule, #E4D9C2)", background: "var(--nf-ivory-raised, #F5F3EE)" }}>
              <p className="m-0 mb-2 text-[10.5px] font-semibold uppercase" style={{ ...mono, letterSpacing: "0.11em", color: "var(--nf-ink-400, #7A7263)" }}>Provenance</p>
              <p className="m-0 break-all text-xs" style={{ ...mono, color: "var(--nf-ink-300, #A79E8C)" }}>
                Content hash: {snapshot.content_hash}
              </p>
              <p className="m-0 mt-1 text-xs" style={{ color: "var(--nf-ink-300, #A79E8C)" }}>
                Methodology {snapshot.methodology_version}
                {snapshot.rulebook_version ? ` · Rulebook ${snapshot.rulebook_version}` : ""}
              </p>
              {snapshot.public_projection.url && (
                <p className="m-0 mt-2 text-xs">
                  <a href={snapshot.public_projection.url} className="underline" style={{ color: "var(--nf-orange-strong, #AA3E06)" }}>View the public board listing</a>
                </p>
              )}
            </section>

            <p className="mt-6 text-xs" style={{ color: "var(--nf-ink-300, #A79E8C)" }}>
              This room never shows a recomputed figure. If your requirement has changed since publication, the live draft is on{" "}
              <Link href={`/project/${id}${qs}`} className="underline" style={{ color: "var(--nf-orange-strong, #AA3E06)" }}>Overview</Link>; republishing will freeze a new version here, keeping this one in history.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
