# Connected context map and RFI/RFP preview

> Next design direction, recorded 12 November 2026: use a location-led geographic estate map with site groups and reusable requirements, preserving the connected project and all existing sections/data. See [the durable design brief](../../docs/location-led-marketplace/README.md) and [reference research](../../docs/location-led-marketplace/reference-research.md). The first location-led mockup is available at http://127.0.0.1:3017/locations/; see [its implementation notes](LOCATION-MOCKUP.md). The root preview remains available. Nothing is published.

Local-only working prototype. Production routes, marketplace projects, Neon records and supplier conversations are unchanged.

Run from the repository root with Node 24:

```sh
node --use-system-ca --import tsx scripts/run-context-space-preview.mjs
```

Open http://127.0.0.1:3017/.

The starting brief, map and written document share one versioned local project. The document adapter reuses the existing Opportunity Studio document, readiness and anonymous-notice functions and the full 386-question core/sector bank. Stable context identifiers link requirements to map nodes. Sector defaults retain their suggested origin until the buyer selects or changes them. Custom wording remains complete and unconfirmed in evidence matching.

Provider recommendations use the existing evidence matcher and current public Neon-backed provider projection. All 30 records, full source qualifications, original checklists, complete research downloads and existing page sections remain accessible. Unknown evidence does not establish lack of capability. Provider research attachments are optional and identified as buyer research, separate from supplier responses.

Save on device is explicit browser-local storage. Download project preserves the same project ID, document choices, selected providers, disabled custom contexts, sector selections and map settings. Reopen validates the backup before replacing the current workspace. A document export requires a matching project fingerprint; research attachments also require matching evidence fingerprints.

This preview has no live marketplace save, invitation, supplier-message or publication endpoint. Supplier replies remain visibly unavailable. Existing production identity, approval and detailed-workspace protections are untouched. This is a prototype contract, not a migration of production buyer projects.

Checks:

```sh
node --import tsx scripts/test-context-project-preview.ts
node --check preview/context-space/client.js
```

The original standalone context-space HTML mockup remains unchanged. This directory contains the connected local version.

All working views now live within the persistent map canvas: starting requirements, sector evidence, selected-provider comparison and written RFI/RFP. Click the business or draft node, or use the stage controls. Existing information sections remain beneath the workspace.

The latest interaction is node-first. Business requirements, provider comparison and the RFI/RFP are primary 3D nodes. Selecting them reveals connected child nodes. Only the selected node is edited in a reserved inspector beside the map (below it on narrow screens); no form overlays the canvas. Provider nodes use the real evidence catalogue, while all provider records and source material remain available in the inspector.

Selection cues are consistent across the map: blue means not selected, green means selected or included, a tick repeats the colour cue, and a white outline means currently editing. A small Next arrow starts at Your sector and advances through scope, estate, regions, requirement review, providers and document preparation. Sector defaults are labelled Suggested / included, and document selection means a local draft exists, never publication or supplier approval. Explicit scope and draft-view state survive project backups; older backups remain supported.

The map now supports unconstrained quaternion rotation with mouse, pen or one-finger dragging, inertial movement, two-finger pinch, wheel zoom (45–600%), arrow keys and reset. Dragging a node rotates the map; tapping selects it. Visual label repulsion has been removed so front/back positions remain truly projected in 3D. Reduced-motion preferences disable inertial movement.

The Research universe reads the full available published provider projection, not private Neon tables. All 30 records, 7,764 rows, 60 original checklist paragraphs, 386 core/sector questions, 43 extended SASE questions and sector context metadata are reachable through stable record paths. Zoom reveals provider markers; selecting a provider/group opens its full data and each point resolves to original content. No fabricated decorative research points are rendered. Complete metadata and unknown future fields remain available.

Additional checks: `node scripts/test-context-orbit.mjs` and `node scripts/test-context-knowledge-map.mjs`. Mouse dragging, zoom levels and record drill-down were verified in the browser. Touch gestures were checked through pointer-event tests; a physical phone/tablet has not been used for verification.

The guided buying journey has four stages: business essentials, requirements, provider comparison and RFI/RFP. Sector selection reveals recommendations immediately; explicit defaults add the three sector starting challenges and four core procurement questions plus relevant scope and sector questions (responsibilities, deployment, pricing and sector references), preserving other choices. The company-overview helper makes explicit text suggestions for buyer review and retains original wording. It does not invent missing counts, scope or regions.

