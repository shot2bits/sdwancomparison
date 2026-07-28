# The Netify supplier vetting standard — DRAFT for Robert's approval

**Status:** DRAFT, 29 July 2026. Not yet published, not yet citable. Robert ruled the four promises cannot ship until this standard exists, is true and is documented; this draft states only checks that run today, so approving it makes the promises checkable rather than asserted. Once approved it publishes as a page (Harry writes the rendered copy from it) and the promise copy cites it.

## What "vetted" means on Netify

A vendor or service provider can see and respond to buyer opportunities only after passing every check below. No supplier reaches a buyer's room, requirement or contact details without them.

1. **Verified work email at the supplier's own domain.** Sign-in is by a one-time link or code sent to the address; completing the round trip proves control of the mailbox. Free webmail, disposable addresses and academic domains are rejected for every role, from a maintained blocklist of ~140 domains plus a live extension list.
2. **The domain must belong to a recognised supplier.** Known vendor domains are compiled from the evaluated vendor dataset and admin-managed overrides. An address at an unrecognised domain does not get access: it lands in a pending queue and a named Netify admin approves or rejects it by hand. Rejections are recorded.
3. **Evaluated vendors carry an evidence record.** The comparison dataset behind supplier matching holds per-vendor capability evaluations with evaluation dates, and is moving to per-fact source records (the 2026 rebuild). Suppliers are matched to opportunities from this dataset, not from self-description.
4. **Scoped access, not browsing rights.** A vetted supplier sees public notices like anyone else; the gated room, the full requirement and any response mechanics open per opportunity, by the buyer's own settings (open to matching vetted vendors, or invite-only).
5. **Contact details move last.** Buyer contact information is never in any public projection and never shown to a supplier by default. Pricing submitted by one supplier is never visible to another. (Introduction acceptance, arriving with the current build: contact details pass to a specific supplier only when the buyer accepts that introduction.)

## What this standard does not claim

Netify does not audit suppliers' finances, insurance or certifications unless stated on the evaluation record; it does not guarantee commercial outcomes; and it does not vet the buyer side beyond business-email verification. The standard covers who can respond to opportunities and how buyer information is protected while they do.

## Enforcement facts (where each check lives)

Email round trip and blocklist: the auth request and verify routes plus FREE_EMAIL_DOMAINS in access-control. Domain recognition and the pending queue: vendor-domains plus the admin console's approve and reject actions. Evaluation records: the vendor dataset with evaluation dates. Room scoping: opportunity eligibility and per-vendor invite tokens. Pricing privacy: the feed masking rule, each supplier sees only its own amounts. Contact protection: owner_email exists in no public projection.
