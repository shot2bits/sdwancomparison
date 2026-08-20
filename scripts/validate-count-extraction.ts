// Verification-only script (not part of the app).
//
// Robert, 20 Aug 2026, from a live session: "We need SD-WAN and SASE for
// 30 UK manufacturing sites, 4000 users, going live within 6 months"
// landed `estate.users` and NOT `estate.sites`. The outline then
// correctly reported "Still needed: site count" and the buyer -- who had
// plainly said thirty -- was asked for it again. That is the worst thing
// an extraction layer can do: it makes the whole document look like it is
// not listening.
//
// CAUSE: the count-to-noun gap was `(?:\w+\s+)?` -- exactly ONE optional
// describing word, sized for "50 remote users". "UK manufacturing" is two.
//
// The widening (to three) is only safe with a guard, because a longer
// reach can jump a clause. This fixture is that guard's proof. It runs the
// REAL `deterministicExtract` against whole sentences, and asserts BOTH
// directions: the counts that must now land, and -- more importantly --
// the ones that must still not.

import { deterministicExtract } from "../src/lib/workspace/extract";

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

/** What the real extractor landed for the two count paths. */
function counts(text: string): { sites?: number; users?: number } {
  const out: { sites?: number; users?: number } = {};
  for (const u of deterministicExtract(text)) {
    if (u.path === "estate.sites") out.sites = u.value as number;
    if (u.path === "estate.users") out.users = u.value as number;
  }
  return out;
}

type Case = { text: string; sites?: number; users?: number; why: string };

/* Every expectation below is the reading a human gives the sentence. */
const CASES: Case[] = [
  // --- THE REPORTED DEFECT ---
  {
    text: "We need SD-WAN and SASE for 30 UK manufacturing sites, 4000 users, going live within 6 months",
    sites: 30,
    users: 4000,
    why: "the reported sentence: two qualifiers between the count and its noun",
  },
  { text: "120 UK retail branches", sites: 120, why: "two qualifiers" },
  { text: "220 small regional branch offices in the UK", sites: 220, why: "three qualifiers" },

  // --- STILL WORKS (the one-qualifier and bare forms that always did) ---
  { text: "50 remote users", users: 50, why: "one qualifier, the original sizing" },
  { text: "38 stores", sites: 38, why: "bare noun" },
  { text: "12 sites", sites: 12, why: "bare noun" },
  { text: "60 clinics", sites: 60, why: "the 31 Jul clinics addition" },
  { text: "3,500 hybrid staff", users: 3500, why: "thousands separator" },
  { text: "200 thousand users", users: 200000, why: "magnitude word" },

  // --- MUST NOT LAND: the false positives a wider gap invites ---
  {
    text: "We have 4000 users at sites across Europe",
    users: 4000,
    why: "the number belongs to the FIRST noun; 4000 is a user count, never a site count",
  },
  {
    text: "Going live within 6 months across all sites",
    why: "\"6 months\" is a timeline; a time noun in the gap must break the match",
  },
  {
    text: "We need this in 9 months at our offices",
    why: "same, with a different site noun",
  },
  {
    text: "4000 users and 30 sites",
    users: 4000,
    sites: 30,
    why: "a conjunction starts a new clause -- each count binds to its own noun",
  },
  {
    text: "30 sites and 4000 users",
    users: 4000,
    sites: 30,
    why: "and in the other order",
  },

  // --- PRE-EXISTING GUARDS THAT MUST SURVIVE THE WIDENING ---
  { text: "-5 sites", why: "negative counts are omitted, never mangled (correction pass 2)" },
  { text: "12.5 sites", why: "decimal counts are omitted, never rounded" },
  { text: "We are not adding 40 sites", why: "the negation window still suppresses the match" },
];

function main() {
  for (const c of CASES) {
    const got = counts(c.text);
    const want = { sites: c.sites, users: c.users };
    const ok = got.sites === want.sites && got.users === want.users;
    record(ok, `${c.why}`, `"${c.text}" -> ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
  }

  /* The gap is bounded. Four qualifiers is past the point where the words
     are still describing the same noun phrase, and an unbounded run would
     match across most of a sentence. */
  const tooFar = counts("40 very large newly acquired regional distribution sites");
  record(tooFar.sites === undefined, "the gap is bounded at three qualifiers -- it is not an unbounded reach", JSON.stringify(tooFar));

  console.log(failures === 0 ? "\nALL PASS" : `\nFAILs: ${failures}`);
  if (failures) process.exit(1);
}

main();
