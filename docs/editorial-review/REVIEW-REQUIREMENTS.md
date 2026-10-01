# Provider assessment release requirements

The working pack contains all 30 providers, captured from the live Neon-backed public dataset on 1 October 2026. It includes the existing imported editorial text and its original revision label, source register, capability grades and current projection qualifications. The imports are not treated as newly approved assessments.

For each provider, the writer must supply a conditional buyer fit, concrete strengths, trade-offs and source URLs. The reviewer must check the cited sources against the specific claims and the current evidence, including delivery partners, geography and sector limitations. An absent public claim must not become a claim that a capability is absent. A worldwide or UK entity does not establish circuit availability at the buyer's addresses.

Record the actual reviewer, role, approval date, review expiry and evidence fingerprint in `data/provider-editorial-reviews.json`. The public page and JSON feed omit incomplete, expired, future-dated or evidence-mismatched approvals. They never show an invented reviewer or a public approval-pending badge. The technical guard is not a substitute for conducting the review.

No new provider editorial approvals were supplied during this implementation. The public provider evidence remains available for all 30 providers. The conditional operating-model groups describe recorded evidence, not a quality ranking or supplier-confirmed recommendation.

The page-level reviewer in `data/shortlist-review.json` also remains unassigned. Names and approval dates must be supplied by the actual reviewer after review, not inferred from prior authorship.
