/**
 * Fixtures for the notice display-title rulebook. Every live board pattern
 * observed on 23 July 2026 is encoded here, plus the exact-null cases the
 * no-derivation-no-rendering contract depends on. Run by
 * scripts/validate-notice-titles.ts inside `npm run validate` (build gate).
 */

import { deriveNoticeTitle, insufficientNoticeTitle, noticeDisplayTitle, type NoticeTitleSource } from "@/lib/notice-title";

type Fixture = {
  name: string;
  source: NoticeTitleSource;
  /** Expected deriveNoticeTitle output; null asserts the no-derivation case. */
  derived: string | null;
  /** Expected display title after the sufficiency gate. */
  display: string;
};

const src = (over: Partial<NoticeTitleSource>): NoticeTitleSource => ({
  title: "",
  scope: [],
  sites: null,
  regions: [],
  buyer_sector: "",
  users_band: "",
  ...over,
});

const FIXTURES: Fixture[] = [
  {
    name: "sufficient stored title stands untouched (Harry's exemplar)",
    source: src({ title: "H TEST Fully managed SASE, 21-50 sites, UK & Ireland and Europe", scope: ["sase", "managed_service"], sites: 50, regions: ["uk_ireland", "europe"] }),
    derived: "Managed SASE, 50 sites, UK & Ireland and Europe",
    display: "H TEST Fully managed SASE, 21-50 sites, UK & Ireland and Europe",
  },
  {
    name: "sample-grammar stored title stands",
    source: src({ title: "Co-managed SD-WAN, 6-20 sites, Asia Pacific", scope: ["sd_wan", "managed_service"], regions: ["asia_pacific"] }),
    derived: "Managed SD-WAN, Asia Pacific",
    display: "Co-managed SD-WAN, 6-20 sites, Asia Pacific",
  },
  {
    name: "generic 'SASE requirement' is insufficient but derives stably to the same words when nothing else is known",
    source: src({ title: "SASE requirement", scope: ["sase"] }),
    derived: "SASE requirement",
    display: "SASE requirement",
  },
  {
    name: "engine title with a real sector stands (letters present)",
    source: src({ title: "Security sourcing for Healthcare & pharma (12 users)", scope: ["managed_security"], sites: 123, buyer_sector: "Healthcare & pharma" }),
    derived: "Managed security, 123 sites",
    display: "Security sourcing for Healthcare & pharma (12 users)",
  },
  {
    name: "builder default title derives from scope alone",
    source: src({ title: "Untitled SASE / SD-WAN RFP", scope: ["sase", "managed_service"] }),
    derived: "Managed SASE requirement",
    display: "Managed SASE requirement",
  },
  {
    name: "the F1 numeric-sector artefact derives to the scope requirement line",
    source: src({ title: "Security sourcing for 66", scope: ["managed_security"] }),
    derived: "Managed security requirement",
    display: "Managed security requirement",
  },
  {
    name: "junk users_band never enters a title (the 66 lesson at the band gate)",
    source: src({ title: "Security sourcing for 66", scope: ["managed_security"], users_band: "66" }),
    derived: "Managed security requirement",
    display: "Managed security requirement",
  },
  {
    name: "managed_security never doubles the managed prefix",
    source: src({ title: "Untitled", scope: ["managed_security", "managed_service"] }),
    derived: "Managed security requirement",
    display: "Managed security requirement",
  },
  {
    name: "untitled with a keyed sector derives the sector clause",
    source: src({ title: "Untitled SASE / SD-WAN RFP", scope: ["sase"], buyer_sector: "financial_services" }),
    derived: "SASE for Financial services",
    display: "SASE for Financial services",
  },
  {
    name: "estate facts beat the sector clause",
    source: src({ title: "Untitled SASE / SD-WAN RFP", scope: ["sase", "managed_service"], sites: 38, regions: ["uk_ireland"], buyer_sector: "retail_ecommerce" }),
    derived: "Managed SASE, 38 sites, UK & Ireland",
    display: "Managed SASE, 38 sites, UK & Ireland",
  },
  {
    name: "single site reads singular",
    source: src({ title: "", scope: ["connectivity"], sites: 1 }),
    derived: "Connectivity, 1 site",
    display: "Connectivity, 1 site",
  },
  {
    name: "known users band enters when sites are absent",
    source: src({ title: "Untitled", scope: ["sd_wan"], users_band: "100-500", regions: ["uk_ireland", "europe"] }),
    derived: "SD-WAN, 100–500 users, UK & Ireland and Europe",
    display: "SD-WAN, 100–500 users, UK & Ireland and Europe",
  },
  {
    name: "under-100 band lowers its first word inside the sentence",
    source: src({ title: "Untitled", scope: ["sse"], users_band: "under_100" }),
    derived: "SSE, under 100 users",
    display: "SSE, under 100 users",
  },
  {
    name: "three regions cap at two named and more",
    source: src({ title: "Untitled", scope: ["sase"], regions: ["uk_ireland", "europe", "north_america"] }),
    derived: "SASE, UK & Ireland, Europe and more",
    display: "SASE, UK & Ireland, Europe and more",
  },
  {
    name: "EXACT NULL: not_sure-only scope derives nothing; the stored title stands even when insufficient",
    source: src({ title: "Untitled SASE / SD-WAN RFP", scope: ["not_sure"] }),
    derived: null,
    display: "Untitled SASE / SD-WAN RFP",
  },
  {
    name: "EXACT NULL: empty scope derives nothing",
    source: src({ title: "Untitled", scope: [] }),
    derived: null,
    display: "Untitled",
  },
];

/** title → expected insufficiency verdict. */
const SUFFICIENCY: Array<[string, boolean]> = [
  ["", true],
  ["   ", true],
  ["Untitled", true],
  ["Untitled SASE / SD-WAN RFP", true],
  ["sase rfp", true],
  ["SD-WAN requirement", true],
  ["SASE / SD-WAN RFP", true],
  ["Full SASE RFI", true],
  ["Security sourcing for 66", true],
  ["Security sourcing for 66 (12 users)", true],
  ["Security sourcing", false], // the engine's own honest minimum, Harry-ruled grammar
  ["Security sourcing for Healthcare & pharma (12 users)", false],
  ["H TEST Fully managed SASE, 21-50 sites, UK & Ireland and Europe", false],
  ["Co-managed SD-WAN, 6-20 sites, Asia Pacific", false],
  ["SASE platform for a hybrid workforce", false],
];

export function runNoticeTitleTests(): { pass: number; fail: number; failures: string[] } {
  let pass = 0;
  const failures: string[] = [];
  for (const f of FIXTURES) {
    const derived = deriveNoticeTitle(f.source);
    const display = noticeDisplayTitle(f.source);
    if (derived === f.derived && display === f.display) pass += 1;
    else failures.push(`${f.name}: derived ${JSON.stringify(derived)} (want ${JSON.stringify(f.derived)}), display ${JSON.stringify(display)} (want ${JSON.stringify(f.display)})`);
  }
  for (const [title, want] of SUFFICIENCY) {
    if (insufficientNoticeTitle(title) === want) pass += 1;
    else failures.push(`sufficiency(${JSON.stringify(title)}): got ${!want}, want ${want}`);
  }
  return { pass, fail: failures.length, failures };
}