The new Living RFP beneath the map edits the same state and exports the same versioned document. Missing fields are named directly, default choices and manual overrides are shared, and complete provider research remains available. Contact/demo/indicative-pricing/RFP handoffs are local previews only. The proposed account-free journey uses one-time email verification at the point of sending and explicit approval of recipients and the exact brief. No email, verification, supplier routing or publication has been connected.

### Light mode and progressive requirement groups

The local preview now starts with persistent sector buttons above the map. The overview shows business requirements, sector challenges, applications and technology, provider comparison and the written brief, with optional research exploration. Opening a group moves the camera to its fixed requirement plane; all other groups and available requirement nodes remain in the same map. “Whole map” zooms back to the overview. Project actions and map settings retain secondary controls in disclosures. No data, source records or preserved page sections were removed.

Light mode uses translucent blue unselected nodes and translucent green included nodes. Only the focused node has a solid fill. The orbit toolbar's transparent area no longer intercepts node clicks. Mouse/touch orbit and zoom remain unchanged.

Verified locally: company-overview review, defaults, scope/count/coverage editing, provider evidence and selection, RFP generation, identical map and Living RFP text, individual challenge override reflected in both views, and complete research access. Existing orbit, knowledge-map and shared-project tests pass. No production publication or supplier sending.


### Persistent planes and comparison readiness

All six main groups stay present while moving between requirement levels. Business details, sector contexts, application details, provider options and document sections have stable world coordinates. Camera focus changes the target and zoom, respects reduced motion, and preserves mouse/touch orbit. Research branches already explored remain available in the map. Background research dots remain absent outside research exploration.

Canvas connections are clipped against every projected card rectangle, including unrelated cards along the path. They cannot show through transparent cards or cross their text. Sector-change notices sit above the map rather than covering nodes.

Compare providers remains a usable entry point. Until sector, explicit scope, one known site/user count and service regions are present, it shows a four-item completion checklist with direct actions and moves the map to the business-basics level instead of an empty provider level. Provider matching requests and recommendations wait for all four basics. Public research exploration remains available. No backend, original records or production files are changed.


### Word-style Living RFP

The Living RFP now uses a white document surface with a grey workspace, document margins, system-ui 11pt body text and conventional black headings and lists. The full document scrolls within the workspace; content is never shortened to fit the page. This is an HTML document preview, not an embedded Microsoft Word editor or a paginated print proof. The existing real .docx export remains available.

Both written views use the same escaped semantic renderer for headings, lists, paragraphs and bold text. Project state, question selection, source records and exported document generation are unchanged.


### Edit directly on the document

The white Living RFP page now contains editable buyer prose, site/user counts, sector, scope, regions, ownership, timescale, applications, cloud services, current technology, own requirements and procurement instructions. Sector requirements and question-bank entries can be included or excluded on the page; their source wording remains unchanged. All existing sidebar sections remain available. The full generated wording, including supplier tests and document-control metadata, is retained on the paper.

These controls update the existing shared state and debounced local comparison/project endpoints. No reverse parsing of arbitrary prose into assumed capabilities is performed. Structured changes re-run provider matching; application names and own wording produce supplier-specific checks. Active fields are not replaced by asynchronous renders. Other copies of a field and map labels sync immediately. An unsubmitted own-requirement draft survives document refreshes during the session.

Verified: direct document project creation; 12 to 24 and 48 site edits; matching map labels and section controls; direct SASE-to-SD-WAN change with refreshed provider findings; own requirement added to map; typing focus retained during comparison refresh; and .docx contents containing edited counts, cloud service, original sector contexts, own wording and selected bank questions. No publication, supplier messages or live database writes.


### Sector starting plans and company-page helper

Both the requirements and supplier-question sections offer a one-click sector plan. The plan unions three existing sector scenarios, four core procurement questions, scope-specific questions and a short selection from Harry's original sector packs. Uncovered sectors use relevant core questions alongside their existing sector scenarios. These are editable starting points, not mandatory buyer facts. Manual selections, custom wording and all 386 questions remain available.

