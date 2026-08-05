/**
 * Focused validation for withManageToken (src/lib/manage-redirect.ts),
 * added alongside the manage-token continuity follow-up (5 Aug 2026): the
 * function that seeds the buyer's private manage key onto the very first
 * redirect after an anonymous project is created (Quick Understanding's
 * bridge, DescribeWizard's generate step), so ProjectNav's tab links and
 * every server-rendered Project page -- which read `?manage=` from their
 * own request's searchParams only, with no localStorage fallback -- work
 * correctly the moment the buyer lands.
 *
 * Standalone script (not wired into `npm run validate`'s chain): run via
 * `npx tsx scripts/validate-manage-redirect.ts`.
 */

import { withManageToken } from "../src/lib/manage-redirect";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/** Counts `manage=` occurrences the way a server actually parses a query
 *  string (per `&`-separated pair, keyed on the decoded name) rather than
 *  a naive substring count, so this can't be fooled by a token value that
 *  happens to contain the literal text "manage=". */
function countManageParams(url: string): number {
  const q = url.split("#")[0].split("?")[1] ?? "";
  if (!q) return 0;
  return q.split("&").filter((pair) => {
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    try {
      return decodeURIComponent(rawKey) === "manage";
    } catch {
      return rawKey === "manage";
    }
  }).length;
}

/* 1. Plain path, no existing query string. */
expect(
  withManageToken("/sase/rfp-builder/rfp_abc/", "mtok_123") === "/sase/rfp-builder/rfp_abc/?manage=mtok_123",
  "plain path gets a leading ?manage=",
);

/* 2. Path with an existing query parameter: appended with &, original
      parameter untouched. */
expect(
  withManageToken("/sase/rfp-builder/rfp_abc/?welcome=generated", "mtok_123")
    === "/sase/rfp-builder/rfp_abc/?welcome=generated&manage=mtok_123",
  "existing query parameter is preserved and manage= is appended with &",
);

/* 3. Hash fragment: manage= lands before the fragment, fragment survives
      untouched at the end. */
expect(
  withManageToken("/sase/rfp-builder/rfp_abc/#section", "mtok_123") === "/sase/rfp-builder/rfp_abc/?manage=mtok_123#section",
  "hash fragment is preserved after an inserted ?manage=",
);
expect(
  withManageToken("/sase/rfp-builder/rfp_abc/?welcome=generated#section", "mtok_123")
    === "/sase/rfp-builder/rfp_abc/?welcome=generated&manage=mtok_123#section",
  "hash fragment is preserved after an appended &manage= on top of an existing query",
);

/* 4. Token requiring URL encoding: space and slash both escaped. */
expect(
  withManageToken("/sase/rfp-builder/rfp_abc/", "tok with space/slash")
    === "/sase/rfp-builder/rfp_abc/?manage=tok%20with%20space%2Fslash",
  "a token containing space/slash is percent-encoded",
);

/* 5. null / undefined / empty token: path returned completely unchanged --
      never an empty `?manage=` or `&manage=` left dangling in the URL. */
expect(withManageToken("/sase/rfp-builder/rfp_abc/", null) === "/sase/rfp-builder/rfp_abc/", "null token: path unchanged");
expect(withManageToken("/sase/rfp-builder/rfp_abc/", undefined) === "/sase/rfp-builder/rfp_abc/", "undefined token: path unchanged");
expect(withManageToken("/sase/rfp-builder/rfp_abc/", "") === "/sase/rfp-builder/rfp_abc/", "empty-string token: path unchanged");
expect(
  withManageToken("/sase/rfp-builder/rfp_abc/?welcome=generated", "") === "/sase/rfp-builder/rfp_abc/?welcome=generated",
  "empty-string token with an existing query: query left exactly as-is, no trailing &manage=",
);

/* 6. Safe by construction: an existing manage= parameter is REPLACED, not
      duplicated -- this must hold regardless of what the caller passes in,
      not just for the two current call sites' bare-path usage. */

// 6a. A single existing manage= is replaced with the new value; exactly
//     one manage= survives.
const replaced = withManageToken("/sase/rfp-builder/rfp_abc/?manage=old_tok", "new_tok");
expect(replaced === "/sase/rfp-builder/rfp_abc/?manage=new_tok", "existing manage= value is replaced with the new token");
expect(countManageParams(replaced) === 1, "exactly one manage= parameter survives a replace");

// 6b. Other query parameters, both before and after the existing manage=,
//     are preserved exactly; only the manage value changes.
const replacedAmongOthers = withManageToken("/sase/rfp-builder/rfp_abc/?a=1&manage=old_tok&welcome=generated", "new_tok");
expect(countManageParams(replacedAmongOthers) === 1, "exactly one manage= parameter survives a replace among other params");
expect(replacedAmongOthers.includes("a=1"), "a param before the existing manage= is preserved");
expect(replacedAmongOthers.includes("welcome=generated"), "a param after the existing manage= is preserved");
expect(replacedAmongOthers.includes("manage=new_tok"), "the replaced value is the new token");
expect(!replacedAmongOthers.includes("old_tok"), "the old token value does not survive anywhere in the URL");

// 6c. A hash fragment survives a replace exactly as it would survive a
//     fresh append.
const replacedWithHash = withManageToken("/sase/rfp-builder/rfp_abc/?manage=old_tok#section", "new_tok");
expect(replacedWithHash === "/sase/rfp-builder/rfp_abc/?manage=new_tok#section", "hash fragment preserved across a replace");
expect(countManageParams(replacedWithHash) === 1, "exactly one manage= parameter survives a replace with a hash fragment present");

// 6d. Calling withManageToken twice in a row -- the exact scenario a
//     shared helper must not trust callers to avoid -- still ends with
//     exactly one manage= parameter, holding the second call's value.
const calledOnce = withManageToken("/sase/rfp-builder/rfp_abc/", "first_tok");
const calledTwice = withManageToken(calledOnce, "second_tok");
expect(countManageParams(calledTwice) === 1, "calling withManageToken twice in a row still yields exactly one manage= parameter");
expect(calledTwice === "/sase/rfp-builder/rfp_abc/?manage=second_tok", "the second call's token value is the one that survives");

// 6e. A malformed/duplicated input (two manage= pairs already present,
//     e.g. from an untrusted or hand-built URL) collapses to exactly one
//     on the next call, rather than compounding to three.
const doublyMalformed = withManageToken("/sase/rfp-builder/rfp_abc/?manage=a&manage=b", "c");
expect(doublyMalformed === "/sase/rfp-builder/rfp_abc/?manage=c", "two pre-existing manage= pairs collapse to exactly one");
expect(countManageParams(doublyMalformed) === 1, "exactly one manage= parameter survives a doubly-malformed input");

console.log(`manage-redirect: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
