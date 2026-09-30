# Data repair — 30 September 2026

Sensitive credentials were not readable through export; that did not establish that they were missing. Production authenticated matching was subsequently verified as Neon-backed. The public `/api/provider-knowledge/` endpoint nevertheless exposed all 30 governed profiles, which were retrieved read-only. Local capture: workspace `outputs/action-first-source-audit`. No production database write was performed.

## Confirmed defects and code changes

1. The import parser did not recognise “Strong fit” or “Good fit”. An incidental “no” could produce `not_supported`, including a missing-certification caveat. A dedicated sector parser now preserves the assessment and treats unknown/not-primary/conditional as requiring confirmation. Existing technical/editorial publication review still applies.
2. A nonempty case-study narrative was automatically graded strong. New imports leave strength unassessed unless reviewed; having a named-role quote or adjacent product is not enough.
3. The matching-feed producer discarded sector qualifications and source IDs. The companion branch retains them.
4. The feed producer treated a geography heading as positive coverage even where the finding said unknown. The companion branch now requires a positive finding plus source references. Its projection is also applied to the preview snapshot. It does not invent a UK contracting entity.
5. UK delivery is now unconfirmed until evidenced; an absent independent-source count is not zero. Curated grades and dates are retained as provenance for conflict review. Deployment speed stays unconfirmed where no reviewed evidence exists.

## Source adjudication

All 72 flagged rows have been adjudicated, including the 68 outstanding rows. Complete source links, qualifications, disposition and pending human sign-off appear in sector-adjudications.csv and sector-adjudications.json. The older sector-row-review.csv and sector-counts.json are historical pre-adjudication captures, not current approval or matching counts.

Dispositions: 24 verified named, 6 verified anonymous, 1 partner case, 12 adjacent service, 7 outside taxonomy, 17 insufficient source, 4 wrong sector, 1 planned not delivered. Thus 31 have qualified deployment evidence; this does not prove current UK delivery or suitability for a buyer's brief. Blocked or missing sources are explicitly insufficient, never silently verified.

Dated preview projections are in data/provider-sector-adjudications.json and merged with the earlier Cisco, Aryaka and BT reviews. Anonymous references remain partial. ALTANA and Bimbo do not establish transport/logistics; Verizon video collaboration does not establish government SD-WAN; Lumen's planned manufacturing deployment is not a completed deployment. Named existing evidence takes precedence over a weaker additional case. No Neon database row was changed.

Source review and tests are complete at the disposition level. Seventeen insufficient rows still require replacement primary evidence; editorial release approval remains pending for all new adjudications.
