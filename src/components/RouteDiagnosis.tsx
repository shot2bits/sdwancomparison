"use client";

/**
 * RouteDiagnosis: three quick questions that route a buyer to the right path —
 * post a project notice, build a full RFP, or start with a shortlist. Pure
 * client logic, no AI call: the routing rules are simple enough that a model
 * adds latency without adding judgement. Guardrail from the rebuild spec:
 * never force a full RFP when a notice is enough.
 */

import { useState } from "react";
import { track } from "@/lib/analytics";

type Answer = { formality: string; knowledge: string; urgency: string };

const QUESTIONS = [
  {
    key: "formality" as const,
    q: "How formal does your process need to be?",
    options: [
      { key: "informal", label: "Light-touch — we want market signals, pricing or conversations" },
      { key: "formal", label: "Formal — structured questions, evidence and scored comparison" },
      { key: "unsure", label: "Not sure yet" },
    ],
  },
  {
    key: "knowledge" as const,
    q: "How well defined is your requirement?",
    options: [
      { key: "vague", label: "Rough idea — we know the problem, not the solution" },
      { key: "partial", label: "Partly defined — scope is clear, details are not" },
      { key: "defined", label: "Well defined — we could brief suppliers today" },
    ],
  },
  {
    key: "urgency" as const,
    q: "What do you need first?",
    options: [
      { key: "pricing", label: "Indicative pricing or budget validation" },
      { key: "shortlist", label: "A shortlist of credible suppliers" },
      { key: "responses", label: "Full supplier proposals we can score" },
    ],
  },
];

function recommend(a: Answer): { path: string; href: string; cta: string; why: string; secondary?: { label: string; href: string } } {
  // Unsure across the board: don't push a form at someone who can't fill it
  // in yet. Route to a human conversation, with background reading as the
  // soft option (Harry's evaluation, 03/07/2026).
  if (a.formality === "unsure" && a.knowledge === "vague") {
    return {
      path: "Talk it through with Netify",
      href: "mailto:support@netify.com?subject=Help%20scoping%20a%20SASE%20%2F%20SD-WAN%20project",
      cta: "Email the Netify team",
      why: "Your requirement and your process are both still taking shape, so a short conversation beats any form: the Netify team will help you frame the problem, then point you at a project notice, a shortlist or a full RFP. If you'd rather read up first, the Insights blog covers SASE and SD-WAN buying end to end.",
      secondary: { label: "Browse the Insights blog", href: "https://netify.co.uk/insights/" },
    };
  }
  if (a.formality === "formal" || a.urgency === "responses") {
    return {
      path: "Build a full RFP",
      href: "/sase/rfp-builder/",
      cta: "Open the RFP Builder",
      why: "You want structured, comparable supplier proposals — that needs methodology-backed questions, evidence requests and a scoring matrix. You can still post a notice first to warm up the market.",
    };
  }
  if (a.urgency === "shortlist" && a.knowledge !== "vague") {
    return {
      path: "Start with a shortlist",
      href: "/sase/shortlist/",
      cta: "Build a shortlist",
      why: "Your requirement is defined enough to grade vendors against it. Build a shortlist from Netify's evidence-graded dataset, then post a project or RFP to engage them.",
    };
  }
  return {
    path: "Post a project notice",
    href: "/sase/opportunities/new/",
    cta: "Post a project",
    why: "A short public notice gets you pricing, interest and discovery calls without writing a full RFP. If the responses justify it, you can turn the notice into a full RFP later — nothing is wasted.",
  };
}

export default function RouteDiagnosis() {
  const [answers, setAnswers] = useState<Partial<Answer>>({});
  const done = QUESTIONS.every((q) => answers[q.key]);
  const rec = done ? recommend(answers as Answer) : null;

  return (
    <div className="max-w-2xl space-y-8">
      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <p className="text-sm font-medium mb-2">{q.q}</p>
          <div className="space-y-2">
            {q.options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  const next = { ...answers, [q.key]: o.key };
                  setAnswers(next);
                  if (QUESTIONS.every((qq) => next[qq.key])) {
                    track("path_selected", { path: recommend(next as Answer).path, source: "route_diagnosis" });
                  }
                }}
                className={`block w-full text-left p-3 rounded-sm border text-sm transition-colors ${answers[q.key] === o.key ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {rec && (
        <div className="rounded-sm border border-emerald-300 bg-emerald-50 p-5">
          <p className="eyebrow mb-1">Recommended route</p>
          <p className="text-lg font-semibold mb-1">{rec.path}</p>
          <p className="text-sm text-[var(--ink-700)] mb-4">{rec.why}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={rec.href} className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">{rec.cta}</a>
            {rec.secondary && (
              <a href={rec.secondary.href} className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2.5 text-sm no-underline text-[var(--ink-800)] transition-colors hover:bg-[var(--ink-100,#f5f5f5)]">{rec.secondary.label}</a>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--ink-500)]">
            All routes stay open: <a href="/sase/opportunities/new/" className="underline">post a project</a> ·{" "}
            <a href="/sase/rfp-builder/" className="underline">build an RFP</a> ·{" "}
            <a href="/sase/shortlist/" className="underline">build a shortlist</a> ·{" "}
            <a href="/sase/opportunities/board/" className="underline">browse the board</a>
          </p>
        </div>
      )}
    </div>
  );
}
