# Provider evidence reconciliation — 1 October 2026

## Scope and decisions
All 30 providers and all 40 comparison fields (1,200 cells) are recorded in final-capability-decisions.csv. Original public Neon records and the previous shortlist are retained as reproducible public-data fixtures. The original 30 private DOCX sources were checked against their archived SHA256 manifest; private documents are not committed.

The audit found 262 matching grades, 551 differences without field-specific legacy evidence, 227 dated source-linked differences and 160 cells for providers without a legacy record. These are source-comparison categories, not counts of defective suppliers.

The import parser incorrectly treated “confirmed directly” as requiring confirmation. Parser 1.0.1 fixes that and keeps negative, qualified and partner findings distinct. 395 bounded field repairs are published from the shared provider store: mechanical restoration of source findings, recovery of 139 field-specific historic findings whose primary-source quote remains available, and explicit primary-source reviews. Quote revalidation is not a new human endorsement. Original verification dates are retained. Unknown/unsourced historic grades have not been copied wholesale.

Two unsafe aliases were removed: generic WAN optimisation cannot establish packet-loss remediation; generic brownfield migration cannot establish MPLS coexistence. Exact feature evidence takes precedence. The 88 dated differences without adequate recovery evidence retain the current finding instead of inventing a resolution. Three absence inferences (Cloudflare and Forcepoint managed service, Zscaler backbone) were explicitly withheld: a partner/service description does not prove non-support. Their source URLs/check results remain in capability-audit.json and source-checks.json. Some URLs blocked automated access; this is not evidence that the supplier lacks a capability.

Duplicate imported capability rows were also found. Both feeds now resolve them by recorded evidence confidence with a stable row-ID tie-break, independent of database return order. Geography, service and sector rows receive stable ordering before canonical merging. Reversed-row regression checks cover all four groups. The existing confirmed Palo Alto browser-isolation row needs no parser repair.

## Shared source
The published Neon revision remains the underlying source. A versioned, source-linked reconciliation manifest is applied once in the apex provider store to both public profiles and the authenticated matching feed. It does not rewrite Neon rows or invent publication approvals. The manifest is bound to each source revision and original field value; changed, contradictory or expired evidence is withheld and reported. Tests execute both actual store paths against isolated fixtures. No production credentials or live customer submissions were used in those tests.

The SASE detail pages, vendor index, shortlist, matching and MCP claim verification now use that shared projection. A labelled corrected snapshot is available on connection failure. Snapshot correction evidence also expires. The older July files remain historical inputs, not the source of current profile or MCP capability claims.

BT now has 13 of 40 graded fields, including 9 supported fields. This is research completeness, not a capability score. The old 31-yes number is not restored without field-level support.

## Safeguards and approval
All 30 marketplace metadata descriptions are generated without the broken whitespace transformation and long legal-entity titles. View metadata uses actual eligible counts. Duplicate sector labels are removed. Empty UK evidence never says no suppliers exist.

Assessment reporting identifies missing, invalid, changed and expired approvals. Expired sector/carrier evidence fails the build; all expiring rows are reported, including signed rows. The 19 sector and four UK carrier approvals still need owner action before 16 October; evidence expiry remains 30 October. No dates were silently extended.

Thirty assessment drafts and current evidence fingerprints are in docs/editorial-review/RECONCILED-APPROVAL-PACK.md and reconciled-assessment-drafts.json. Reviewer identity, Harry’s copy and actual approvals are still required. They have not been fabricated or published. This release repairs evidence consistency; it does not demonstrate an increase in AI recommendations or clicks.

## Verification
Focused parser, shared-store parity, source-change/expiry, 1,200-field projection, MCP, metadata, view-count and duplicate-label tests are recorded in the release logs. Full application builds and live deployment verification are recorded separately after completion.
