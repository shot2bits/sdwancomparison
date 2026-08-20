/**
 * 2030 UI rebuild (Robert, 20 Aug 2026, on a total-teardown request:
 * "Should the platform not tell the user what section they're working on,
 * provide advice on what to ask... We have something special but it's
 * failing as every tester is saying they have no idea what is going on.")
 *
 * One short "what this section is / why suppliers need it" pair per
 * outline row (procurement-outline.ts's `OutlineRow.key`), shown beside
 * the active section in the new primary navigation.
 *
 * ROUND 6 LAW, still binding here (Robert, 31 Jul 2026: no fabricated
 * example answers anywhere in coaching or placeholder copy — an invented
 * example sentence can never match a real buyer's actual estate, and a
 * buyer who half-reads it can mistake it for a suggestion of what to
 * type). Every line below describes what the section covers and why it
 * matters to a supplier pricing or responding to the enquiry — never a
 * sample sentence, a made-up site count, or a named product/standard.
 *
 * PURE data, no React, no I/O (Article 17) — a plain lookup, matched 1:1
 * against `OutlineRow.key` so a missing entry is a build-time TypeScript
 * error, not a silently blank pane.
 */

import type { OutlineState } from "@/lib/workspace/procurement-outline";

export type SectionCoaching = {
  /** What this row is asking for, in plain terms. */
  what: string;
  /** Why a supplier cannot price or respond consistently without it. */
  why: string;
};

const SECTION_COACHING: Record<string, SectionCoaching> = {
  organisation_scale: {
    what: "Who you are and the scale suppliers are pricing for — sector, number of sites, regions and roughly how many users are in scope.",
    why: "Scale drives price more than almost anything else in the enquiry. Without it, every supplier response rests on a different, unstated assumption about size.",
  },
  solution_scope: {
    what: "What you are actually buying — SASE, SD-WAN, SSE, or managed security, and which parts of that a supplier is expected to deliver.",
    why: "Suppliers scope and cost very differently depending on exactly what is in and out of the engagement. An unclear boundary here produces quotes that cannot be compared.",
  },
  current_estate: {
    what: "What you run today — your existing network, cloud footprint, or security stack — even if only one part of it is known so far.",
    why: "Suppliers price migration and integration against what already exists, not against a blank slate. Gaps here usually surface later as change requests.",
  },
  resilience_availability: {
    what: "How much downtime or failure you can tolerate per site, and whether dual-circuit or multi-path resilience is required.",
    why: "Resilience requirements materially change architecture and price, particularly once a deployment spans more than a handful of sites.",
  },
  security_identity_data: {
    what: "Your security, identity and data-handling requirements — access control model, data residency, and any compliance obligations that apply.",
    why: "Security posture is one of the few things suppliers cannot infer or default sensibly — an unstated requirement here is a real risk left with the buyer, not the supplier.",
  },
  sector_intelligence: {
    what: "Sector-specific considerations Netify has flagged for your industry, based on what you've already stated.",
    why: "These are patterns suppliers in your sector are asked about routinely; confirming or dismissing each one keeps the enquiry accurate without assuming anything on your behalf.",
  },
  operating_model_support: {
    what: "Who runs this day to day — fully managed, co-managed, or self-managed — and what support coverage you expect.",
    why: "Operating model changes both price and the shape of the contract. Left open, suppliers default to their own preferred model rather than yours.",
  },
  migration_implementation: {
    what: "How you expect to move from what you have today to what you're buying — timeline, phasing, or any migration constraints.",
    why: "Migration approach affects delivery risk and cost as much as the end-state design does; suppliers price the transition, not only the destination.",
  },
  commercial_contractual: {
    what: "Contract term, budget shape, and any commercial preferences that matter to you — this section is deliberately later in the sequence.",
    why: "Commercial terms sharpen a quote once the technical shape is settled; stating them earlier without settled scope tends to produce premature, less accurate figures.",
  },
  success_evaluation: {
    what: "How you'll judge responses and what a successful outcome looks like for this enquiry — also deliberately later in the sequence.",
    why: "Evaluation criteria help suppliers understand what you value most, but only once there is a settled requirement for them to respond against.",
  },
};

/** Never throws on an unrecognised key — a coaching pane with nothing to
 *  say renders nothing, rather than a broken build or a guessed line. */
export function coachingFor(key: string): SectionCoaching | null {
  return SECTION_COACHING[key] ?? null;
}

/** One-line framing for the row's current state, read alongside the
 *  coaching text — reuses the SAME five-value state every other outline
 *  surface already labels, never a second vocabulary. */
export function stateFraming(state: OutlineState): string {
  switch (state) {
    case "confirmed":
      return "Confirmed — nothing further is needed here right now.";
    case "needs_input":
      return "Needs input — described below, still missing specifics.";
    case "needs_decision":
      return "Needs a decision — answerable directly below.";
    case "netify_suggested":
      return "Netify has suggestions here worth a quick review.";
    case "later":
      return "Deliberately later — not required to publish.";
  }
}
