# Corrective sourcing release — 30 September 2026

Acceptance specification: amended review at `claude/action-first-review-2026-09-30`, commit `4550c0219cce7f64929ca04d95f9f498c49f8fd3`. Work starts from main `e8cdcbd50c3d50a42c686c826f4e53df4676415c`, preserving the Harry user-count fixes.

## Code and executable evidence

- F1/F7: `src/lib/sourcing-access.ts`, `src/app/api/auth/request/route.ts`, confirmation route/component and private project sign-in. `scripts/test-sourcing-routes.ts` requests and redeems a real magic token through the actual auth handlers. It rejects another email, reopens the private project without the first-device grant, and checks expired/reused/concurrent confirmed links produce no cookie. Pending links still expire after one hour.
- F2/F14: `src/lib/sourcing-store.ts`. Reserve before charging limits; atomically save the record and exact mail payload. Ten-second mail timeout. Retries use the existing record, persisted body and identical Resend idempotency key. Tests cover failures before transport acceptance and lost receipts after provider acceptance, with exactly one accepted email. A short initial reservation expires if preparation crashes; successful preparation extends idempotency to 24 hours.
- F3/F4: shared `sourcing-contract.ts`, home/how-it-works/RFP entry, activation email, public APIs and companion apex metadata. Research coverage no longer promises a participating response panel. The undertaking describes desk work and an agreed timetable without inventing a proposal count/deadline. `test-sourcing-target.ts` exercises JSON-LD, llms and MCP from the same contract. Existing publication-disclosure checks retain their privacy assertions; two old assertions requiring retired marketing promises were replaced.
- F5/F8: `provider-projection-review.ts`, `evidence-review-health.ts`, desk endpoint/banner and provider cards/feed/MCP. Distinct expired/source-newer states. UK sector evidence is copied from the existing sign-off sheet, not inferred from a headquarters address. Colt comparison slug corrected in the sheet. No grades or owner approvals fabricated. All build paths run the operational/review-window gate, including nonmutating builds.
- F6: JSON desk email fallback, environment override validation, explicit buyer wording when desk delivery remains pending, independent durable notifications and pending counts in the existing daily digest. Tests verify the approved fallback address with captured mail, plus invalid override/retry handling.
- F10: source mapper accepts known utm/referrer hostnames without retaining URLs. Weekly staff-only `/sase/api/sourcing/metrics/` counts plan, request, confirmed, desk-notified and recorded sourcing milestones by environment/source. Duplicates are suppressed. Counts describe actions, not unique buyers or proven citations; Google AI and traditional referrals are not separable. Metrics are bounded to the latest 10,000 events and last 90 days.
- F11: fake store now expires keys and supports PTTL. `scripts/test-sourcing-real-redis.mjs` starts its own loopback-only disposable Redis server and runs the actual route suite against real Lua/TTL behaviour. Never uses deployment Redis credentials. GitHub workflow repeats this on changes and nightly.
- F12/F13: plan origin check and 30-per-minute per-IP throttle; direct MCP plan calls share the throttle. Read-only access remains public. Need/action labels are human-readable in briefs, confirmation and desk email.

## Checks to reproduce

```sh
npm run test:action-first
npm run validate
npm run build:nonmutating
npm run test:sourcing-real-redis # redis-server and redis-cli on PATH
```

Real Redis local runner accepts `NETIFY_REDIS_SERVER` and `NETIFY_REDIS_CLI` paths. The test mail transport is captured/stubbed: no real customer, supplier or desk email is sent. Local browser uses `http://localhost:3127`, matching Next's development request origin; the 127.0.0.1 alias fails the same-origin guard by design.

Extended copy check: case-insensitive `competing bids|bids come back|sign in only to bid|30\+ (vendors|providers)|(vendors|providers) respond|best-matched vendors respond` over SASE `src/` and apex `app/` must return no matches. Historical review/test documentation is not live copy.

## Owner decisions still outstanding

- Sign or explicitly re-review/extend 19 sector adjudications and four UK carrier reviews **before 16 October 2026**. Current evidence expires 30 October. Build gate alerts from 14 days before expiry; runtime keeps expiry safeguards. No automatic extension.
- Supplier participation, named contacts, introduction terms and response commitments require written commercial confirmation.
- Harry's editorial approval remains outstanding. No numerical proposal or working-day undertaking has been filled in.
- This corrective release cannot establish citation/click uplift on launch day. Keep the collected baseline and measure buyer action over a meaningful period.

## Production verification

Deployment identifiers, source commits and actual live checks will be appended after deployment. Local test success is not a statement that a production email was sent or that supplier commitments were obtained.