A helper is available in the document's business-brief section and the existing map overview editor. Inputs include a public HTTPS company/About URL, optional pasted description, known site/user counts, scope, service regions, applications, cloud platforms, current technology and the intended change. Source wording and proposed fields are reviewed before an explicit apply action; the user can edit the description, accept individual fields, append to the current brief or explicitly replace it, and include the sector plan.

The local-only `/api/context-preview/business-brief` endpoint reads only public HTTPS pages. DNS results are validated and pinned for the HTTPS request, redirects are revalidated, credentials/private ranges and oversized responses are rejected, and no cookies or browser session are forwarded. Page instructions are untrusted data. Known buyer facts take precedence. Website geography and employee counts do not become required service regions or estate size.

When an existing ANTHROPIC_API_KEY is configured server-side, the existing Anthropic SDK proposes a short description and sector for review. The present local environment has no AI key: the live-tested fallback explicitly says it is source-based, uses page description/source wording plus entered facts, and never claims an AI response. The existing paste-only overview path also remains available. No production routes or data were changed.

Validation: TypeScript check passed; helper URL/address rejection and 10-sector/three-scope plan tests passed; real public-page read and review/apply passed in the browser; accepted 24 sites, SASE, UK coverage, applications and technology reached the shared project; manual extra challenge/question selections survived reapplying the plan. Original page sections and records remain intact. Nothing published or sent to suppliers.


### Four-layer guided journey

The default view opens the business-basics layer. Four permanent stage buttons lead through Your business, Your requirements, Your providers and Your RFP. One named Next action follows missing basics, explicit requirement-plan review, provider selection and document completion. A site or user count is sufficient. Applications, cloud details and full research remain optional.

Requirements offers Use recommended options and continue, alongside Continue with my own selections. Applying a plan keeps existing manual choices and question selections. Changing sector or solution scope prompts a fresh requirement review. A missing business description is completed on the RFP layer after provider selection without sending the buyer back through the earlier layers.

Guided navigation automatically faces and focuses the relevant plane. Manual 360-degree orbit remains available. Other primary layers stay visible as edge markers; inactive detail remains retained in the map. Connections stay behind cards, and the selection legend and zoom controls sit below the diagram. Research download tools and rotation controls remain available through secondary disclosures. On small screens the stage controls use two columns and the map has additional space above its inspector.

Validation: complete local business-to-sector-plan-to-provider-to-RFP journey, real source-linked provider evidence and shared document state, four-layer sequence tests, orbit/connection tests, 30-provider/7,764-row knowledge-map tests and the lossless shared-project contract tests passed. No production publication or supplier sending.


### Compact map-first controls

The sector choices sit in a compact row above one toolbar containing the four stage links, the named Next action and More options. Supporting help, the company overview entry point, optional research/technology links, project status and map settings are retained inside More options. The Living RFP, research downloads and all seven original information sections remain intact. A selected-node editor retains its local Next action.

The visible map footer is reduced to its legend, reset/zoom controls and research-tools disclosure. The toolbar and map adapt to smaller screens. Projected active-layer labels are separated within the usable diagram area after camera motion, resize or panel opening, with a bounded grid fallback for highly crowded projections. Underlying 3D anchors, data, orbit and zoom are preserved. Tests cover crowded six- and nine-card desktop/mobile layouts, all prior orbit behaviour and the shared project contract.


### Journey verification and aligned form controls

Verified manufacturing/SASE with 24 UK sites, explicit sector plan, source-linked provider comparison, provider selection, business brief, timescale, RFI/RFP switch and valid Word export. Direct Living RFP edits to 48 sites and revised business wording update the map and generated document. A complete custom requirement and supplier questions survive Word export. Completed basics and selected providers turn green.

Fixed the next-node cue targeting an inactive detail on another layer: it now points to that layer's visible entry node, then the missing detail after entering. Requirement-stage completion reflects explicit review. More options closes when launching an editor. Inputs/selects share 44px minimum height; checkboxes have aligned 18px controls and full-width selection rows, including company-helper regions and document region layouts. Smaller-screen overflow and checkbox alignment were checked. Original page sections remain unchanged. No publication or supplier messages.


### Product-led buying scope

The scope card opens nine primary products: SD-WAN, Internet & SaaS Security/SSE, Private Application Access/ZTNA, Network Firewall, Endpoint Threat Protection, Identity & Access Management, Data Protection/DLP, Device Management/UEM and Managed Security/MDR. Four additional options are PAM, Identity Threat Protection, Digital Experience Monitoring and Enterprise Browser. The introduction lists the same categories. SASE/SSE/SD-WAN remain additive starting presets; no preset includes endpoint or workforce identity automatically.

