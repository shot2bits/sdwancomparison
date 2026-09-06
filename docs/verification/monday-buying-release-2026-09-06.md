# Monday buying journey release

## Scope and baseline
Baseline engine 4f702c5, deployment 665alzhe3, version 0609262114. Main website baseline d032e99, with verification-only commits through 8a479ac. All existing buying tools retained. No provider data, migrations, publication policy or pricing calculation changed.

## Step checks
1. Confirmed live deployment and clean engine checkout. Journey modes, project entrance and publication policy tests passed.
2. Added compact provider, pricing and existing-document entry controls. Existing engine stays mounted when comparing. ESLint, TypeScript and browser checks at 1440/390 passed. Reduced the initial copy block after mobile inspection.
3. Comparison and research CTAs now say Get proposals for my project. Existing handoffs retain requirements, comparison questions and provider research context, without invitations or publication. Updated stale CTA assertions. Comparison contract tests and desktop/mobile handoffs passed. Local provider contract tests used the reviewed snapshot because the local matching source is not configured.
4. Clarified existing-document coverage checks. Real Word/PDF/Excel parsing and link validation checks: 42 passed, 0 failed. Ingestion completeness and browser TXT retention/oversize rejection passed.
5. Existing pricing controls meet scope, so no pricing logic changed. Pricing discovery, ownership/privacy/consent, quote idempotency, notification failure handling and desktop/mobile circuit forms passed. External quote/publication writes intercepted in browser tests.
6. Added public/private and next-step explanation to review. No promises of supplier availability or response times. Existing publication policy and revision/idempotency checks passed. Review UI test verifies disabled publish before consent and retained fields after editing. Test draft request intercepted; no opportunity or email created.
7. Removed manufacturing-only introduction. All five sector browser journeys passed: manufacturing, healthcare, retail, financial services and government. Each includes exact site/user counts, saved-draft recovery, Short/Detailed RFP, bespoke questions and publication entry. Sector/scale matrix passed at 5/15/120 sites. Four existing governed sector-page handoffs passed; no invented government research profile.
8. Aligned engine and main-site research CTA labels and corresponding JSON-LD action labels. Canonical redirect source checks and sector entrance checks passed. Existing sample/question-bank links and URLs preserved.
9. Added consent-controlled route selection events using only approved intent enums, and tracking to the engine research anchor. Buying-funnel and marketplace-funnel tests passed, including private-data exclusion, deduplication, source retention and failure isolation.
10. Full engine validation and production build passed. Production-build desktop/mobile controls, version/overflow/page-error checks, research handoff and publication review passed. Deployment receipt follows below.

## Limits
This validates the changed journeys, not every possible platform action. Google document happy-path retrieval, real supplier fulfilment and real email delivery are not certified by these local tests. Browser publication/quote writes were intercepted. No real buyer opportunity or supplier message was created. No citation increase is claimed. Harry article rewrites are outside this code release.

## Live release receipt
- Engine code: c17eb85. Deployment: https://sasecomparison-3hcrppl2g-netifymarketplace.vercel.app (dpl_Cmd6oiNFng5p3xvq2ZumeUMQq76M). Public version: 0609262151.
- Main-site code: f77487e. Deployment: https://v0-broadband-reseller-framework-a1b0ng090-netifymarketplace.vercel.app (dpl_GZ6SDsLLJLSHaGAqwDjeGybaSJPo). Inspect confirmed netify.co.uk targets this deployment.
- Explicitly set the engine rewrite target alias to the new release and verified the public domain, not just a deployment URL.
- Live desktop/mobile entry routes, file chooser, pricing discovery, comparison handoffs, version visibility and overflow/page-error checks passed.
- All five live sector journeys passed: exact counts, draft recovery, Short/Detailed RFP switching, bespoke questions and publication entry. No real project was published.
- Live publication review copy, consent-disabled button and edit retention passed with draft API intercepted. No email was sent.
- Main-site research CTA browser test carried the exact edited requirements into the new engine with no page errors. All canonical legacy redirects and HTML checks passed.
- Zero-, one- and two-provider handoff cases passed across the local/production/live checks. MCP and envelope compatibility tests passed.
- Error-level log queries for both deployments, covering the checked 10-minute window, returned no logs. This is not a guarantee that every possible action is error-free.
- React review: reused existing handlers, retained lazy-loaded tools and mounted engine state, semantic navigation controls and visible focus outlines; added no fetching dependency or new publication path.

Rollback references: engine 665alzhe3 (also reset sasecomparison-netifymarketplace.vercel.app explicitly), main site puj6f0m0g. No data migration is involved.
