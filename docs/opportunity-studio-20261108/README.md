# Opportunity Studio

The initial design-preview record below is historical. The connected implementation and current test/release status are recorded in [INTEGRATION.md](INTEGRATION.md). The candidate now uses real project, publication, supplier engagement and MCP services; testing uses isolated preview storage and captured email. Production release is pending hosted acceptance.

## Original design-preview record

8 November 2026. Branch `codex/opportunity-studio-20261108`, based on verified live source `048802a56eabad70e9a6299f9461ca77ff59c070` from `release/2026-09-30`. Actual checkout `/Users/robertsturt/sdwancomparison`.

## Status

Local preview `/sase/studio-preview/`, port3037. Noindex. NOT deployed and NOT a completed production rebuild. Canonical builder, storage, authentication, supplier permissions and MCP APIs unchanged. Publication, supplier sign-in, bid requests and buyer approval are explicitly labelled local simulations. No network calls, live records, supplier messages, AI sessions or permission changes are made by this preview.

## Proposed product contract

One requirement and one progression: describe → build → review and publish → supplier engagement. RFI is a short statement of requirements; RFP adds a governed question set and requests a priced proposal. Both culminate in the Opportunity Board. Downloads are secondary.

Public board: allowlisted solution/service type, geography, broad site/user bands and timing. It never serializes free-form requirement text, attachments, identity or exact counts. Signed-in, approved suppliers: buyer-reviewed detailed requirement and selected questions. Buyer/Netify: identity, contact details, communications and private pricing. The buyer approves engagement after a supplier requests permission to bid. This does not automatically share contact details, award a contract or guarantee a response.

The supplier-detail boundary is a proposed rule requiring server implementation. The preview does not claim current public APIs already implement it. Free text can contain identifying information; the buyer must remove it before sharing. No automated redaction guarantee is made.

## Implemented preview

- RFI/RFP switching preserves source text and question selections. RFI exports exclude RFP questions.
- RFP uses 27 actual canonical questions through `canonicalQuestions()`, grouped by procurement area.
- Conservative local extraction of explicit scope, site/user counts, regions and management model. Unstated values stay blank; no fake AI stream.
- Sites OR users can establish estate size; remote-only projects need not invent offices.
- Editable requirement and an allowlisted public preview, followed by distinct public/supplier reviews and two explicit approvals.
- Text/Markdown import locally (2MB /20,000 characters), pasted AI-written RFPs, Markdown download and explicit save/restore in a separate versioned browser key. No existing draft keys changed. Word/PDF import is not wired here.
- Fictional supplier access gate → request to bid → buyer approval. No fabricated active supplier participation or proposal counts.
- Honest MCP panel with the current marketplace endpoint and tools. It remains disconnected; copying the endpoint grants no access.

## Production integration still required

1. Bind the renderer to existing `ProjectDetails` and the canonical workspace envelope. Keep source/decision ledgers, question IDs, document purpose, optimistic revisions, existing drafts and recovery URLs. Do not retain this preview browser store as a second production project model.
2. Reuse browser/MCP service contracts: `start_project`, `update_requirements`, `prepare_publication`, `publish_opportunity`, `get_project_status`. Preserve project tokens, verified owner sessions, exact consent, frozen revisions and idempotency.
3. Implement save → identity verification → reviewed publication → durable board receipt. A link/code returns to the same project/revision. Board failures must not display success.
4. Enforce separate public/supplier/owner projections on the SERVER across HTML, APIs, feeds, machine interfaces and legacy links. UI concealment is not access control. Source documents stay private unless explicitly released.
5. Persist request-to-bid records and buyer approval/decline. Apply verified-supplier eligibility and messaging policy consistently. The current supplier inbox supports invited and open-eligibility opportunities; that is not proof of this proposed approval flow.
6. Preserve public citation URLs/research and accurate schema. Add server-confirmed funnel stages; simulated browser activity is not leads. Make no AI recommendation, supplier participation, price or timing promises.

## Findings behind the redesign

`BuyingWorkspaceShell` exposes two intents and three format choices. `JourneyModeSelector` has its own brief form while `ProjectDesk` retains the canonical fact/document engine. Event bridges and modal reviews can return a buyer to another input panel. The replacement should have one state machine rather than another visual shell around both models.

Vercel alias was verified read-only: project `sasecomparison`, production deployment `dpl_FzWwvHRrhhECMApo3zYn7n5NvCMG`, source `048802a`. Older source in workspace `outputs/october-publication-audit/source` is an archive, not the real checkout. Existing untracked bundles/workbooks/test plans preserved.

## Actual verification

`npx tsx scripts/test-opportunity-studio.ts`: passed allowlisted public projection/identity exclusion, broad counts, invalid/fractional input, remote-only estates, governed question IDs, RFI/RFP export differences, conservative extraction and supplier gate truth table.

Scoped ESLint and whole-project TypeScript passed. `npm run build:nonmutating` passed: webpack production compilation, TypeScript and298 static pages including `/studio-preview`. Existing evidence preflight retains23 exact retired expired records pending owner review. Local provider credentials are unavailable; existing unrelated shortlist pages used the reviewed snapshot. No dates or guards changed. Generated review-health report is restored to its original content after the build.

CUA browser: RFI → editable fields → public/supplier review → both approvals → simulated listing → unsigned supplier blocked → approved supplier simulation → request to bid → buyer approval. RFP preserves statement and selected questions at review. Browser save/restore retained the source. No console errors or warnings captured. Mobile entry and requirement form: 390px client/scroll width. Draft recovery control made visible on mobile after testing. Viewport override reset. Screenshots: workspace `outputs/opportunity-studio-20261108/`. Final built-server browser readback succeeded at `http://localhost:3037/sase/studio-preview/`: one main heading, noindex/nofollow, 1280px client/scroll width. Final landing screenshot: `studio-final-desktop.png`. This verifies the local production build, not a production deployment.