Each product has a stable catalogue identifier, included state, buy/replace/retain/explore action, operating model, existing-product/licence wording, catalogue features and full custom feature text. Removed products remain in the local project and backup but are omitted from active matching and the exported RFP. Legacy scope-only projects reopen with a compatible additive starting selection. No existing source records or page sections were removed.

The map has a products plane and a deeper feature plane for each product. The scope node counts included products. Products and features use the same green selection state as the document controls. Higher layers stay reachable from edge markers, including small screens. Large custom-feature sets are represented by an explicit count node opening the complete editor. No wording is shortened in the RFP or project.

The same typed product selections feed the map, editable Living RFP, provider comparison, Word/text exports and project backup validation. Generated requirements identify buying actions, retained subscriptions, product operators, selected features and exact custom tests. Supplier questions distinguish source-linked named product options, capability evidence and unconfirmed editions/licences/integration scope. Existing source qualifications, review states and source links are retained; endpoint and identity product support is never inferred from device-posture checks or an IdP integration. Products with insufficient evidence remain unconfirmed. Core procurement questions can be added with sector defaults; product requirements themselves supply the detailed response schedule, without automatically adding unrelated suite questions. All 386 original questions remain available.

Verified in the browser: select SD-WAN, endpoint and workforce identity; edit/remove features on the map; directly edit retained identity subscription and co-managed operation in the Living RFP; add exact custom failover wording; regenerate provider findings; export a real Word RFP containing 48 sites and all selected product metadata; remove/re-add a product without losing choices; download/reopen the project backup; and check ten product-plane cards without overlap on a 390px viewport. Backend product-contract, original project, journey, orbit, knowledge-map and TypeScript checks pass. Nothing published or sent to suppliers; Neon remains read-only.


### Explicit local saving and marketplace flywheel

Each editing panel now has Save changes & continue, a named next destination and a saved/unsaved status. Fields still update the map and Living RFP as edited. Save validates a working-project snapshot, writes it to this browser's local storage, confirms success and advances only if the saved snapshot still matches the current inputs. Failed validation/storage leaves the user on the current step. View-only document flags and background revision changes do not falsely mark saved choices dirty.

Incomplete drafts can be saved and reopened with missing sector, coverage or counts left missing. The completed-project schema and comparison readiness remain strict. Browser verification saved 6 sites/7 users before choosing a sector, reported unsaved after changing to 8 sites, then saved/reloaded/reopened 8 sites/7 users with no invented sector or region. Storage remains local; nothing is published or sent.

The introduction includes the requested marketplace H1 and an inline, accessible five-stage SVG flywheel: sector requirements, vendor/provider matching, RFI/RFP creation, opportunity publication, and bids/proposals. The standalone SVG is marketplace-flywheel.svg. The original explanatory copy is retained in How the marketplace works, with all product and sector guides still available. The diagram represents the marketplace journey; publication, messaging and demo booking remain explicitly unavailable in this local preview.


### Shallower marketplace header

The large segmented wheel is replaced by a thin horizontal SVG loop showing the same five stages and a return path for refining requirements. The requested H1 and visible product list remain. The previous headline, supporting promise and full explanatory copy are retained under About this marketplace; the full sector guide remains available beside it. Desktop introduction height is approximately 300px at a 1265px browser viewport. On narrow screens the diagram scrolls within its own row. Save, map, RFP and comparison logic are unchanged.


### Centred headline and restored circular flywheel

The requested H1 retains all its wording, with centred offer lines and an emphasised final sentence. A genuine circular SVG flywheel sits alongside it on desktop, with five directional arcs, related topic colours, readable horizontal labels and a central curated-partner count. It stacks below the headline on mobile. The ring replaces the horizontal loop without restoring the earlier large segmented wheel. Existing product listings, expandable explanatory content, sector guide and all original page sections remain intact. The map, save behaviour, comparison and RFP state are unchanged.


