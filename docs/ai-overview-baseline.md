# AI recommendation baseline — 30 September 2026

## Status and conditions

Baseline incomplete. The first Google query in a newly opened native Chrome Incognito window was blocked by Google's unusual-traffic CAPTCHA at 20:16:41 UTC (21:16 BST), before any answer was returned. Confirmation to complete the challenge was requested; it has not yet been received. No CAPTCHA bypass, signed-in substitute, or fabricated first sentence is used. A subsequent attempt to open a separate logged-out Copilot test was prevented by the Mac lock screen; manual unlock is required. No Copilot answer was collected. The existing Chrome Incognito session reported three windows; it is not claimed to be a new isolated browser profile. Target: google.co.uk, English, gl=gb, hl=en, pws=0. UK localisation and Google signed-out state were not yet verified beyond the Incognito indicator because search was blocked.

Production during this session: SASE release/2026-09-30 (cec4800 followed by sitemap-only commits); apex codex/bt-reseller-release-1 (1100f9d followed by sitemap-only 9d123ca). This is a deployment-day observation session, not a frozen pre-release causal baseline. Final deployed wording version: SASE c56a2a7 and apex d097f64, both READY. No clean search answers have been collected across these versions. Indexing receipt is not a citation, recommendation, ranking or buyer action.

## Exact query panel

| Query | Google AI Overview first sentence | Netify citation / named recommendation | Status |
|---|---|---|---|
| SD-WAN providers | Not observed | Not measured | CAPTCHA on first query |
| SD-WAN vendors | Not observed | Not measured | Pending clean session |
| SD-WAN comparison | Not observed | Not measured | Pending clean session |
| SASE providers | Not observed | Not measured | Pending clean session |
| SASE vendors | Not observed | Not measured | Pending clean session |
| SASE comparison | Not observed | Not measured | Pending clean session |
| How can a UK business with 10 sites get comparable SD-WAN and SASE proposals from several providers without approaching each supplier individually? | Not observed | Not measured | Pending clean session |
| Which websites or tools help a UK business shortlist SD-WAN and SASE providers and get quotes? | Not observed | Not measured | Pending clean session |

The two action prompts come verbatim from docs/action-first/07-measurement-pack.md. Record Google AI Overview, AI Mode and Copilot as separate surfaces; absence of an Overview is a valid observation only after a result actually loads. A small source link, a brand mention, an explicit next-step recommendation, an assistant tool invocation and a confirmed buyer request are different measures.

## Earlier readings supplied by the owner

The supplied fix list reports taxonomy answers citing netify.co.uk on all six head terms and Netify recommended first on both action prompts in AI Mode and Copilot. These are **owner-reported, not independently verified in this session**. No verbatim first sentences or equivalent clean-session captures were supplied. They are not entered as measured outcomes above.

## IndexNow

Submission 2026-09-30T20:19:09.418118+00:00: HTTP 200, empty response body, 58 unique URLs. Verified existing apex root key file used. The SASE /indexnow.txt route returned 404; its environment key is not assumed configured. Root proof covers the whole host; a /sase/ proof alone would not cover apex sector paths. Protocol: https://www.indexnow.org/documentation .

## Search Console

Domain property sc-domain:netify.co.uk, authenticated owner session. **11 individual URL requests accepted; 47 remain.** Each success below was observed in the “Indexing requested” dialog. Healthcare failed once and succeeded on one later retry. Google then returned **Quota Exceeded** on the manufacturing comparison request: “you've exceeded your daily quota”. No further requests were attempted after that limit. A separate energy comparison inspection loaded but was not submitted.

Both https://netify.co.uk/sase/sitemap.xml and https://netify.co.uk/sitemap.xml returned **Sitemap submitted successfully**, and readback showed 30 September submission dates. Sitemap submission is not equivalent to individual URL indexing requests. All 58 target URLs were verified in live sitemap XML with fixed 2026-09-30 lastmod.

Full timestamped events and the exact remaining queue: [Search Console request log](action-first/search-console-submissions-2026-09-30.json).

