"use client";

/**
 * MyProcurements (Robert's R9 ruling on Harry's Section 1 test, 28 Jul
 * 2026: "why are your opportunities and your projects in different
 * sections, it makes it very messy"). One procurement is one thing, so
 * the account page shows it once: each row carries every door it has
 * earned (Open project, Preview, Public notice, Manage room), and a
 * notice posted directly to a room without a project gets its own row in
 * the same list. Replaces MyOpportunities + MyRfps on the account hub;
 * their behaviours ride along unchanged: anonymous drafts are claimed
 * before listing, manage tokens re-seed so rooms open with buyer
 * controls on this device, and the sidebar badge event still fires.
 * Renders nothing when signed out; a fresh signed-in account gets the
 * launchpad, not an empty room.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type Health = { tone: string; label: string; detail: string };
type Rfp = { id: string; title: string; status: string; updated: number; phase?: string; responses?: number; health?: Health };
type MineOpp = {
  id: string; title: string; status: string; visibility: string; response_mode: string;
  created: number; updated: number; bid_count: number; comment_count: number;
  buyer_token: string; source_rfp_id?: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "In review",
  published: "Published",
  qa: "Vendor Q&A",
  evaluation: "Evaluation",
};

const GROUPS: Array<{ key: string; label: string; phases: string[] }> = [
  { key: "drafting", label: "Drafting", phases: ["scoping", "scoped", "drafting", "drafted"] },
  { key: "published", label: "Published", phases: ["published", "qa"] },
  { key: "evaluating", label: "Evaluating", phases: ["evaluation"] },
  { key: "awarded", label: "Awarded and beyond", phases: ["awarded", "transacting", "complete"] },
  { key: "closed", label: "Closed", phases: ["closed"] },
];

const STATUS_TO_PHASE: Record<string, string> = {
  draft: "drafting", review: "drafted", published: "published", qa: "qa", evaluation: "evaluation",
};

/** A room-only notice maps onto the same stage groups by its status. */
const OPP_STATUS_TO_PHASE: Record<string, string> = {
  open: "published", awarded: "awarded", closed: "closed",
};

const DOT: Record<string, string> = {
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500",
  yellow: "bg-yellow-400", blue: "bg-sky-500", purple: "bg-purple-500",
  neutral: "bg-[var(--ink-400,#9ca3af)]",
};

/** Draft manage tokens the builder saved in this browser (netify_mtok_{id}). */
function localDrafts(): { id: string; manage_token: string }[] {
  const out: { id: string; manage_token: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? "";
      if (!k.startsWith("netify_mtok_")) continue;
      const id = k.slice("netify_mtok_".length);
      const manage_token = localStorage.getItem(k) ?? "";
      if (id && manage_token) out.push({ id, manage_token });
    }
  } catch { /* private mode */ }
  return out.slice(0, 25);
}

type Row = {
  key: string;
  phase: string;
  title: string;
  updated: number;
  health?: Health;
  statusLine: string;
  projectId?: string;
  oppId?: string;
  noticeEnded?: boolean;
  responses?: number;
  bids?: number;
  comments?: number;
};

