# Answer-first shortlist: local acceptance and handoff

Branch: `codex/answer-first-shortlist`. Base: main `feb06f61dad9d56b2ea28ac163eabc81ccee1d1d`, a descendant of `e8cdcbd`, including the merged corrective release.

Actual checkout: `/Users/robertsturt/Documents/ChatGPT/The Marketplace chess move/.release/sourcing-release-reconcile-20260930`.

Status: implementation steps 1–6 completed locally; step 8 preservation checks passed. No push, hosted deployment, production data mutation, supplier email or buyer email. The original checkout and its untracked duplicate documents were not changed. Local preview: http://localhost:3127/sase/shortlist/ . This preview uses the disclosed reviewed snapshot, not a newly verified authenticated Neon connection.

## Step-by-step commands and results

1. Entity block and metadata: `npm run test:answer-first` and `npx tsc --noEmit`, exit 0. Counts derive from the current dataset; empty owner/editorial fields render no placeholder.
2. Best-for cards, matrix, feed and MCP: `npm run test:answer-first`, exit 0. Every provider has data-derived labels; partial evidence and sign-off remain explicit.
3. Complete head-term FAQ and unchanged service FAQ relocation: `npm run test:answer-first`, exit 0. Fifteen questions, including all ten sectors, with complete yes/partial lists and zero counts.
4. Entity graph: `python3 scripts/verify-answer-first-html.py http://localhost:3127/sase --all-pages`, exit 0. Thirty Organisations, complete ItemList in card order, exact visible FAQ parity, Dataset, Service, WebPage and BreadcrumbList; no Person while the reviewer is blank.
5. Sibling and provider entrances: `npx tsx scripts/verify-answer-first-pages.ts`, exit 0. Thirty provider profiles and twenty sector pages returned HTTP 200, complete rows and three actions each; the three shortlist views also passed. `git diff --exit-code origin/main -- src/lib/best-pages.ts 'src/app/(marketing)/shortlist/[view]/page.tsx'`, exit 0, no output: existing title definitions preserved.
6. Machine layer: `npm run test:answer-first`, exit 0. Feed, llms, full text and MCP response share labels and counts; all feed views have best-for/UK evidence fields. Latest overall feed review date follows the actual field-review dates.
7. Wider UK directory: NOT RUN. The specification explicitly says only after steps 1–6 are live, in a separate PR. Its prerequisite conflicts with deploying nothing in this branch, so no unresearched firms or invented legal/entity records have been added.
8. Preserve buyer journey: `git diff --exit-code origin/main -- src/app/api/auth src/app/api/sourcing/confirm src/lib/sourcing-store.ts src/lib/sourcing-notifications.ts src/lib/shortlist-core.ts`, exit 0, no output. Existing consent, request keys, routes, cookies, matching rules and supplier disclosure boundaries retained. `npm run test:action-first`, exit 0.

## Acceptance outputs 1–7

### 1. Existing journey suite plus new entity/evidence checks

Command: `npm run test:action-first`; exit 0. Actual PASS output follows; full output (terminal whitespace normalised only), including the expected local snapshot-fallback diagnostics, is in `logs/action-first.txt`.

