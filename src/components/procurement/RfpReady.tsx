"use client";

/**
 * THE END OF THE CONVERSATION.
 *
 * Robert, 20 Aug 2026: "We have to remember, this cannot be an
 * everlasting AI conversation in the sense of Claude or ChatGPT, it has
 * to end with a built RFP."
 *
 * That is the deepest version of the "no end in sight" complaint, and
 * until this block the product had no terminal state at all in the chat
 * column. `rankNextQuestions()` is GENERATIVE — answering one can surface
 * another, by design, because there is always a further refinement a
 * sourcing document could carry. So "Answer next" would offer questions
 * forever, and nothing on the conversation side ever said "stop, you're
 * done, here is the thing you came to build."
 *
 * The gate this reads is the REAL one. `buildPublishChecklist().ready`
 * (publish-checklist.ts) is the same object `signLocked` is computed
 * from and the same five-to-six standing facts the server enforces —
 * not a cosmetic threshold, and emphatically not the open-decision count,
 * which gates nothing. When it flips, the conversation has finished its
 * job, and this block says so and hands over the two real actions.
 *
 * AN END STATE, NOT A LOCK. Robert, immediately after: "This isnt to say
 * a user cannot tweak and amend but there has to be an end state."
 * Nothing here freezes the document — every captured answer keeps its
 * Edit affordance, the optional decisions stay answerable below, and
 * after publication the same decisions are reframed as shaping the next
 * revision (DecisionsStep). What this block ends is the OBLIGATION to
 * keep answering, which is the thing that had no ending.
 *
 * Remaining decisions are not hidden when this appears — they are
 * demoted, with the truth stated plainly: they sharpen what suppliers
 * quote, and they do not hold publication up. That sentence is the
 * difference between an endless list and an optional one.
 *
 * THE HEADLINE TRACKS THE FRACTION. A live check on 20 Aug 2026 caught
 * this block announcing "Everything suppliers need is in the document"
 * over "2 of 8 sections ready" — two numbers telling different stories
 * on the same card, which is the exact defect this whole pass exists to
 * remove. The publish gate and the section fraction genuinely measure
 * different things (the gate is the five facts a notice cannot exist
 * without; the fraction is how complete the enquiry is), so the card
 * states both and never lets the prose outrun the count.
 *
 * Presentational only. Both handlers are ProjectDesk's own existing step
 * navigation; nothing here publishes anything.
 */

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

export default function RfpReady({
  sectionsReady,
  sectionsTotal,
  optionalRemaining,
  onReview,
  onPublish,
}: {
  /** The one denominator (procurement-outline.ts `outlineProgress`). */
  sectionsReady: number;
  sectionsTotal: number;
  /** Open decisions still outstanding — advisory, never blocking. */
  optionalRemaining: number;
  onReview: () => void;
  onPublish: () => void;
}) {
  /* The one place the two measures are reconciled: the publish gate has
     opened (this block only renders when it has), and `complete` says
     whether the enquiry is also as full as the outline can make it. */
  const complete = sectionsTotal > 0 && sectionsReady >= sectionsTotal;
  return (
    <div
      className="mx-0 mt-3.5 rounded-[4px] border px-3.5 py-3 lg:mx-6"
      style={{ borderColor: "var(--nf-emerald-soft-border, #91bb91)", background: "var(--nf-emerald-soft, #d9f4d9)" }}
    >
      <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-emerald, #1e4e22)", fontWeight: 700 }}>
        {complete ? "Your RFP is built" : "Your RFP can be published"}
      </div>
      <p className="m-0 mt-1.5 text-[13px] font-semibold leading-[1.4]" style={{ color: "var(--nf-ink-950, #110f0d)" }}>
        {complete
          ? "Every section is ready. This is a complete enquiry."
          : "The details a notice cannot exist without are all in. You can publish now, or fill more sections first."}
      </p>
      <p className="m-0 mt-1 text-[11.5px] leading-[1.45]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
        {`${sectionsReady} of ${sectionsTotal} sections ready. `}
        {optionalRemaining > 0
          ? `${optionalRemaining} optional decision${optionalRemaining === 1 ? "" : "s"} would sharpen the quotes you get back — none of them holds publishing up.`
          : "Nothing is outstanding."}
      </p>
      {/* Said out loud, because a green "built" banner otherwise reads as
          a lock: reaching the end state costs the buyer nothing. */}
      <p className="m-0 mt-1 text-[11.5px] leading-[1.45]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
        You can still change any answer &mdash; nothing is locked until you publish.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPublish}
          className="cursor-pointer rounded-[3px] border-0 px-3 py-1.5 text-[12px] font-semibold"
          style={{ background: "var(--nf-orange, #c66000)", color: "#fff" }}
        >
          Publish anonymously &rarr;
        </button>
        <button
          type="button"
          onClick={onReview}
          className="cursor-pointer rounded-[3px] border px-3 py-1.5 text-[12px] font-semibold"
          style={{ borderColor: "var(--nf-ink-200, #d3d0cd)", background: "#fff", color: "var(--nf-ink-950, #110f0d)" }}
        >
          Preview what suppliers receive
        </button>
      </div>
    </div>
  );
}
