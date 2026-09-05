# Approved buying workspace — feature preservation review

Baseline: production commit 24795b6. Design reference: the approved Netify buying-workspace concept. The concept's example company, fabricated comparisons, verification and publication simulations are not copied into the application.

## Existing features and their new locations

| Existing feature | New location | Implementation retained |
| --- | --- | --- |
| Typed requirements and corrections | Project → Overview | ProjectDesk composer, send and fact ledger |
| Voice, Word/PDF/Excel/text import and document-link ingest | Composer microphone / attachment; Requirements → question bank | Existing capture and ingest handlers |
| Short/detailed RFP depth | Project → Overview, depth controls | Existing depth and readiness contracts |
| All requirement sections | Requirements & RFP → document sections | GuidedBuild rows and section handlers |
| Bespoke supplier questions | Requirements & RFP → Question bank & answers → Add bespoke question | addCustomSupplierQuestion; same facts and publication document |
| Recommended questions and AI suggestions | Requirements & RFP → Question bank & answers | Existing suggestions API; buyer approves additions |
| Inline answers | Requirements & RFP → Question bank & answers | Existing per-question save handlers |
| Existing / AI-generated RFP validation | Overview → Check an AI-generated RFP | Existing upload/paste validator and gap report |
| Edit captured requirements | Overview → Edit | Same slot editor; added access to all captured items beyond first five |
| Supplier document preview | Supplier pack → Preview what suppliers receive | Existing document review handler |
| Decisions, architecture, provenance and document views | Activity & review / All tools → Supplier pack & project review | Existing ProjectDesk review and ProcurementWorkspaceDocument |
| Public 2/3-provider comparison and assistant | Compare; original public shortlist route | ShortlistBuilder and live dataset |
| Comparison-to-project handoff | Compare → Find providers for my project | Existing session handoff; no automatic supplier pinning |
| Buyer-pinned providers | Requirements & RFP / Supplier pack | Existing shortlist pins, removal and invitation policy |
| Short anonymous brief | Publish a short brief | JourneyModeSelector; real persistence and review dialog |
| Full RFP publication | Review & publish | Existing readiness, identity, consent and publication handlers |
| Business email and company verification | Publication flow / Account | Existing server-side policy and sign-in |
| Matched providers, reports and exports | Project tools; published project | Existing publication-gated identities and exports |
| Responses, Q&A, evidence, pricing and award | Responses / published project room | Existing saved-project and supplier response routes |
| Board and supplier workspace | Opportunity board / All tools | Existing routes |
| Cost/TCO, directory, security and market research | All tools | Existing routes |
| MCP and connected evidence | Connections; existing project document evidence | Existing connector, MCP tools, scopes and approval gates |
| Draft save status and storage failure warning | Project header | Existing autosave state, checked with simulated quota failure |
| Saved projects, identity and role-specific administration | My projects & account | Existing account routes and permissions |
| Searchable HTML, canonical metadata and research content | Public comparison plus buying guidance below workspace | Existing server-rendered content and canonical routes |

## What changed

Presentation shell, navigation, wordmark, spacing and contextual panels. Engine stays mounted while switching between Project, Compare, Responses and All tools. Existing real backend services were not replaced or modified. Old header navigation is represented by project tools and explicit project tabs. Long question registers and document sections move into detailed views.

## Verification

- Full publication-first regression suite (47 commands), type checking and lint.
- Desktop and mobile browser checks: preserve typed draft across Compare navigation; add a bespoke question and verify it reaches engine state; supplier pack; sector input; preferences; no document overflow or browser exceptions.
- Draft status browser tests: successful save and simulated local-storage quota failure remain visible.
- Existing short-brief dialog tests: focus/close/Escape, draft retention and mobile containment.
- Isolated publication UI: reload, failed publication and retry; comparison handoff; published project reopening with frozen provider identities.
- Existing source and pipeline tests cover imports, validation, question register, decisions, publication gates, exports and MCP contracts. External supplier messaging, live email delivery and actual live board publication are not exercised by UI smoke checks.
