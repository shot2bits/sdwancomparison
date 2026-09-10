# DEF-08 application header verification

Date: 3 September 2026

The RFP Builder renders one application header. The marketing header is suppressed inside the procurement workspace, and navigation between Requirements, Review and Publish does not create a second application header.

Automated coverage in `scripts/validate-rfp-repair-pass.mjs` checks the hydrated DOM at 390, 768, 819, 820, 821, 1024, 1280, 1440 and 1728 pixels. It requires exactly one `.lpos-header`, exactly one `h1` and no synthetic `role="heading"` element at level one at every width. It repeats the heading assertions after a project has started and the buyer has navigated to Review.

The same suite checks that the application rail stays inside its shell and cannot overlap the canonical page heading, definitions or entrance controls.
