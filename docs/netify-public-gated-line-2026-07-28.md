# The public / gated line for opportunity notices

**Status:** RULED. Approved as written by Robert Sturt, 28 July 2026 (the intake-truth and public-opportunities lane). Nothing crosses this line afterwards without his ruling.

**Where it applies:** every public surface of an opportunity notice equally: the notice page, the board, `/opportunities/board/data.json`, `/opportunities/{id}/data.json`, the sitemap, llms.txt, JSON-LD and the marketplace MCP tools. One truth, every client (Article 17). The rendered twin of this table lives on the opportunity board page.

## Public, forever

A notice that entered the public record never leaves it. Closed and awarded notices keep their URL, stay in the sitemap and the board data feed, and state their status and close date. They are never deleted, noindexed or redirected.

| group | fields |
|---|---|
| identity of the notice | id, canonical URL, data_url, created, updated, closed_at, status (open, closed, awarded) |
| what is sought | title (field vocabulary), summary, ai_summary, ai_assumptions, ai_gap_flags, scope[], sector or the literal "not stated", desired_outcomes, compliance_requirements[], evidence_requested[], evaluation_priorities[] |
| size and place | regions[], site band, users_band, remote_users_band, cloud_platforms[] |
| process | response_mode, response_deadline, decision_target, go_live_target, engagement_type, auction_format, deadline, eligibility, buyer_visibility |
| document | has_full_rfp, rfp_shape (section titles and question counts only), methodology_version |
| activity | invited_count, bid_count, comment_count |
| free text | budget_note, timeline_note (buyer-authored; pass the pre-publish scrub before a public surface) |

## Gated (sign-in, or the supplier's issued token)

Buyer identity and any contact route (buyer_org where the buyer chose anonymity; owner_email is never rendered anywhere), attached documents, supplier responses and the feed bodies, all pricing (each supplier sees only its own; the buyer sees all), the exact site and user figures behind the public bands, and the controls: responding, inviting, closing. Infrastructure is never public: buyer_token, manage and share tokens.

## The re-identification rule (ruled 28 July 2026: always bands)

Anonymous means the public fields cannot single out the buyer. The identifying power is always the combination: sector plus a narrow region plus an exact figure plus a named incumbent will identify a buyer no name ever mentions. So:

- **Always bands on the open surface.** Site and user counts render as bands on every public surface, always (1-5, 6-20, 21-50, 51-200, 201-500, 501-1000, 1000+ sites), applied at the projection so no client can drift. Exact figures are revealed only to the buyer's own signed-in face and to participating suppliers after the gate. Derived titles use the band too.
- **The free-text scrub** (pre-publish validation of summary, outcomes, budget and timeline notes for names, places and phrases of uniqueness) and **the combination sentence** on preview belong to the preview slice; flags warn and the buyer decides. Nothing is silently rewritten.
- **The preview is the public face:** the pre-publish preview renders the public projection byte-identical, bands applied.

## The quality gate (ruled 28 July 2026)

Before any notice reaches a public surface it passes a deterministic gate, shared by every client: no test or placeholder content in title, organisation or summary; coherent figures (site counts within 1 to 20,000; response deadline, decision target and go-live in order); and a sector that is stated or explicitly "not_stated". The gate lives in `src/lib/notice-validate.ts` (`publicNoticeQualityGate`); the MCP validate tool reports failures as critical gaps, and the RFP auto-listing skips the board with the reason when its notice fails.

Sample notices are the exception that proves the rule: authored worked examples about invented organisations, always labelled `is_sample`, never counted as demand, and permitted exact figures because there is no one to identify.
