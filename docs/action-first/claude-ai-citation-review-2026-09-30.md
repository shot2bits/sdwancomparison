# AI citation review: what gets cited for "X providers", and where the shortlist page stands

30 September 2026, 22:30 to 23:15 UTC. Live queries run from your Chrome on Google AI Mode (UK, en-GB), Copilot Search (en-GB), Gemini (your Pro account) and ChatGPT (your account, temporary chat). Cited pages then fetched and dissected. No page was changed.

## 1. What I ran and what came back

Head terms only. No qualifiers unless stated.

| Query | Engine | Cited pages (in order shown) | Intermediary named in the answer text? |
|---|---|---|---|
| energy brokers | Google AI Mode | purelyenergy.co.uk (home + "top10-business-energy-brokers-uk"), loveenergysavings.com/insights/energy-brokers/, bionic.co.uk guide, uswitch.com business-energy brokers guide, moneysupermarket.com business-energy-brokers, smartestenergybusiness.com/brokers/, smallbusiness.co.uk best brokers | Yes. The answer is a table "Broker / Platform, Best For, Key Focus": Bionic, Love Energy Savings, Purely Energy, Northern Gas and Power |
| energy brokers | Copilot Search | professionalenergy.co.uk "Top 10 Energy Brokers UK in 2026", expertsure.com "Top 10 Energy Brokers UK 2026" | Yes, via those listicles |
| energy brokers | ChatGPT (your account) | No search performed; answered from memory and pivoted to Netify. Unusable as a clean signal | n/a |
| business energy brokers | Google AI Mode | bionic.co.uk (guide + hub), catalyst-commercial.co.uk, moneysupermarket.com, onlinedirect… | Yes, Bionic cited three times |
| energy providers | Google AI Mode | uswitch.com/gas-electricity/ and its big-six guide, loveenergysavings.com/energy-suppliers/, octopus.energy, centrica.com, ukpower.co.uk, theenergyshop.com | Suppliers named; Uswitch and Love Energy Savings are the sources, not named as the route |
| business broadband providers | Google AI Mode | business.ee.co.uk, amvia.co.uk/compare/business-broadband, business.bt.com, virginmediabusiness.co.uk, vodafone, zen, sky, communityfibre, comparethemarket.com/broadband/business-broadband/, uswitch.com/broadband/business-broadband/, broadbandchoices.co.uk/business, growthbusiness.co.uk | Providers named; three comparison sites cited as sources |
| car insurance providers | Google AI Mode | aviva, directline, confused.com/compare-car-insurance/providers, comparethemarket.com/car-insurance/providers/, moneysupermarket.com/car-insurance/providers/, moneyfactscompare, hastingsdirect, lv, allianz, marshmallow, saga | **Yes, in the first sentence:** "use popular comparison platforms like Confused.com, Compare the Market, and MoneySuperMarket" |
| CRM vendors | Google AI Mode | cxfoundation.com/blog/crm-vendors, salesforce best-crm, crn.com, solutionsreview.com best-crm-companies, dynamics.microsoft.com, crm-online.co.uk top-10, oracle, sap, gartner.com/reviews/market/crm…, hubspot, zoho, freshworks | Vendors named; Gartner Peer Insights and two "top 10" lists are the sources |
| SD-WAN providers | Google AI Mode | reddit r/networking thread, stlpartners.com sd-wan-providers, gartner.com/reviews/market/sd-wan, megaport.com blog, **netify.co.uk/sase/shortlist/sd-wan-vendors/**, **netify.co.uk/sase/shortlist/**, business.bt.com sd-wan | No intermediary named. Answer frames "Technology Vendors vs Carriers/MSPs" |
| SD-WAN providers | Copilot Search | gartner.com Peer Insights "Best SD-WAN Reviews 2026", comparitech "10 Best SD-WAN Vendors… Updated 2026", softwaretestinghelp "Top 11 SD-WAN Vendors (2026 Rankings)", stlpartners, businessbroadbandhub.co.uk "Best SD-WAN Providers… in the UK", rfwireless-world, erp-information "10 Best SD-WAN Providers of 2026", cloudtango.net/sd-wan/uk "List of SD-WAN Service Providers in the UK", worldmetrics.org "Top 10 Best Sd Wan Services 2026" | **Netify absent** (9 links, all read) |
| SD-WAN providers | Gemini (Pro) | No source list exposed; one image credited "Source: Fortinet". Answer is a vendor table (Cisco Catalyst, Meraki, Fortinet, Palo Alto Prisma, Cato, HPE Aruba) then offers "Compare SASE capabilities across these vendors" and "Build an SD-WAN evaluation matrix" itself | **Netify absent.** Gemini offers to do the intermediary's job |
| SD-WAN providers | ChatGPT (your account) | verticalsystems.com 2025 US SD-WAN leaderboard, **netify.co.uk/sase/shortlist/sd-wan-vendors/**, ciopages.com buyer guide | No intermediary named; account is personalised, treat with caution |
| SD-WAN providers UK | Google AI Mode | virginmediabusiness.co.uk sdwan, **netify.co.uk/sase/shortlist/**, businessbroadbandhub.co.uk/sd-wan-providers/, **netify.co.uk/sase/best/sd-wan-sase-providers-for-uk-public-sector/**, leasedlineandmpls.co.uk 2025 guide, maintel, windsor-telecom, axians, G-Cloud listing, nomios | No. Answer headings: "Best for nationwide scale / fully managed integration / international reach / mid-sized enterprises / complex migrations / resilient support / multi-site business internet" |
| SD-WAN vendors | Google AI Mode | **netify.co.uk/sase/shortlist/** (first, and the source of the opening sentence), gartner Peer Insights, globalservices.bt.com, verizon, expereo, stlpartners, reddit, megaport, **netify …/sd-wan-vendors/**, nomios 2018 post, **netify …/managed-sd-wan/**, ogcloud | No |
| SASE providers | Google AI Mode | **netify.co.uk/insights/where-to-buy-managed-sase-services-with-global-coverage/** (source of the opening sentence), cloudsek, **netify.co.uk/sase/best/sd-wan-sase-providers-for-professional-services/**, vodafone, macronetservices | No |
| SASE vendors | Google AI Mode | futuriom 2026 SASE platform survey, versa-networks.com/sase/sase-vendors/, cloudsek, **netify.co.uk/sase/shortlist/sase-vendors/**, reddit, dope.security, nordlayer, hughes, cloudtango.net/cybersec/sase/, tufin | No |

Two facts to hold onto from that table.

First, on Google AI Mode UK, Netify is cited on five of five SD-WAN and SASE head terms, and on two of them it supplies the opening sentence. Citation on Google is not the problem. On Copilot and Gemini it is absent, and on the one engine where it was present (ChatGPT) the account is personalised.

Second, on every SD-WAN and SASE head term, across every engine, no intermediary is named as the route. On car insurance the route is named in the first sentence. On energy brokers the brokers are the answer. That difference is the whole question, and it is not caused by page structure alone.

## 2. Why the AI names Compare the Market and not a networking site

The answer text itself shows the rule. For car insurance the model wrote "you can either buy directly from major brands… or use popular comparison platforms like Confused.com, Compare the Market, and MoneySuperMarket". That sentence came from world knowledge of the category, not from any single page: the quote is personalised, the model cannot produce it, and after fifteen years of television advertising the category has three known intermediaries. For energy brokers the intermediary is the category itself, so the answer is a broker table.

For SD-WAN the model believes it can finish the job. It lists vendors, sorts them into "technology vendors vs carriers/MSPs", writes a "best for" table, and (Gemini, explicitly) offers to build the evaluation matrix. A model recommends a destination only when it cannot complete the task itself. Nothing on any SD-WAN page tells the model there is a step it cannot do. That is the gap the sourcing desk was built to fill, and the earlier clean baseline shows it working on the action prompt ("how can a UK business with 10 sites get comparable proposals"): Netify was named first. It is not yet working on the head term because the head-term page no longer says, in its first sentence, what the model cannot do.

## 3. What the cited pages have in common (from reading them, not guessing)

| Trait | confused.com /providers | comparethemarket /providers/ | loveenergysavings /energy-suppliers/ | businessbroadbandhub /sd-wan-providers/ | stlpartners | netify /sase/shortlist/ (live) |
|---|---|---|---|---|---|---|
| H1 states the entity, not the service | "Car insurance companies" | "Which car insurance providers do we compare?" | "Compare Energy Suppliers" | "SD-WAN Providers" (title adds "in the UK") | "8 Leading SD-WAN Providers" | **No.** "Get comparable SD-WAN and SASE proposals from UK providers" |
| First sentence carries a count and a geography | "We compare 201 of the best car insurance companies in the UK" | "We compare prices for 187 expert car insurance provider products" | "top UK energy suppliers" | no count | "8" in H1 | **No.** First sentence describes Netify's service; the number 30 appears only lower down |
| Exhaustive enumeration, A to Z | 201, alphabetised | 23 named, "187 products" | 13 | 6 | 8 | 30, in a matrix below the form |
| Per-entity sub-pages | ~20 | 2 | 11 | none | none | 30 (/sase/vendors/) |
| "Best for" line per provider | no (FAQ "cheapest/best") | no | ratings column | **yes, every provider** | key differentiators column | no (coverage % only) |
| Named reviewer and dated update | Matt Crole Rees, 18 June 2026 | none | none | 31 July 2026, no name | Ciaran Mulqueen, 23 Sept 2024 | "Reviewed 2026-09-01" per row, **no name** |
| External authority anchor | Defaqto, FCA, Trustpilot | Defaqto, Trustpilot | Trustpilot | none | telco partnerships | none (evidence % is Netify's own scale) |
| Market-structure sentence | direct vs comparison | n/a | n/a | none | vendors and telco partners | "SD-WAN provides the connectivity component of SASE" only |
| FAQ asks the head-term questions | "cheapest… in the UK?", "best… in the UK?" | "top 10 cheapest…?" | "Who are the best rated…?" | none | none | **No.** "What does Netify do?", "Can I research without an account?" |
| Primary CTA position | after the H1 and count sentence | immediately below H1 | below hero | "COMPARE NOW" | "Book a demo" | form is the page |

Three things stand out.

The AI reproduces the shape of the page it cites. The Google answer for "SD-WAN providers UK" is a "Best for" list; businessbroadbandhub, a six-provider page with a "Best for" line under each logo, is cited by Google and Copilot for the same query. Cloudtango's bare "List of SD-WAN Service Providers in the UK" is cited by Copilot for nothing more than enumerating. STL's eight-row table is cited on both engines two years after its last update. Structure that matches the question beats depth that does not.

The winning pages answer first and sell second. Confused.com puts "We compare 201 of the best car insurance companies in the UK" above "Get a quote". The order matters because the first sentence is what the model quotes.

Google is still citing the old shortlist page. The citation card in AI Mode reads "Compare SD-WAN & SASE Providers for UK Businesses | Netify". That is the 26 September title (commit 5e4388f, `SHORTLIST_INTRO.h1` "Compare SD-WAN and SASE providers for UK businesses", subhead "Compare 30 researched SD-WAN and SASE providers across operating model, network and security capability"). The action-first release replaced it with the service title on 30 September and Google has not re-crawled. The head-term citations you have today were earned by the comparison framing that the release removed. When Google re-indexes, the match between "SD-WAN providers" and a page whose H1 says "Get comparable proposals" is weaker, and the sub-pages (/sd-wan-vendors/, /sase-vendors/, /managed-sd-wan/), which kept their head-term titles, will carry the citation instead. That is survivable, but it hands the entrance page's citation to pages without the sourcing CTA.

## 4. Where the live shortlist page diverges from the cited pattern

1. The entity statement is gone. The page opens with what Netify does. No cited page in any sector does that.
2. The count sentence is gone. "Compare 30 researched SD-WAN and SASE providers…" was the quotable line; "Use Netify to request comparable proposals…" is not a fact about the market.
3. Thirty is not the market. Confused.com lists 201 and gives 20 of them pages; the AI trusts the page that enumerates the whole category. For the UK term Google and Copilot cite Maintel, Axians, Windsor Telecom, Nomios, Exponential-e, a G-Cloud listing and Cloudtango's directory. None of those is on Netify's 30. A page that says "30 researched" while the UK contracting market is several times larger is a curated list, and curated lists are cited for the curation, not for the category. I have not counted the full market; that count is the first job of Block 3 below.
4. No "best for" line per provider, although the data exists (sectors, regions, org size, service model, UK delivery, all sourced). The page shows a coverage percentage, which is Netify's scale and means nothing to a model.
5. No named reviewer. "Reviewed 2026-09-01" per row with no person, on a page whose H1 promises comparable proposals, reads like a system stamp.
6. No external anchor. Insurance pages lean on Defaqto and the FCA; energy on Ofgem; CRM answers cite Gartner Peer Insights. For SD-WAN the anchors a model recognises are Gartner Magic Quadrant placement, MEF 3.0 SD-WAN certification, Ofcom-regulated carrier status and G-Cloud listing. Netify holds some of this in the evidence set and shows none of it at the top.
7. FAQ answers Netify's questions, not the buyer's. "What does Netify do?" cannot be quoted in an answer about SD-WAN providers. "Which SD-WAN providers deliver nationwide in the UK?" can.
8. Structured data describes a Service. A page whose citation value is its list of 30 organisations should emit an ItemList of Organization entries (with sameAs to each vendor's own site and Wikidata where it exists), a Dataset pointing at data.json, and a Person for the reviewer. Service can stay alongside.
9. The sibling pages that kept head-term titles are doing the citation work and carry none of the sourcing actions. The entrance page and the sub-pages should be one system: same entity block, same "best for" rows, same CTAs.

## 5. The page model to adopt: answer first, act second, on one URL

This is not a heading change. It is a change to what the page is. Today it is a form with evidence underneath. It needs to be the UK directory of SD-WAN and SASE providers with a desk attached, in that order, because the directory earns the citation and the desk earns the recommendation.

**Block 1, the entity statement (server-rendered, first 80 words).** H1 names the category and the geography: SD-WAN and SASE providers in the UK. The first sentence is the count sentence: how many providers Netify lists that will contract in the UK, how many of those are researched to the 40-fact standard, how many are technology vendors, UK carriers and managed service providers. The second sentence is the market-structure sentence every engine currently writes for itself (vendors build the platform; carriers and MSPs deliver it with circuits and operations; most UK buyers contract with the second group). The third sentence is the thing the model cannot do: getting comparable UK proposals requires a buyer identity and supplier engagement, which Netify coordinates. Reviewer name and review date sit under the H1, not in the table. Harry writes this block; the numbers come from the data.

**Block 2, the desk (unchanged in function).** The sourcing form and the three actions per provider stay exactly where the action-first release put them, directly under Block 1. Nothing is gated.

**Block 3, the full UK list, not the 30.** Two tiers, like Confused's 201 and 20: every entity that contracts SD-WAN or SASE in the UK (vendors, carriers, MSPs, resellers, G-Cloud suppliers) as a listed row with name, type, UK contracting status and a link; the 30 researched providers with the full evidence. Alphabetical, complete, never truncated. Each row carries one "Best for" line generated from the sourced fields (sector evidence, region, org size, service model) with its source, and a "Will respond" status from the response panel once that exists. This is the block Cloudtango and businessbroadbandhub are cited for with a fraction of the evidence.

**Block 4, the head-term FAQ.** Six to eight questions phrased the way the queries are phrased, each answered in one quotable sentence with a number and a date: which SD-WAN providers deliver nationwide in the UK; which SASE vendors have a UK point of presence; which providers are Gartner-placed and MEF-certified; what a 10-site UK deployment typically involves; how to get comparable proposals. Existing service FAQs move to /how-it-works/.

**Block 5, machine layer.** ItemList of Organization for every listed provider (sameAs to vendor site, Wikidata, Companies House number for UK entities), Dataset for data.json, Person for the reviewer, Service for the desk, BreadcrumbList. llms.txt opens with the same entity statement as the page. data.json carries the same "best for" and UK-status fields so an agent gets the same answer a reader does.

**Per-provider pages.** Same entity block at the top of each /sase/vendors/ page (type, UK status, sectors evidenced, best for, will respond), same three actions. The entity graph must read the same from every entrance or the model averages it.

**Sibling pages.** /sd-wan-vendors/, /sase-vendors/, /managed-sd-wan/, /best/* keep their head-term titles. They gain the desk actions. They do not get the service title.

**Entity work outside the page.** Compare the Market is named because the model knows what it is. Netify's one-sentence definition must be identical everywhere a model reads it: Organization schema description, About page, llms.txt, the apex homepage, LinkedIn, Crunchbase, press. The canonical value statement already exists; use it verbatim, with "SD-WAN and SASE comparison and sourcing for UK businesses" as the category phrase. Third-party mentions that call Netify that (trade press, supplier partner pages, G-Cloud) are worth more than any on-page change for the naming-as-route outcome.

**Distribution beyond Google.** Copilot cites 2026-dated "Top N" pages and directories. IndexNow is done; Bing Webmaster Tools should show the shortlist pages indexed with the new titles, and the full-list block gives Bing a page that matches its preferred shape. Gemini exposed no sources and offered to do the job itself; the only counter is data the model does not hold (UK contracting status, dated evidence, response commitments), which is Block 3.

## 6. What not to do

Do not revert action-first. The desk is right; it is the order that is wrong.

Do not chase the old ranking. The 2020 data in the project file shows position 2.6 returned a 4.3 per cent click rate and "hybrid wan vendors" at position 2.1 returned zero clicks. The head term never converted through blue links.

Do not invent an external anchor. Gartner placement, MEF certification and Ofcom status are facts per provider and can be sourced; a Netify "score" is not an anchor a model recognises.

Do not measure this by citation count. The Bing figure of 83,600 citations a quarter against 40 referral clicks a week is the reason for this work. Measure named-as-route on the eight baseline queries weekly, plus confirmed sourcing requests by acquisition source once F10 in the release review is fixed.

## 7. Caveats on the evidence

Google AI Mode and Gemini ran on your signed-in Google account; earlier today the clean signed-out baseline agreed with the head-term citations, so I do not think personalisation changed the SD-WAN results, but the energy and insurance queries were not re-run signed out. ChatGPT is personalised and pivoted to Netify unprompted; its one citation is not evidence. Copilot's "Sources" panel was collapsed; I read the "All links" list. Gemini exposes no citation links in the DOM. Comparitech's article body did not parse, so its structure is from its metadata only. All page dissections were done at one moment on 30 September and pages of this kind change weekly.
