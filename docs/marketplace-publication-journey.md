# Marketplace publication journey — 27 September 2026

The primary buyer outcome is a genuine project published on the Netify Opportunity Board. The builder and private draft downloads support preparation; they are not completed leads.

## Buyer journey

Three entry options use the existing project engine: Describe my project, Upload my existing RFP, and Help me build an RFP. Every route leads to review of the same anonymous notice. Existing named-provider comparisons remain available under Compare known providers. Project format/depth and private downloads are secondary expandable controls; no content or export capability is removed.

The notice preview explains public scope/sector/sites/regions/timescale/requirements and private company/email/pricing. The short-brief readiness policy remains authoritative. Buyers still approve consent, verify their work email and explicitly publish; no new automatic publication or supplier invitations are introduced.

## Measurement

- Vercel consent-dependent browser events: marketplace_journey_started (entry click), marketplace_brief_started (first brief field edit), marketplace_review_reached (successful save leading to review). Existing form_start also covers the RFP editor. None is a lead or proof of publication.
- Existing private server report: project_started means persisted draft; publication_prepared means consent/pending publication saved.
- New server stages: verification_requested means the mail service accepted the verification email for sending, not proof of delivery; verification_completed means a valid, single-use magic token/code created a session and the project belongs to that verified email. These apply to marketplace-project consent flow only.
- Existing publication_completed remains the actual successful board-plus-unlock outcome. Verification cannot increment it.
- Server stages are deduplicated per environment/project/event; reports exclude identified tests. Reporting outages cannot block sign-in.
- No private requirement text, company, email or tokens enter browser events or aggregate funnel records. The existing admin report displays the new server stages automatically.
- These are stage counts over a reporting window, not an acquisition cohort. Browser counts omit visitors without analytics consent. Do not divide browser and server counts and label the result a precise conversion rate. New stages have no historical backfill.

## Netify handling of genuine published projects

This is an operating procedure for the team, not a new automatic outreach promise:
1. Review the published opportunity and distinguish a genuine buying requirement from tests, duplicates and unsuitable requests.
2. Assign a named Netify owner to the genuine opportunity and review the stated scope, timescale and missing details.
3. Where clarification is necessary, use the existing authorised buyer contact process; do not disclose private identity in the public notice.
4. Review compatible-provider evidence. Do not turn missing evidence into a positive eligibility finding.
5. Use the existing invitation/approval controls for any supplier outreach. Record delivery, responses and next actions in the existing project workflow.
6. Report actual published opportunities, eligible invitations and substantive supplier responses separately. Do not promise a response time or quotation without an operational commitment.

No team message, supplier outreach, test publication or ChatGPT app submission is part of this release. The marketplace journey is the foundation for a later app submission.