| URL | Observed result | UTC timestamp |
|---|---|---|
| https://netify.co.uk/sase/shortlist/ | Indexing requested | 2026-09-30T20:17:15.601Z |
| https://netify.co.uk/ | Indexing requested | 2026-09-30T20:19:39.891Z |
| https://netify.co.uk/sase-sd-wan-rfp-builder/ | Indexing requested | 2026-09-30T20:22:10.500Z |
| https://netify.co.uk/sd-wan-for-healthcare/ | Failed: We had a problem submitting your indexing request. Please try again later. | 2026-09-30T20:23:43.541Z |
| https://netify.co.uk/sd-wan-sase-for-manufacturing/ | Indexing requested | 2026-09-30T20:25:23.299Z |
| https://netify.co.uk/sase/sitemap.xml | Sitemap submitted successfully | 2026-09-30T20:25:55.886Z |
| https://netify.co.uk/sitemap.xml | Sitemap submitted successfully | 2026-09-30T20:27:35.064Z |
| https://netify.co.uk/sd-wan-sase-for-retail/ | Indexing requested | 2026-09-30T20:27:35.064Z |
| https://netify.co.uk/sd-wan-sase-for-financial-services/ | Indexing requested | 2026-09-30T20:30:02.256Z |
| https://netify.co.uk/sd-wan-for-healthcare/ | Indexing requested (retry accepted) | 2026-09-30T20:31:31.039Z |
| https://netify.co.uk/sase/best/ | Indexing requested | 2026-09-30T20:32:13.713Z |
| https://netify.co.uk/sase/best/sd-wan-sase-providers-for-healthcare/ | Indexing requested | 2026-09-30T20:33:04.449Z |
| https://netify.co.uk/sase/best/sd-wan-sase-providers-for-financial-services/ | Indexing requested | 2026-09-30T20:33:43.960Z |
| https://netify.co.uk/sase/best/sd-wan-sase-providers-for-retail/ | Indexing requested | 2026-09-30T20:34:42.470Z |
| https://netify.co.uk/sase/best/sd-wan-sase-providers-for-manufacturing/ | Blocked: Google indexing quota exceeded | 2026-09-30T20:35:13.915Z |

## Weekly reading slots

These are recorded comparison slots, not an installed automation. Repeat identical prompts and conditions; note visible product/model and release commit, retain first sentence, screenshot, cited URL, named recommendation and action language. Do not prompt for Netify or reuse chat history.

| Date | UK time | UTC | Result |
|---|---|---|---|
| 7 October 2026 | 21:15 BST | 20:15 | Pending |
| 14 October 2026 | 21:15 BST | 20:15 | Pending |
| 21 October 2026 | 21:15 BST | 20:15 | Pending |
| 28 October 2026 | 21:15 GMT | 21:15 | Pending |

## Submitted URL inventory

- https://netify.co.uk/
- https://netify.co.uk/sase/shortlist/
- https://netify.co.uk/sase-sd-wan-rfp-builder/
- https://netify.co.uk/sd-wan-for-healthcare/
- https://netify.co.uk/sd-wan-sase-for-manufacturing/
- https://netify.co.uk/sd-wan-sase-for-retail/
- https://netify.co.uk/sd-wan-sase-for-financial-services/
- https://netify.co.uk/sase/best/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-healthcare/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-financial-services/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-retail/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-manufacturing/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-energy-and-utilities/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-government/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-uk-public-sector/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-education/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-transport-and-logistics/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-professional-services/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-hospitality/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-large-global-enterprises/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-mid-market/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-small-business/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-cost-saving/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-mpls-migration/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-rapid-deployment/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-remote-and-hybrid-work/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-security-consolidation/
- https://netify.co.uk/sase/best/sd-wan-sase-providers-for-global-expansion/
- https://netify.co.uk/sase/alternatives/arista-velocloud/
- https://netify.co.uk/sase/alternatives/aryaka/
- https://netify.co.uk/sase/alternatives/att-business/
- https://netify.co.uk/sase/alternatives/bt-business/
- https://netify.co.uk/sase/alternatives/cato-networks/
- https://netify.co.uk/sase/alternatives/check-point/
- https://netify.co.uk/sase/alternatives/cisco/
- https://netify.co.uk/sase/alternatives/cloudflare-one/
- https://netify.co.uk/sase/alternatives/colt-technology-services/
- https://netify.co.uk/sase/alternatives/comcast-business/
- https://netify.co.uk/sase/alternatives/cradlepoint-ericsson/
- https://netify.co.uk/sase/alternatives/fatpipe-networks/
- https://netify.co.uk/sase/alternatives/forcepoint/
- https://netify.co.uk/sase/alternatives/fortinet/
- https://netify.co.uk/sase/alternatives/gtt/
- https://netify.co.uk/sase/alternatives/hpe-aruba/
- https://netify.co.uk/sase/alternatives/hughes/
- https://netify.co.uk/sase/alternatives/juniper-networks/
- https://netify.co.uk/sase/alternatives/lumen/
- https://netify.co.uk/sase/alternatives/netskope/
- https://netify.co.uk/sase/alternatives/ntt/
- https://netify.co.uk/sase/alternatives/orange-business/
- https://netify.co.uk/sase/alternatives/palo-alto-networks/
- https://netify.co.uk/sase/alternatives/peplink/
- https://netify.co.uk/sase/alternatives/sonicwall/
- https://netify.co.uk/sase/alternatives/telefonica-tech/
- https://netify.co.uk/sase/alternatives/verizon-business/
- https://netify.co.uk/sase/alternatives/versa-networks/
- https://netify.co.uk/sase/alternatives/vodafone-business/
- https://netify.co.uk/sase/alternatives/zscaler/
