/**
 * Does a stated company read as the buyer's own personal name?
 *
 * Robert's ruling (24 July 2026, evening, after the first mandatory-welcome
 * answer arrived as "Sam White" from Samuel White): refuse name matches.
 * A person's name alone is not a business. Someone who genuinely trades
 * under their own name states its registered form (Sam White Ltd), which
 * both passes this check and is the more accurate answer.
 *
 * The rule, kept deliberately explainable: normalise both strings
 * (lowercase, accents stripped, punctuation to spaces), then refuse only
 * when EVERY word of the stated company is part of the person's name.
 * "Sam" counts as part of "Samuel" (a prefix of three or more letters),
 * so diminutives do not slip through. Any word beyond the name lets the
 * answer stand: "Sam White Ltd" and "White Consulting" both pass, because
 * the extra word is exactly the businesslike part we asked for.
 *
 * Pure and dependency-free on purpose: the welcome step refuses in the
 * browser with the same words the profile API refuses with on the server,
 * one source of truth for both. Netify never looks anything up; this
 * checks only what the buyer typed against who they signed in as.
 */

export const COMPANY_NAME_REFUSAL =
  "That reads as a personal name rather than a business. Give the company you are buying for. If you trade under your own name, use its registered form, for example J Smith Consulting Ltd.";

/** Lowercase, strip accents, turn punctuation into spaces, split to words. */
function tokens(raw: string): string[] {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Equal, or one is a prefix of the other and the shorter has 3+ letters. */
function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short);
}

export function companyReadsAsPersonalName(company: string, personalName: string): boolean {
  const nameTokens = tokens(personalName);
  const companyTokens = tokens(company);
  if (nameTokens.length === 0 || companyTokens.length === 0) return false;
  return companyTokens.every((c) => nameTokens.some((n) => tokenMatches(c, n)));
}