```text
PASS answer-first: 30 complete provider rows, best-for labels, 15 complete FAQs, schema parity, blank reviewer, expiry-safe UK sources, feed/llms parity, 4 views, no legacy status or em dash
PASS corrective acceptance: referral mapping, evidence expiry/source changes, 23 owner review warnings, actual TTL expiry, deduplicated weekly metrics, staff-only access and plan throttling
PASS sign-off: 19 provider records, 36 positive rows (27 yes/9 partial), 5 unconfirmed rows preserved; all values unchanged; pending and signed labels verified; Colt slug mapped
PASS UK-only filter: bt-business, colt-technology-services, virgin-media-o2, vodafone-business; four sourced reviews; other UK grades remain not_confirmed; capability/sector grades unchanged
PASS empty panel: 30 Research only cards, 0 Response panel badges
PASS synthetic panel: one badge, named-contact routing, private acknowledgement evidence excluded
PASS panel administration: staff only, origin checks, all fields required, future dates and unknown providers rejected
PASS sourcing target unset: page step 3, Service JSON-LD, llms and MCP agree
PASS sourcing target set: page step 3, Service JSON-LD, llms and MCP agree
PASS partial or invalid targets stay unpromised; buyer acknowledgement uses the same contract
PASS shared-project connectivity: scoped access, same ID, existing store, revision checks, private review consent, no board or mail
PASS sourcing desk: staff-only, approved recipients, acknowledgement before approach, idempotency, future dates and missing-price comparison gate
PASS one project: owner RFP read, private connectivity, staff-confirmed proposal, existing response/review stores, missing price preserved, private draft export without publication
PASS confirmation preview capture: both notifications, domain-only desk brief, independent failure/retry, retained queue, staff-only retry, no duplicates, zero external mail
PASS adversarial boundaries: origin, consent, recipient validation, private caching, body size, desk auth, interrupted queue repair, rapid-confirm mail race, ambiguous mail retry, rejected mail retry, web/MCP parity
PASS request/confirmation routes: initial confirmation plus desk and buyer acknowledgement, token binding, expiry, staff-only desk, safe replay, no supplier invitations or mail
PASS confirmed buyer recovery: actual auth/request and auth/verify, non-owner denied, no-cookie second device, no-return sign-in, expired/reused link without credential issuance
PASS sector import does not turn incidental no into unsupported or narrative into strong evidence
PASS 72 adjudications: classification corrections, anonymous evidence limits, source/date provenance, named-case precedence, no supplier suitability claims
PASS shared consent: valid choices, expiry, future dates and malformed values
PASS written proposal evidence is reachable; malformed and executable links are excluded
PASS preview mail: private capture, no external sending, deployment links, idempotency, conflicts, disabled/unknown fail closed, production unchanged
PASS outcome workflow: real confirmation grant, staff-only review, exact buyer approval, stale/edited approval denial, separate publication, anonymous projection, withdrawal, origin and cross-project controls
```

### 2, 4 and 5. HTTP, server-rendered content, graph and machine parity

Commands: `curl -fsS http://localhost:3127/sase/shortlist/ -o /tmp/netify-answer.html`; exit 0. `python3 scripts/verify-answer-first-html.py http://localhost:3127/sase --all-pages`; exit 0.

```text
PASS HTTP: approved H1; count in first 80 main-content words; 30 server-rendered cards and best-for lines; desk H2
FIRST 80 WORDS: Compare SD-WAN and SASE providers for UK businesses Compare 30 researched SD-WAN and SASE providers across operating model, network and security capability. 19 technology vendors; 4 UK carriers; 9 managed service providers; overlapping categories counted in each type. 4 UK-headquartered or UK-entity providers; 26 UK entity statuses not yet reviewed; UK carrier evidence reviewed on 2026-09-30. Get comparable SD-WAN and SASE proposals from UK providers Use Netify to request comparable proposals, demos and pre-sales contacts from named SD-WAN and SASE
PASS graph: 30 organisations in card order; FAQ exact visible parity; no Person; no em dash or legacy status
PASS llms/feed: first three lines byte-identical to entity block
PASS sibling: sd-wan-vendors rows 16 title SD-WAN vendors compared (2026): 30-Provider Research Dataset | Netify h1 SD-WAN vendors compared
PASS sibling: sase-vendors rows 17 title SASE vendors compared (2026): 30-Provider Research Dataset | Netify h1 SASE vendors compared
PASS sibling: managed-sd-wan rows 12 title Managed SD-WAN providers compared (2026): 30-Provider Research Dataset | Netify h1 Managed SD-WAN providers compared
HTTP acceptance complete; no requests or emails submitted
PASS 50 rendered provider/sector pages: no em dash or legacy unknown vocabulary

```

The first-80-word test covers the main page content, excluding scripts/styles and the site's existing global navigation. A raw sed strip of the entire response counts navigation and JavaScript as prose, so it is not an accurate content-order test. Full server HTML is retained in `shortlist-server.html`.

### 3. Service title stays beneath the answer

Command: `git grep -n 'Get comparable SD-WAN and SASE proposals' -- src`; exit 0.

```text
src/lib/sourcing-contract.ts:6:  "Get comparable SD-WAN and SASE proposals from UK providers";
```

