# Publication-first buying journey

Implemented on `codex/publication-first-comparison`, based on `dbe6986`. Released to production on 5 September 2026 with explicit user approval.

## Buyer-facing changes

- Public two- and three-provider SD-WAN/SASE comparisons remain available on the shortlist page and inside the buying platform. Searchable HTML research and RFP explanations remain.
- The default journey is a short project brief, followed by review, business verification and explicit anonymous publication. A full RFP remains optional.
- Comparison context, requirements, timescale and selected capability requirements survive the handoff. Compared providers are not silently pinned or invited.
- Published short projects reopen with their saved matched providers and a link to the existing supplier-response workspace.
- MCP named factual comparison remains public. Personalised matching is available through the verified publication workflow; legacy public matching routes return aggregate coverage and the next step.

## Bugs corrected

- Private draft recovery and stale revision handling.
- Editing a prepared draft now invalidates consent; published drafts cannot be changed through the draft mutation endpoint.
- Company confirmation and short-project completeness are checked on the server.
- `find_providers` no longer accidentally requires a full RFP.
- Timescale and explicit capability filters are retained through publication. New short-project hashes cover this information without changing historical hashes.
- Concurrent draft/prepare/publish operations use a per-project lock. Retried successful publications reuse their publication state.
- Published short projects are accepted on resume and do not display an empty full-RFP editor.
- Publication and identity funnel events are deduplicated by project.

## Verification

- 47 nonmutating checks passed: TypeScript, ESLint, marketplace foundation, comparison logic, live-data adapter fixtures, persistence integration and the existing broad validation suite.
- Real publication services passed with isolated storage and synthetic verified buyers for both short journey modes. Verified anonymous board projection, invitations, unlock state, retries and matching input preservation.
- Browser checks passed at 1280px and 390px: comparison, handoff, draft recovery, review, publication failure/retry, horizontal overflow and JavaScript errors.
- A real synthetic publication snapshot reopened successfully in the browser with frozen matched names and the supplier-response link.
- Optimised production build and final ESLint passed. All five desktop/mobile/resume browser scenarios also passed against the production build. The local build used the reviewed provider snapshot because production provider credentials were intentionally absent.

Run `node scripts/verify-publication-first.mjs` for the broad suite. Browser scripts require a local server at port 3107; run `npx tsx scripts/test-short-project-publication.ts` first to generate the published-project fixture.

## Release boundary

No live board entries, buyer emails or supplier messages were created. Live email delivery, production storage credentials and external AI-client approval/listing were not exercised. Those require a configured staging integration check before release. This is a tested implementation, not a guarantee that the entire legacy codebase is bug-free.

Deploy from a reviewed branch/preview with the existing production configuration. Retain the preceding deployment for rollback. No destructive schema migration is introduced. Confirm a staging buyer can verify, publish once, reopen matches and reach responses before promoting the deployment. Marketplace submission and third-party approval remain separate work.

## Production release

- Deployed code: `5f7dc7f`, including compatibility with the preceding live `3599a45` handoff change.
- Deployment: https://sasecomparison-lyublhz1e-netifymarketplace.vercel.app (`dpl_BMg9mpUGzN4u9NM2QHEej8u6JEJQ`).
- Previous deployment retained for rollback: https://sasecomparison-2hv0pqsdi-netifymarketplace.vercel.app.
- Vercel production build passed before domain promotion; 47 local regression checks passed after reconciliation.
- Live canonical page passed desktop/mobile browser checks. Public shortlist HTML and live provider database (30 providers, Neon) responded successfully.
- Post-deploy error-level log query returned no entries. This is a short smoke-test window, not continuous monitoring.
- Production publication/email delivery was not exercised with a real buyer; no synthetic public opportunity or supplier message was created during deployment verification.