export default function MyProcurements() {
  const [rfps, setRfps] = useState<Rfp[] | null>(null);
  const [opps, setOpps] = useState<MineOpp[] | null>(null);

  useEffect(() => {
    let active = true;
    const loadRfps = () =>
      fetch("/sase/api/rfp/mine")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!active || !d?.rfps) return;
          setRfps(d.rfps as Rfp[]);
          try { window.dispatchEvent(new Event("netify:rfps-changed")); } catch { /* ignore */ }
        })
        .catch(() => {});
    const loadOpps = () =>
      fetch("/sase/api/opportunity/mine")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!active) return;
          if (!d?.opportunities) { setOpps([]); return; }
          const list = d.opportunities as MineOpp[];
          for (const o of list) {
            try { localStorage.setItem(`opp_btok_${o.id}`, o.buyer_token); } catch { /* ignore */ }
          }
          setOpps(list);
        })
        .catch(() => { if (active) setOpps([]); });

    const loadPrivateRecords = async () => {
      const session = await fetch("/sase/api/auth/session", { cache: "no-store" })
        .then((response) => response.ok ? response.json() as Promise<{ authenticated?: boolean }> : { authenticated: false })
        .catch(() => ({ authenticated: false }));
      if (!active) return;
      if (!session.authenticated) {
        setRfps([]);
        setOpps([]);
        return;
      }

      const drafts = localDrafts();
      if (drafts.length > 0) {
        await fetch("/sase/api/rfp/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ drafts }) }).catch(() => {});
        if (!active) return;
      }
      await Promise.all([loadRfps(), loadOpps()]);
    };

    void loadPrivateRecords();
    return () => { active = false; };
  }, []);

  // Signed out (or still loading the projects list): render nothing.
  if (!rfps) return null;

  // Signed in with an empty account: the launchpad, not an empty room
  // (r.wade@dadesigngroup.com, 18 July 2026, signed in and left a blank page).
  if (rfps.length === 0 && (opps?.length ?? 0) === 0) {
    return (
      <div className="mb-10 rounded-sm border border-amber-300 bg-amber-50 p-5">
        <h2 className="text-xl mb-1">Your account is ready. Here is what it does.</h2>
        <p className="text-sm text-[var(--ink-700)] mb-3 max-w-2xl">
          Describe your project once and Netify builds it into a living Statement of Requirements you can
          raise to an RFI or a full RFP. Publishing is free and pays out instantly: an indicative market price
          band for your estate, your document as Word and PDF, and structured responses from your matched
          vendors, side by side, with pricing private to you. You stay anonymous until you reply, and only
          vetted vendors and service providers can respond.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {/* The One Door (Harry, 24 July 2026): the desk at the apex is the
              only buyer entrance. */}
          <a href="https://netify.co.uk/" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline hover:bg-amber-400 transition-colors">
            Describe your first project
          </a>
          <Link href="/shortlist" className="text-sm underline text-[var(--ink-700)]">
            Not ready? Compare the market first
          </Link>
        </div>
        <p className="mt-2 text-xs text-[var(--ink-600,#555)]">No obligation to award and no sales calls until you reply.</p>
      </div>
    );
  }

  const oppByRfp = new Map<string, MineOpp>();
  const roomOnly: MineOpp[] = [];
  for (const o of opps ?? []) {
    if (o.source_rfp_id) oppByRfp.set(o.source_rfp_id, o);
    else roomOnly.push(o);
  }

  const rows: Row[] = [];
  for (const r of rfps) {
    const o = oppByRfp.get(r.id);
    const basePhase = r.phase ?? STATUS_TO_PHASE[r.status] ?? "drafting";
    // The route back to a closed notice (Harry's retest finding, 29 Jul
    // 2026: he closed a notice and could not find it again). A joined
    // procurement's stage followed the PROJECT, so closing the notice
    // left the row sitting in Published saying nothing about the close.
    // When the notice has closed or been awarded and the project has no
    // later life of its own, the procurement's stage IS that outcome: the
    // row moves to the Closed or Awarded group, says what happened, and
    // keeps every door, including the still-published notice page.
    const noticeEnded = o && (o.status === "closed" || o.status === "awarded");
    const phase = noticeEnded && ["published", "qa"].includes(basePhase)
      ? (o.status === "awarded" ? "awarded" : "closed")
      : basePhase;
    const baseLine = r.health?.label ?? STATUS_LABELS[r.status] ?? r.status;
    rows.push({
      key: `rfp:${r.id}`,
      phase,
      title: r.title,
      updated: Math.max(r.updated, o?.updated ?? 0),
      health: r.health,
      statusLine: noticeEnded ? `${baseLine} · notice ${o.status}` : baseLine,
      projectId: r.id,
      oppId: o?.id,
      noticeEnded: Boolean(noticeEnded),
      responses: r.responses,
      bids: o?.bid_count,
      comments: o?.comment_count,
    });
  }
  for (const o of roomOnly) {
    rows.push({
      key: `opp:${o.id}`,
      phase: OPP_STATUS_TO_PHASE[o.status] ?? "published",
      title: o.title,
      updated: o.updated,
      statusLine: `${o.status === "open" ? "Open" : o.status === "awarded" ? "Awarded" : "Closed"} notice${o.visibility === "unlisted" ? " · Unlisted" : ""}`,
      oppId: o.id,
      noticeEnded: o.status === "closed" || o.status === "awarded",
      bids: o.bid_count,
      comments: o.comment_count,
    });
  }
  rows.sort((a, b) => b.updated - a.updated);

  const grouped = GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => g.phases.includes(r.phase)) })).filter((g) => g.rows.length > 0);

  return (
    <div className="mb-10">
      <h2 className="text-xl mb-1">Your procurements</h2>
      <p className="text-sm text-[var(--ink-600)] mb-4">
        One row per procurement, grouped by stage, carrying every door it has: the project record, the public
        notice and the manage room. Manage responses, invite vendors or close a notice from its room.
      </p>
      <div className="space-y-6">
        {grouped.map((g) => (
          <section key={g.key}>
            <p className="eyebrow mb-2">{g.label} · {g.rows.length}</p>
            <div className="space-y-2">
              {g.rows.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[var(--ink-200,#e5e5e5)] px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-500)]">
                      {r.health && <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${DOT[r.health.tone] ?? DOT.neutral}`} />}
                      <span>{r.statusLine}</span>
                      <span>· updated {new Date(r.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      {typeof r.responses === "number" && r.responses > 0 && <span>· {r.responses} response{r.responses === 1 ? "" : "s"}</span>}
                      {typeof r.bids === "number" && r.oppId && <span>· {r.bids} {r.bids === 1 ? "bid" : "bids"}, {r.comments ?? 0} {r.comments === 1 ? "comment" : "comments"}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.oppId && (
                      <Link href={`/opportunities/${r.oppId}`} className="rounded-full border border-[var(--ink-300,#ccc)] px-3 py-1 text-xs no-underline text-[var(--ink-800)] hover:border-[var(--ink-900)]">{r.noticeEnded ? "View closed notice" : "Public notice"}</Link>
                    )}
                    {r.oppId && (
                      <Link href={`/opportunities/${r.oppId}/room`} className={`rounded-full px-3 py-1 text-xs no-underline ${r.projectId ? "border border-[var(--ink-300,#ccc)] text-[var(--ink-800)] hover:border-[var(--ink-900)]" : "bg-amber-500 font-medium text-zinc-950 hover:bg-amber-400"}`}>Manage room</Link>
                    )}
                    {r.projectId && (
                      <Link href={`/rfp-builder/${r.projectId}/preview`} className="rounded-full border border-[var(--ink-300,#ccc)] px-3 py-1 text-xs no-underline text-[var(--ink-800)] hover:border-[var(--ink-900)]">Preview</Link>
                    )}
                    {r.projectId && (
                      <Link href={`/project/${r.projectId}`} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950 no-underline hover:bg-amber-400">Open project</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
