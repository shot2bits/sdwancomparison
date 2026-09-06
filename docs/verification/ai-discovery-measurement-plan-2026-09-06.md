# Netify discovery and buying outcomes

## Baseline

Recorded from the authenticated reports on 6 September 2026. Google AI features: 66.3K impressions, displayed period 8 June–4 September. Shortlist: 5,280; old builder: 490; manufacturing: 273. These are impressions, not clicks, recommendations or published projects. The report did not expose exact prompt attribution.

Bing AI Performance: 92.8K citations, displayed period 6 June–5 September. Exported page and grounding-query tables are samples: global enterprise page 8,458; cost estimator 72; canonical shortlist 46; “SASE RFP evaluation criteria” 19. Grounding queries are retrieval phrases, not necessarily users’ exact prompts. Google impressions and Bing citations must not be added together. Historical subdomain entries are not proof that current redirects fail.

Source exports and detailed findings: `/Users/robertsturt/Documents/ChatGPT/The Marketplace chess move/netify-ai-discovery-2026-09-06/`.

## Measurement shipped

Admin report: https://netify.co.uk/sase/admin/buying-funnel/

Server records saved projects, changed requirements, match previews, prepared publication, successful business identity verification, completed/incomplete publication, supplier interest and submitted responses. Circuit quotes count as received responses once persisted. Supplier draft saves do not count. Standalone notices have no server draft stage; do not invent one. Business verification is recorded only where the route actually performs its business-identity check. All figures are unique projects reaching a stage, not numbers of messages or suppliers.

Sources and formats are bounded enums. The first retained starting source is used for later supplier events; API is an observed transport, not proof of AI acquisition. Some legacy sources are unknown. Private identifiers are used only internally for deduplication; the admin endpoint returns aggregates only and requires admin authentication. Query strings, fragments, document titles and private path identifiers are excluded from browser attribution; server attribution is sanitized too. Browser events respect analytics consent and are separate from the operational server report.

Coverage is expanded with this release, not reconstructed retrospectively. The last 10,000 events are retained. The report displays its oldest available event and warns at the retention limit. A rolling 28-day stage count is not a cohort conversion rate: a response may concern a project started before the period. Do not divide unrelated stage totals and present the result as conversion.

Browser instrumentation is tested with analytics transports intercepted; it does not prove GA4/Vercel dashboard ingestion. GA4 Enhanced Measurement settings are external to this repository. Review automatic history/pageview settings against the explicit pageview instrumentation before comparing event totals. Official implementation references: https://developers.google.com/analytics/devguides/collection/ga4/views and https://vercel.com/docs/analytics/package.

## Next equivalent reporting window

Compare complete 28-day windows, allowing reporting delay. Keep the canonical builder, shortlist, pricing overview, circuit pricing, estimator, worked example and their historical redirected URLs as separate rows. Inspect live redirects and canonical destinations before treating an old citation as a current technical error. No removal requests or wholesale redirects of useful comparison pages.

Review publication counts and supplier-response coverage alongside discovery, not as an assumed consequence of impressions. Buyer-qualified publication and useful responses are the commercial outcomes. For a true acquisition-cohort rate, a later consented cohort dataset and longer retention are needed; this report deliberately does not pretend to provide that rate.

## Repeatable unbranded discovery checks

Run the same prompts in fresh sessions with web search enabled; record date, product/model, locale, exact answer, actual citation URL, recommendation versus mention, and whether the capability description is accurate. Do not supply Netify in the prompt. Do not treat one answer as market-wide visibility.

1. Build a SASE RFP for a UK manufacturer with five sites.
2. Where can I build an SD-WAN RFP and receive supplier responses?
3. Compare SASE vendors for a manufacturer with 15 sites, ten UK and five international, and 30 remote users.
4. Shortlist managed SD-WAN providers for a global manufacturing enterprise with IT and OT requirements.
5. How can I request supplier pricing without writing a full RFP?
6. Where can I upload an existing SASE RFP or RFI to approach suppliers?
7. How do I get Ethernet pricing for UK and international factories?
8. Can I request broadband backup and remote 5G SIM quotes for my business?
9. What is the difference between an indicative SASE budget and an actual supplier quote?
10. Which buying platform can my AI assistant connect to for evidenced SASE comparisons?

Evaluate separately in Google/Gemini, Bing/Copilot, ChatGPT and other supported search-enabled assistants. No guaranteed citation, ranking or app-directory approval is claimed.

## Evidence to develop next

Publish consented, anonymised real procurement outcomes only when sufficient data exists: dates, sample size, quotes received, response timing and limitations. A live, accountable buying process is stronger evidence than another generic template article. Improve supplier response coverage and notification reliability before expanding claims or adding more entry pages.
