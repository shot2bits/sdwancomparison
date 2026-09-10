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

## Production update, 10 September 2026

LIVE: version 1009261313, Git main commit 1e54d7b4fd21976daedb53fe77cbf1890bbfef99. Deployment dpl_CSvrVYSJzWa7q3kQdoJT8SG3aufQ (sasecomparison-mnuc3o1a5-netifymarketplace.vercel.app), built automatically from Git. Includes Harry fixes 5d2ad0b and Claude shortlist changes 47c0d4d. No working-tree production deployment used.

IMPORTANT: the public site's proxy uses sasecomparison-netifymarketplace.vercel.app. Git production deployment did not update that existing alias; explicitly assigned it to the above Git deployment. Future releases must verify this alias as well as Vercel production status. Do not assume production Ready means netify.co.uk has changed.

Live browser checks: public builder version; 900 total and 30 remote users retained after correcting 15 to 18 sites; inline bandwidth error on blur; shortlist loads with Claude's updated view. No browser errors observed in those checks. Full 168-case acceptance remains outside these smoke checks. This documentation follow-up branch records the live result without another production build.
