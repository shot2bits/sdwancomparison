# RFP Builder repair baseline

- Baseline commit: `8e0c94e`
- TypeScript: passed
- ESLint: passed with no warnings or errors
- Canonical-page validator: 54 checks passed
- Publication-policy suite: 12 policy tests and the persisted KV test passed
- Non-mutating production build: passed, 274 static pages generated
- Canonical browser journey: passed on desktop and mobile
- Browser, Googlebot and Bingbot live-shape suite: 54 checks passed
- Existing `validate-rfp-builder-flow-ui.mjs`: stalled after its third assertion on the untouched baseline and is retained as a regression to diagnose
- Dependency install: npm reported 10 existing advisories. No dependency or lockfile changes were made to address them in this repair pass.

The repair pass uses `npm run build:nonmutating`. The existing `npm run build` invokes `scripts/apply-vendor-overrides.ts` and is not used as a validation gate because validation must not rewrite governed provider data.
