# Circuit pricing production rollout

Implements the approved circuit marketplace using real private storage, verified buyer sessions and the existing anonymous Opportunity Board. No demo records, quotes, fake verification or fake sourcing actions are shipped.

Buyer: UK/international fixed connectivity and quantity-based remote SIM groups; bandwidth, data needs, local overseas contact, resilience/RA02 requests, active/passive or load balancing, optional router, optional UK Fortinet/Meraki, optional UK remote CrowdStrike at £4.99 + VAT per device. Billing period and package remain for quote confirmation. CSV and Excel import require review. Existing RFP workspace remains mounted when navigating into Circuit pricing.

Publication: account-owned private drafts, revision conflict detection, retry-safe saves, explicit buyer consent, live domain blocklist checks, deterministic anonymous board notice. Exact addresses/company/local contacts stay outside public projections. Published specifications freeze; new requests preserve prior quote context.

Sourcing: authenticated allowlisted Netify admin queue, real location-bound supplier quotes with currency, rent, installation, term, validity, lead time, SLA, confirmed resilience, exclusions and HTTPS evidence. Buyer email is sent via existing Resend transport; response status checked, failed send visible and retryable, idempotency keys prevent duplicate delivery on retries. New publication also alerts the configured Netify sourcing address. Tests intercept all external emails.

MCP: public schema-based request validation and owner-issued 1-hour read token for private specs/quotes. Replacement revokes old token. No universal OAuth claim, no MCP publication or ordering. Registry now describes 46 actual tools.

Checks passed: circuit schema/core and real API permissions in fake KV; private-to-public redaction; consent; frozen requirements; save/quote idempotency; notification failure/acceptance/retry; token revocation; buyer desktop1440/mobile390 browser flow; admin quote UI/failure state; CSV/XLSX import; TypeScript and scoped lint; complete existing marketplace foundation and npm validate; existing full/short/bespoke/source preservation browser regressions; optimized local production build. Browser writes intercepted; no real opportunities/emails created by tests.

Rollout: stage a production-environment candidate without moving domains; verify candidate routes and controlled browser flow, then promote that exact release and verify canonical builder and circuit pricing.
