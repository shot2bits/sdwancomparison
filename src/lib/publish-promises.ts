/**
 * The four promises (Robert's Ruling Three, 29 Jul 2026): the platform
 * tells the buyer what happens to their information at the moment it
 * matters, not in a policy link. Stated at three moments: before they
 * begin (the notice wizard door), beside the publish control, and in the
 * confirmation email. One truth here so the three moments and the email
 * can never drift.
 *
 * WORDING: Robert's provisional paragraph, verbatim from the ruling.
 * PROVISIONAL pending Harry's copy pass (the four promises, pass two of
 * five). The vetting sentences ship because Robert approved the supplier
 * vetting standard on 29 Jul 2026; the standard page below is the citable
 * artefact behind them.
 */

export const VETTING_STANDARD_PATH = "/supplier-vetting-standard";

/** The ruled paragraph, one voice, used where prose fits (the email, compact strips). */
export const PROMISES_PARAGRAPH =
  "Your project publishes anonymously. Nobody browsing Netify, and no search engine, sees your company name or your contact details. Only vendors and service providers we have vetted can respond, and your details are never shared with anyone we have not vetted. You choose which suppliers receive your contact details, and when.";

/** The same four promises as discrete statements, for structured rendering. */
export const PROMISES: ReadonlyArray<{ key: string; short: string; full: string }> = [
  {
    key: "anonymous",
    short: "Published anonymously",
    full: "Your project publishes anonymously. Nobody browsing Netify, and no search engine, sees your company name or your contact details.",
  },
  {
    key: "vetted_only",
    short: "Only vetted suppliers respond",
    full: "Only vendors and service providers we have vetted can respond.",
  },
  {
    key: "never_shared",
    short: "Never shared unvetted",
    full: "Your details are never shared with any vendor or provider that has not been vetted on this platform.",
  },
  {
    key: "buyer_chooses",
    short: "You choose who gets your contact details",
    full: "You choose which suppliers receive your contact details, and when.",
  },
];