### Clickable marketplace flywheel
The five keyboard-accessible stages open the sector map (or its requirements when selected), provider comparison with the existing basics gate, editable Living RFP, anonymous opportunity review, and pricing request preview. Navigation preserves the shared project and never issues a request. Publication and supplier sending remain disabled. The compact circular route replaces the wedge illustration; mobile stage cards remain separate and retain visible focus states.


### Project conversations (local, unpublished)
The new conversation workspace uses the current shortlist, an exact readable share snapshot, separate provider threads, requirement links, unread map badges, and append-only local activity history. Buyers explicitly save local message drafts and reviewed requests. Business descriptions and the full RFP are opt-in attachments; all included content is visible before approval. Changes to recipients, inputs or the attached document invalidate the pending review.

Sample supplier questions, proposal text, demo availability and proposed RFP requirements are conspicuously labelled examples. Accepting a suggestion appends a buyer-approved custom requirement; the original wording and researched provider evidence stay intact. Accepted clauses participate in existing comparison, Living RFP and Word exports. Rejected/accepted decisions cannot be repeated. Conversation state is validated and included in the existing local save/export/reopen contract. Backups restore no identity, credentials or delivery authority. Nothing is auto-sent or silently persisted.

`src/lib/project-conversation-policy.ts` supplies server-side project/audience/scope/expiry and per-provider guards plus exact-content, exact-recipient, current-revision buyer approval checks. MCP tool contracts are defined but are **not registered as live private-project tools**. The send boundary deliberately returns delivery_not_configured after authorization. Existing production identity and MCP routes are untouched.

Not connected: Microsoft OIDC, OTP email delivery from this preview, persistent multi-user messaging, real-time remote transport, supplier identity claims, attachment scanning/storage, Teams/WhatsApp adapters, calendar booking, and durable outbox/idempotency storage. These must be connected behind the same server-side authorization boundary before private engagement goes live. In particular an MCP client must never supply its own trusted actor/grants; actor data comes from validated sessions, and buyer approval records come from the server store. Supplier text and attachments remain untrusted data, not tool instructions. Teams credentials must not substitute for a Netify MCP audience token.

Tests: test-context-conversations.mjs (lossless local state, thread separation, exact review, stale suggestion and identity-forgery rejection); test-project-conversation-policy.ts (authorization and fail-closed delivery); existing product, document, orbit and complete-research regression tests. Browser QA covers compare → recipients → reviewed request → sample suggestion → accept → RFP/map → local save → reopen → Word export. No production writes or supplier communications occur.


### Conversation usability and account-free access review
The conversation surface now separates writing, exact sharing review, and supplier reply context. New outreach is message-only by default. Scope/products, selected requirements, applications/current estate, business description and complete document attachments are individually opt-in. The reviewed snapshot includes the buyer's exact custom message; historical reviewed requests remain inspectable in each thread.

Drafts are per-provider and included in the existing explicit save/backup/reopen flow. Switching providers cannot carry another provider's draft. Disclosure state survives background refresh, direct user actions explicitly leave the editor before rerendering (including Safari-style button focus behavior), Ctrl/Cmd+Enter saves a local note only, and overflow in message starters keeps the original draft rather than truncating. Dirty checking uses the conversation revision instead of cloning and serializing the entire history on every keystroke.

Supplier suggestions use a separate addition review and explicit checkbox. A changed project requires reopening that review. The original supplier context is never rewritten to pass a stale check. Accepting appends a buyer-approved requirement after preflight; duplicate included wording is blocked and retained as a pending suggestion. Conversation messages remain escaped plain text and never modify provider evidence.

`src/lib/project-thread-access.ts` adds an unexposed server-only foundation for account-free thread access. A verified owner can issue a high-entropy, hashed, narrow access token with a bounded lifetime. Redemption requires atomic consume in the store and yields access to exactly one project/provider thread, with read/draft scopes only. Link possession grants neither verified identity nor sending permission. The store adapter, secure session exchange, recipient delivery, revocation endpoint and audit transport are still deployment work; no public link endpoint is exposed by this preview. Live mail, Microsoft, Teams, WhatsApp and remote messaging remain disconnected. No new local-data contract is an authentication credential.

Additional tests: `test-context-room-ui.mjs` covers private sharing defaults, draft separation, stale reviews, original-context preservation and full restore; `test-project-thread-access.ts` covers hashed tokens, concurrent single-use redemption, expiry/revocation, project/tenant/thread isolation and denied sending from link possession.


