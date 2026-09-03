# Rollback point: RFP canonical page work, 3 September 2026

Recorded 2026-09-03 08:40 UTC before any change for the "sd-wan rfp" / "sase rfp" canonical page work.

## Vercel production at capture time

Both projects deploy production from branch `codex/sase-marketplace-foundation`.

| Project | Vercel project id | Production commit | Production deployment | Deployed (UTC) |
| --- | --- | --- | --- | --- |
| sasecomparison (repo shot2bits/sdwancomparison, serves netify.co.uk/sase/* and the apex rewrite for /sase-sd-wan-rfp-builder/) | prj_confIOHiitAyJxBa82WsX7ylRldv | 1c448895dc72aa54a070f72e302b7cb7ce227ec3 "fix: align main navigation and question metadata" | dpl_5N67F2kb8FmD52FTpR8AqMhdh1XZ (READY, isRollbackCandidate) | 2026-09-02 21:49:28 |
| v0-broadband-reseller-framework (repo shot2bits/netify-bt-broadband-reseller, apex netify.co.uk) | prj_8OQLyuwrhFl9VlDQU6eS55aVjkdF | c4e384817531d1dd8ce2f84f37a50e87650145b6 "fix: align healthcare navigation and reseller title" | dpl_GDSt2HoaxZK9Pgw8Jme4CrWcVKD7 (READY, isRollbackCandidate) | 2026-09-02 21:49:28 |

Team: netifymarketplace (team_gev5QnK6hQrPeysmmmoQzZ4M).

Previous READY production deployments (next rollback candidates back): sasecomparison dpl_Z18ZFvLBvzTrVsdTGYZNXr1wwfsX (5e2b59b); apex dpl_JDqjDTBxRQ91zy5KKcAbAGZepgmM (7692263).

## Git at capture time

- sdwancomparison: fresh clone of origin/codex/sase-marketplace-foundation at 1c44889, clean working tree. Work branch `rfp-canonical-page-sep-2026` created from it.
- netify-bt-broadband-reseller: not readable from the build environment (private repository, no credentials). Production commit c4e3848 is the rollback reference. The copy in the project folder (netify-site/) is on `btcv-calculator-preview` at af1e508 dated 2026-06-15 and must be fetched before any apex change.

## Roll back

Vercel dashboard, project, Deployments, the deployment id above, "Instant Rollback"; or revert the feature commits on `codex/sase-marketplace-foundation` and push.