The source literal remains centralised. Actual shortlist HTML verifies the approved entity H1 and service H2. The unrelated homepage still uses its existing service title; this branch does not rewrite that page.

### 6. Reused actions and preserved sibling titles

Command: `git grep -c '/sase/api/sourcing/request/' -- src/components`; exit 0.

```text
src/components/SourcingEntrance.tsx:1
PASS all 50 provider and sector pages: HTTP 200; complete evidence rows; all three actions per provider

```

`SourcingActions` is the single provider-action component. It uses controlled checkboxes inside the desk and links into that desk from other pages. The single request implementation remains in `SourcingEntrance`, preserving its consent and idempotency handling. Browser check: BT profile > Demo > shortlist carries exactly BT/Demo selected; no submission performed. Invalid/multiple action parameters do not preselect an action. Existing `/best/` inventories remain complete; shortlist view predicates are the existing predicates, not new matching rules.

### 7. Build, types, lint and layout

- `npm run build`: exit 0, including the full validation chain. Actual output: `logs/build.txt`.
- `npx tsc --noEmit`: exit 0, no output. `logs/typecheck.txt`.
- Focused ESLint across changed page components and new entity/FAQ/schema helpers: exit 0, no warnings or errors. `logs/lint.txt`.
- `git diff --check`: exit 0, no output.
- `npx --yes lighthouse@12.8.2 https://netify.co.uk/sase/shortlist/ --only-categories=performance --chrome-flags='--headless --disable-gpu' --output=json --output-path=/tmp/netify-answer-baseline-lighthouse.json --quiet`: exit 0, CLS 0.
- `npx --yes lighthouse@12.8.2 http://localhost:3127/sase/shortlist/ --only-categories=performance --chrome-flags='--headless --disable-gpu' --output=json --output-path=/tmp/netify-answer-local-lighthouse.json --quiet`: exit 0, CLS 0.
- CUA browser: desktop viewport/document width 1280/1280; mobile 390/390; no console warnings/errors in the final fresh-page observation. Screenshots: `desktop.png`, `mobile.png`.

These Lighthouse runs show no layout-shift regression in the measured mobile lab loads. They are not field performance or ranking evidence.

## Findings resolved during validation

- Four current dataset slugs had no legacy vendor profile. Added evidence-based profile rendering for Expereo, Open Systems, Barracuda SecureEdge and Virgin Media O2, so every ItemList/profile link resolves.
- The inherited shortlist variants were rendering the same unfiltered page. They now use the existing view predicates and matching title; all-provider main page remains complete.
- UK entity evidence does not establish nationwide address coverage. The nationwide question explicitly reports the four UK entities and states that site serviceability is not yet reviewed.
- Six legacy profiles contained em dashes and older uncertainty wording. Display punctuation/status vocabulary was normalised; underlying source files, raw stored evidence and capability grades were not rewritten. Displayed quotations therefore have normalised punctuation, with source links retained.
- The existing CC BY 4.0 declaration was present in the MCP resource contract but absent from the methodology page. Its existing wording is now visible and used by Dataset/feed licence fields.
- Blank reviewer configuration removes the inherited named reviewer assertion on sector pages. No reviewer has been invented or signed off.

## Explicitly outstanding

- Implementation step 7: wider `listed` UK provider tier, separate PR after this release is live, supported by primary-source legal and service evidence.
- Acceptance item 8: release through the authorised Git integration path, updated sitemap lastmod dates, IndexNow and Search Console/Bing submissions, deployment ID and live verification. Not performed because this request explicitly prohibits deployment.
- Acceptance item 9: eight-query signed-out UK Google AI Mode and Copilot panel fourteen days after release, compared with 30 September. No new citation, recommendation, click or causal uplift claim is made.
- Fresh authenticated Neon and hosted private-storage/email verification is not claimed from a snapshot-backed local build. The merged corrective release remains intact and its separate production proof is preserved.

## Owner blanks

`data/shortlist-review.json`: reviewer name, role and review date; Harry's market-structure sentence and desk sentence. Empty slots render nothing. No new supplier commitments were introduced. The nineteen adjudications and four UK carrier reviews still need owner sign-off or extension before 16 October under F5; this work does not sign them.
