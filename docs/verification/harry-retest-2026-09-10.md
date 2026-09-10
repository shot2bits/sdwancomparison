# Harry retest fixes, 10 September 2026

## Scope and baseline

Harry's document references 0809261609. The live builder showed 0909261558 during this run. Work started from remote 7a8263f on its own branch; no Claude changes reverted. No production configuration changed and no CLI deployment used.

## Reproduced and fixed

- Live: 900 total users plus 30 remote users showed only 900. A subsequent remote-user statement replaced the generic count. Added separately validated estate.remoteUsers, retained estate.users for total/unqualified scope, and included both in document summary, ledger labels, brief and resume merge. Models quoting a remote count cannot replace the general count. A remote-only scope no longer implies that it represents all staff.
- Candidate browser: entered 900 total / 30 remote / 15 sites, corrected to 18 sites, switched depth, reloaded and resumed. Both counts and 18 sites remained visible.
- Bandwidth: live Save rejects 10003 months. This does not reproduce Harry's claimed successful invalid save. Added field-associated feedback on blur and aria-invalid using the same schema; candidate showed the message, and 1 Gbps clears the field error.
- Darkened muted text on project introduction, format descriptions, notice preview, recovery and saved status. Layout and features retained.

## Reported concerns not reproduced as loss

- Site correction from 15 to 18 worked on live after processing completed.
- Bespoke QA-SEP10 question added through section question controls, switched to Short, reloaded, explicitly resumed and returned to Detailed. Exact question visible under expanded captured requirements.
- Phone-size navigation opens/closes with its named toggle. Browser emulation only, not a physical-device certification.
- Resume screen is an explicit choice, not an empty recovered project.

## Checks

Full npm run validate passes including acceptance save, correction, comparison, auth return, supplier route privacy and the new count regression. Targeted changed-module lint and TypeScript passed. The new tests also cover reverse count ordering, negative/fractional/ambiguous remote counts and broad model quotes.

Tests that previously mapped explicitly remote users into the generic count were updated to assert the distinct field. The readiness fixture is three points lower when a remote subset is supplied without a total, while correction/reversal behaviour remains asserted. The canonical persistence fixture uses an unqualified user count so its existing tombstone test retains its original purpose.

## Remaining acceptance limits

No real public test notice, supplier message, quote email or order was created. Real inbox delivery, supplier response and NDA accounts, physical devices, full file-format manual coverage and installed external MCP clients still need their designated fixtures. These remain unverified, not passed. No claim that all 168 cases are complete or that every reported issue has been independently reproduced.

Production build: npm run build:nonmutating passed (optimized Next.js build, TypeScript and page generation). Production Branch verified as main. This branch is not deployed to production.

## Live release supersedes the preceding not-deployed status

10 September: main 1e54d7b, version 1009261313, Git-built production deployment dpl_CSvrVYSJzWa7q3kQdoJT8SG3aufQ. Claude's 47c0d4d shortlist change preserved. Public proxy alias explicitly moved to this deployment after it remained on an older build. Actual netify.co.uk browser checks passed for count capture/correction, inline bandwidth feedback and shortlist loading. No browser errors observed in checked sessions. See HANDOFF.md for alias coordination.
