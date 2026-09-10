# Netify buying platform handoff

Read this before changing the repository. Use one work branch per assistant and task. Fetch before starting and synchronise before pushing. Merge reviewed work; do not commit directly to a shared integration branch. Do not use CLI production deployments from a working tree.

Repository: shot2bits/sdwancomparison (this is not the BT reseller repository).
Vercel project: sasecomparison, prj_confIOHiitAyJxBa82WsX7ylRldv, team netifymarketplace.
The BT reseller branch codex/bt-reseller-release-1 and its deployment settings do not apply here.

## 10 September 2026: Harry retest fixes

Work branch: codex/harry-retest-fixes-2026-09-10.
Based on origin/codex/publication-first-comparison at 7a8263f, preserving Claude's sector evidence MCP and manufacturing canonical changes. No previous HANDOFF.md existed on that branch.

Changes: distinguish total users from remote users in extraction, storage, labels and supplier document; retain both through corrections and resume; clearer inline bandwidth validation feedback; darker workspace help and status text. Legacy estate.users facts remain readable. Do not infer that historic generic counts are totals or remote counts without their source.

Verification: see docs/verification/harry-retest-2026-09-10.md. No production CLI deployment performed. Do not call this a full 168-case acceptance sign-off.

Vercel Git link verified read-only on 10 September: GitHub shot2bits/sdwancomparison, Production Branch main. Pushes to this work branch are not production releases. Integration into the production branch remains outstanding.
