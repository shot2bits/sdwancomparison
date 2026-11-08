# Admin access repair — 8 November 2026

Scope: support@netify.com signs in by ordinary email code, sees projects and supplier replies, and approves supplier profiles. Existing administrator allowlist and buyer ownership rules are unchanged.

Hosted baseline: support email-code sign-in succeeded on the isolated preview and an explicitly synthetic Fortinet profile request was approved through the actual admin UI. No production supplier profile was changed.

Found: project links entered the buyer workspace, which refused the admin as a different owner; Studio supplier replies were counted through a legacy response key and displayed zero; failed overview loads could leave an indefinite loading screen.

Fix: admin-only, read-only project detail projection/page with brief, contact, question selection, bid requests and private conversations; server identity checks before any project read and no owner-token issue or buyer action. Studio overview counts now count responding suppliers from durable requests. Admin sign-in updates on the same screen, sign-out is explicit, expired sessions return to verification, load failures show Retry. Projects and Supplier approvals appear first; existing specialist reports remain available.

Verification so far: real Redis route tests include actual support email-code verification, admin overview, reply counts and private read-only detail, plus ordinary buyer/anonymous denial and supplier approval; whole AdminClient browser-component tests cover code sign-in, failed-load retry, correct project links, approval, sign-out and session expiry. TypeScript and scoped lint pass. Hosted final-candidate and live checks remain pending. No production test project or supplier approval.
