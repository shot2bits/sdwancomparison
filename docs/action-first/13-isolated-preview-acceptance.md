# Isolated hosted preview — acceptance record

30 September 2026. This supersedes the hosted-storage blocker in `12-code-review-fixes.md`.

## Result

The hosted confirmation → private project → RFP → connectivity → written proposals → amendment journey now passes against a separate hosted Redis database. No production project storage was reused. All preview email is captured privately; none is delivered externally.

Final code: `a9b1b58`, branch `codex/action-first-sourcing`.

Final preview: https://sasecomparison-bhnrpa52t-netifymarketplace.vercel.app/sase/shortlist/

Deployment: `dpl_2uMD556ySVmVfDnviK3VpCyQidBY`.

## Step 1 — independent persistence

Provisioned `netify-sourcing-isolated-preview` through Vercel Marketplace, Upstash Redis, London region. Resource `store_W3kMexDGjLT5ueiW`, connected only to `sasecomparison` Preview with `NETIFY_ISOLATED_` variable prefix. Eviction, production package and automatic plan upgrades are disabled. Marketplace's available metered plan is $0.20 per 100,000 commands; actual billing follows provider terms and usage.

Verified authenticated write/read, NX duplicate exclusion, key expiry and atomic Lua ownership/cleanup on disposable preview keys. The original production store and production environment bindings remain unchanged. `activityKvBinding` continues to reject shared production storage outside production.

## Step 2 — private capture and error handling

`NETIFY_PREVIEW_MAIL_CAPTURE=1` is enabled only for `codex/action-first-sourcing` Preview. Capture requires isolated storage and a valid Vercel deployment hostname. Production uses its normal sender. Other non-production environments fail closed.

Captures are stored under `preview:mail:capture_*`, expire after 24 hours, and contain delivery status `captured_not_sent`. Only the private datastore credentials can read the capture inbox; there is no public inbox endpoint. Idempotent sends do not create duplicate captures. Reusing a mail idempotency key with different contents fails. Links target the exact preview deployment. The buyer form explicitly states that no email was sent.

Operator export: `scripts/preview-mail-inbox.mjs /absolute/new-private-file.json` with `NETIFY_ISOLATED_KV_REST_API_URL` and `NETIFY_ISOLATED_KV_REST_API_TOKEN` provided securely in the environment. It creates a new owner-readable file and never prints credentials or message contents. Captures contain authentication links and must not be committed, attached to public reports or shared.

Bugs fixed during checks:

- Missing mail configuration could expose a raw sign-in link in an API response. Authentication now reports delivery unavailable and never returns that bypass.
- Redis HTTP-200 error bodies could be treated as successful commands. They now throw.
- The first capture implementation imported a Node-only dependency into an Edge route. Replaced it with Edge-compatible Web Crypto and fetch; builds pass.
- Preview success text incorrectly told testers to check their actual email. It now identifies private capture.

## Step 3 — hosted workflow

Synthetic inputs only. No live supplier commitments or real proposals are implied by the test prices.

- Public sourcing plan returns the authenticated Neon source and `provider-match-records/2.0.0` contract. Web and MCP prepare-plan results agree; the three sourcing tools remain available.
- Request reserves one confirmation record and captures one message. Exact retries return the same request; altered payloads and foreign origins are rejected.
- Viewing confirmation does not create a project. Explicit confirmation creates one private RFP and one desk item, with a scoped HttpOnly, Secure, SameSite cookie. Replaying confirmation preserves project credentials.
- Owner can read the RFP, export its private draft and access connectivity under the same project ID. Anonymous callers cannot.
- Staff sign-in uses the existing supplier/staff sign-in role and a normally generated magic link, retrieved from private capture. Consumed links cannot be replayed. Staff desk contains the confirmed request.
- Connectivity save and explicit review work without a public opportunity. Same-payload retry is idempotent; changed stale writes are rejected. A synthetic quote and its captured notification persist. Reopening archives the previous quote and clears current quotes/consent.
- Two synthetic written proposals on one scope can be recorded by staff. Buyer writes, stale scope hashes and unconfirmed proposal submissions are rejected. Proposal retries and an interrupted receipt recover without duplicating reviews.
- Recorded supplier approach requires an earlier acknowledged introduction. Comparable-set recording requires two priced proposals on the same basis.
- Changing the buyer scope from 10 to 11 sites moves both proposals out of the current comparison. Previous evidence remains accessible; stale proposals and a new comparable-set claim are rejected.
- Expired owner access and expired confirmation links fail. A project cookie cannot open a different project.
- The browser successfully submits the shortlist form, opens captured confirmation, confirms and follows the link into the private RFP. The RFP agent saves generated questions into that same private project without publication or supplier invitations.

## Step 4 — private editor correction and final regression

The browser walkthrough revealed that the reused RFP editor still displayed the old public-publication journey. Added a private-sourcing mode retaining the editor while removing its public publish panels, publication auto-action entry points, response-link controls and duplicate public-market comparison. Private-project tabs now provide the connectivity and proposal journey. Existing standalone public RFP mode remains the default.

Passed action-first regression tests, added preview-mail failure/security tests, focused ESLint, full repository validation and Next production build. Vercel ran `npm run test:action-first && npm run build` for the final deployment. Hosted final-deployment checks confirm preserved projects, earlier-scope proposals, archived connectivity, access controls, new captured confirmation and live Neon/MCP matching.

Production remains `dpl_BuZb88RvYfcxs6CPxdS9XZZyTV6D`, branch `codex/publication-first-comparison`, commit `e850476b92d0a192117be5d139d87f4eb811733c`.

This closes the isolated-storage and captured-mail testing blocker. It does not establish commercial supplier commitments, Harry's approval, a clean search baseline, or AI recommendation/click uplift. Those remain separate release and measurement decisions.

Final browser pass on the deployed code confirmed the private editor, saved agent draft and both project tabs. The old publish-to-unlock prompts and credential-copy text are absent. Preview confirmation explicitly says no email was sent. Browser console returned no errors or warnings. Screenshot saved in the task output directory as `isolated-preview-private-project.png`.