### Connected buying workspace (local only)
The additional workspace preserves all existing sections. Its six views connect the same map/RFP project to next useful questions, immutable buying plans, evidence requests, proposal comparison, decision records, and delivery/renewal.

Plans capture the complete validated core project and workspace, including retained licences and unselected sector choices. Applying a plan first saves the active project as another plan; conversations and buying history are preserved. Current public provider matching can be run for every saved plan without changing the active map.

Evidence requests copy the published qualification, question, source links and revision. Preparing a request appends to the selected provider's private draft, preserving previous wording and leaving delivery disabled. It never modifies research status.

Proposal entry and structured response templates use an exact requirement-basis digest. Responses for a changed project are rejected rather than attached to the wrong brief. Imported requirement answers are retained in full. Revision saves preserve earlier offer and answer versions. Unknown charges remain null, zero is a valid quote, currencies are never converted, uplift is explicit, and annual charges are pro-rated for comparison only. Fictional examples are conspicuous and cannot support an award decision. Proposal data remains unverified and separate from published research.

Decision records require explicit buyer acknowledgement and freeze the project, exact requirements, commercial response version, source qualifications, source links and evidence revision/fingerprints. They are research records, not signed contracts. Delivery checks use the frozen requirements. Accepted checks require a buyer note. Renewal reviews use user-entered expiry/lead time and can download a calendar file with an optional-to-import seven-day display alert; no calendar, automated notification or supplier workflow is connected.

All models, draft forms, history and nested snapshots are included in the existing save/backup/reopen contract. Snapshots from a different project, malformed offers, unsafe evidence link schemes and imported authority fields are rejected. Local request/import limits are 5 MB for project backups; unsupported sizes fail explicitly without shortening the source. Draft response and form edits persist across view changes. Research rows and the original question banks remain available without truncation.

`buying-workspace-policy.ts` defines a private owner/delegated-agent permission boundary and MCP tool contracts for these actions. These definitions are not registered on the public MCP endpoint. Supplier access to the buyer's other offers/decisions is denied; writes require explicit action consent. Live multi-user persistence, external messaging/identity adapters and private remote-agent transport remain integration work, not enabled by this local preview.

Tests: test-buying-workspace.mjs, test-buying-ui.mjs, test-buying-backup.ts and test-buying-policy.ts, plus existing conversation/project/product/map regressions. Browser checks cover alternative-plan switching with conversation preservation, current matching of all 30 providers per plan, proposal entry/revision/import with full answer retention, decision-to-delivery handoff, renewal calculation and full project save/reopen.


### Map navigation
A visible navigation strip provides Back/Forward (visited locations), Up a level (the contextual parent), clickable ancestor breadcrumbs, Overview and Fit view. Product features, provider evidence, research paths and RFP sections retain their own parent hierarchy. Closing details keeps the current map level; Up changes levels. Opening a map task from a lower page section brings the map controls into view. The Living RFP return link returns to the map rather than the introductory header. Escape moves up and Alt+Left/Right navigate history when focus is in the map workspace, never while typing. History is temporary view state and does not undo selections or modify project data. Breadcrumbs scroll independently on small screens and full wording remains available in accessible labels.

Navigation checks: `node scripts/test-map-navigation.mjs`, existing orbit/knowledge/journey/conversation/buying UI tests, and isolated browser traversal of products/features, research records, providers and RFP sections.


### Map motion
Camera input paints at most once per animation frame. Drag rotation uses lower sensitivity with filtered, capped release velocity and shorter inertial decay. Wheel deltas account for pixel/line/page units, accumulate into an eased zoom target and stop when a direct drag begins. Level focus interpolates position, logarithmic zoom and shortest-path quaternion orientation together, rather than snapping the angle first. Reduced motion bypasses easing and inertia. Camera-only frames reuse node definitions, DOM elements and measured card dimensions; state edits and resizes invalidate those measurements. Cards use compositor transforms, connections use the same projected coordinates, and crowded fallback layouts retain node order. Research detail uses separate enter/exit zoom thresholds to avoid rebuilding the page repeatedly near one threshold.

`node scripts/test-map-motion.mjs` checks frame coalescing, eased zoom, orientation continuity, completion and interruption. Existing orbit tests retain full rotation, touch/pinch, click suppression and reduced-motion coverage.
