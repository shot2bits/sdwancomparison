# AI recommendation baseline — 30 September 2026

## Verified session and limits

**Google AI Overview panel complete: eight observed answers, logged out with UK results.** Collected 20:38:54–20:41:28 UTC (21:38–21:41 BST). Native Chrome Incognito; google.co.uk; gl=gb, hl=en, pws=0. Every captured result exposed “Sign in” and “United Kingdom”. Each query was a separate ordinary search, not a conversational follow-up. Overviews were expanded when an expansion control was present. The Incognito session reported three windows, so this is not claimed to be a new isolated browser profile. IP, device and same-session effects can remain even when logged out. One observation per query; no repeatability or population estimate claimed.

Earlier at 20:16 UTC the first search was CAPTCHA-blocked, and later the Mac locked. The owner then said “Done”; the next observation showed the loaded SD-WAN providers result. No CAPTCHA was solved by the agent. That first result resumed the earlier attempted query; the other seven were newly entered after unlock.

Final deployed source during collection: SASE c56a2a7, apex d097f64, both READY. Search titles and excerpts still showed older research/publication wording. This is a deployment-day baseline, not a controlled before/after experiment and not evidence that today's release caused any recommendation. AI Mode and Copilot have not been independently retested in this session; do not extrapolate these Google AI Overview findings to them.

## What this run shows

- Broad terms: Netify cited in three of six expanded Overviews (the three SD-WAN terms); no named next-step recommendation in any of the six.
- Action prompts: Netify named as a useful procurement route in both; the second opens with Netify and lists it first among dedicated tools.
- Accuracy caveat: the first action answer says the system forces 30+ UK carriers and vendors to respond in one format. This is false relative to the live service: 30 researched providers are not 30 contracted responders; the response panel remains empty and targets are agreed individually. A named recommendation carrying invented fulfilment claims is not an unqualified success.
- Google still offering to do the buyer's narrowing itself supports separating source attribution from referral intent. None of this establishes CTR uplift or completed buyer action.

## Observed first sentences

The following are transcribed AI-generated answers, not Netify's endorsed claims. Inline link text is rejoined and whitespace normalised. Broad claims such as “leading overall” are observations of the answer, not validated vendor rankings.

| Query | First sentence | Netify assessment |
|---|---|---|
| SD-WAN providers | Leading Software-Defined Wide Area Network (SD-WAN) providers include technology vendors that build the core platforms and managed service providers that deliver them as a service. | Source citation only; no next-step recommendation. |
| SD-WAN vendors | Major SD-WAN (Software-defined Wide Area Network) vendors include Cisco, Fortinet, Palo Alto Networks, and HPE Aruba, which combine intelligent traffic steering with cloud security frameworks. | Source citations within vendor/selection guidance; no next-step recommendation. |
| SD-WAN comparison | Software-Defined Wide Area Network (SD-WAN) solutions let businesses connect branch offices and cloud apps faster and cheaper by replacing rigid legacy lines with smart traffic routing. | Source citations within comparison guidance; no next-step recommendation. |
| SASE providers | Cisco is the leading Secure Access Service Edge (SASE) provider overall in 2026, combining balanced enterprise networking and cloud security at scale. | No visible Netify citation or recommendation in expanded Overview. |
| SASE vendors | Leading Secure Access Service Edge (SASE) vendors converge software-defined wide-area networking (SD-WAN) with cloud-delivered security services like Zero Trust Network Access (ZTNA) and Secure Web Gateways (SWG), with top providers varying by enterprise architecture and primary use case. | No visible Netify citation or recommendation in expanded Overview. |
| SASE comparison | Secure Access Service Edge (SASE) converges software-defined wide area networking (SD-WAN) and cloud security (SSE) into a unified, cloud-delivered model. | No visible Netify citation or recommendation in expanded Overview. |
| How can a UK business with 10 sites get comparable SD-WAN and SASE proposals from several providers without approaching each supplier individually? | To get comparable SD-WAN and SASE proposals for a 10-site UK business without the administrative headache of approaching each supplier individually, you should bypass traditional direct procurement. | Named as an example in the first recommended procurement route. Contains inaccurate supplier-response claims; not an unqualified success. |
| Which websites or tools help a UK business shortlist SD-WAN and SASE providers and get quotes? | Netify's SD-WAN & SASE Shortlist and Research Platform helps UK businesses compare providers, build RFPs, and estimate costs. | Names Netify in the opening sentence and lists it first under dedicated tools/platforms. |

Full timestamped accessibility excerpts: [clean Google baseline](action-first/clean-google-baseline-2026-09-30.json). Captures retain the answer area, not the browser address bar or authentication query parameters. Citation destinations were exposed as Google redirect links; the visible netify.co.uk attribution was recorded, but not every underlying cited URL was resolved.

The two action prompts come verbatim from docs/action-first/07-measurement-pack.md. Measure source citation, brand mention, explicit next-step recommendation, assistant tool invocation and confirmed buyer request separately.

## Earlier readings supplied by the owner

The supplied fix list reported taxonomy answers citing netify.co.uk on all six head terms, and Netify first on both action prompts in AI Mode and Copilot. Those earlier readings remain **owner-reported**. Today's independently observed Google AI Overviews do not reproduce the all-six citation claim. Platform/session/timing differences can explain variation; this is not proof those earlier observations were wrong.

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
