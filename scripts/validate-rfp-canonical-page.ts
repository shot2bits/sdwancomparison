/**
 * Regression guard for the canonical RFP Builder page,
 * https://netify.co.uk/sase-sd-wan-rfp-builder/ (served by
 * (workspace)/home/page.tsx through the apex rewrite), added 3 Sep 2026
 * after the "sd-wan rfp" / "sase rfp" citation audit.
 *
 * What it protects, at source level (fast, in the `npm run validate`
 * chain so a build cannot ship a regression):
 *  1. Legacy entry routes redirect to the canonical page in one hop, on
 *     both the /sase/rfp-builder path and the sase.netify.co.uk host.
 *  2. Title, H1 and meta description are the ruled wording; the meta
 *     description is short and carries the required terms.
 *  3. The public content is server-rendered: definitions above the app,
 *     a captioned, header-scoped table of the eight RFP areas, the five
 *     ruled FAQs, a review date, links to the question bank and both
 *     sample RFPs.
 *  4. FAQPage and BreadcrumbList schema are built from the same data the
 *     HTML renders and are structurally valid.
 *  5. The Continuation opens the builder page (the apex root no longer
 *     reads ?q=).
 *
 * The rendered-HTML checks (single H1, phrases present in the response,
 * bots receive the same HTML, no private data) live in
 * scripts/test-rfp-canonical-live.ts and run against a started server.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  FAQS,
  RFP_AREAS,
  RFP_CONTENT_REVIEWED,
  getRfpBreadcrumbSchema,
  getRfpFaqSchema,
  getRfpWebPageSchema,
  CANONICAL_BUILDER_URL,
} from "../src/components/procurement/RfpPublicContent";
import { ENGINE_H1, RFP_DEFINITIONS, RFP_META_DESCRIPTION } from "../src/components/procurement/ProcurementEntry";
import { continuationUrl } from "../src/lib/continuation/types";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  ->  ${detail}` : ""}`);
};

function main() {
  const CANON = "https://netify.co.uk/sase-sd-wan-rfp-builder/";
  const config = src("next.config.ts");
  const home = src("src/app/(workspace)/home/page.tsx");
  const entry = src("src/components/procurement/ProcurementEntry.tsx");
  const hero = src("src/components/CollapsibleHero.tsx");
  const content = src("src/components/procurement/RfpPublicContent.tsx");
  const sample = src("src/app/(marketing)/rfp-builder/sample-rfp/page.tsx");
  const questions = src("src/app/(marketing)/rfp-builder/questions/page.tsx");
  const nav = src("src/lib/nav.ts");

  /* 1. Redirects */
  const hostRule = (p: string) =>
    new RegExp(`source:\\s*"${p.replace(/\//g, "\\/")}",\\s*has:\\s*\\[\\{\\s*type:\\s*"host",\\s*value:\\s*"sase\\.netify\\.co\\.uk"\\s*\\}\\],\\s*destination:\\s*"${CANON.replace(/[./]/g, "\\$&")}"`);
  record(hostRule("/rfp-builder").test(config), "1: sase.netify.co.uk/rfp-builder -> canonical, host-scoped, one hop");
  record(hostRule("/rfp-builder/").test(config), "1: sase.netify.co.uk/rfp-builder/ -> canonical, host-scoped, one hop");
  const genericSub = config.indexOf('destination: "https://netify.co.uk/sase/:path*"');
  const hostIdx = config.search(hostRule("/rfp-builder"));
  record(hostIdx > -1 && genericSub > -1 && hostIdx < genericSub, "1: the host-scoped rfp-builder rules stand BEFORE the generic subdomain rule");
  const pathRule = (p: string) => new RegExp(`\\{\\s*source:\\s*"${p.replace(/\//g, "\\/")}",\\s*destination:\\s*"${CANON.replace(/[./]/g, "\\$&")}",\\s*statusCode:\\s*301\\s*\\}`);
  record(pathRule("/rfp-builder").test(config), "1: /sase/rfp-builder -> canonical 301");
  record(pathRule("/rfp-builder/").test(config), "1: /sase/rfp-builder/ -> canonical 301");
  record(!/source:\s*"\/rfp-builder\/?",\s*destination:\s*"https:\/\/netify\.co\.uk\/",/.test(config), "1: no /rfp-builder rule still points at the apex root (homepage detour)");
  record(!/https:\/\/netify\.co\.uk\/\?q=/.test(config), "1: ?sector= prefill redirects open the builder page, not the apex root");

  /* 2. Title, H1, description */
  record(/title:\s*"Free SD-WAN and SASE RFP Builder and Template"/.test(home), "2: page title is the ruled wording (layout template appends ' | Netify')");
  record("Free SD-WAN and SASE RFP Builder and Template | Netify".length <= 60, "2: full title with suffix is 60 characters or fewer");
  record(ENGINE_H1 === "Build an SD-WAN or SASE RFP and compare vendor responses", "2: H1 is the ruled wording", ENGINE_H1);
  record(/description:\s*RFP_META_DESCRIPTION/.test(home), "2: metadata description uses the concise RFP_META_DESCRIPTION");
  record(RFP_META_DESCRIPTION.length <= 160, "2: meta description is 160 characters or fewer", String(RFP_META_DESCRIPTION.length));
  for (const term of ["SD-WAN RFP", "SASE RFP", "supplier questions", "evaluation", "anonymously"]) {
    record(RFP_META_DESCRIPTION.includes(term), `2: meta description carries "${term}"`);
  }
  record(/alternates:\s*\{\s*canonical:\s*BUILDER_URL\s*\}/.test(home) && home.includes('const BUILDER_URL = `${APEX}/sase-sd-wan-rfp-builder/`'), "2: canonical is the apex builder URL");
  const newCopy = RFP_META_DESCRIPTION + ENGINE_H1 + RFP_DEFINITIONS.map((d) => d.text).join("") + content;
  record(!/—|–/.test(newCopy), "2: no em or en dashes in the new copy (description, H1, definitions, RfpPublicContent)");

  /* 3. Public content, server-rendered */
  record(/<RfpPublicContent \/>/.test(home) && /<RfpCitationEvidence \/>/.test(home), "3: home renders RfpPublicContent and RfpCitationEvidence directly (not via the discarded afterPrompt prop)");
  record(!/^"use client"/.test(content.trim()), "3: RfpPublicContent is a Server Component");
  record(RFP_DEFINITIONS.length === 2 && RFP_DEFINITIONS[0].term === "SD-WAN RFP" && RFP_DEFINITIONS[1].term === "SASE RFP", "3: two definitions, SD-WAN RFP then SASE RFP");
  record(RFP_DEFINITIONS.every((d) => /^An? (SD-WAN|SASE) RFP is a request for proposal/.test(d.text)), "3: each definition opens as a quotable sentence");
  record(/definitions=\{RFP_DEFINITIONS\}/.test(entry) && /<dl/.test(hero) && /<dt/.test(hero), "3: definitions render above the application as a description list");
  record(!/^\s*<div className="sr-only">/m.test(hero.split("return (")[1] ?? ""), "3: the pre-start hero is no longer wrapped in sr-only");
  const areas = ["Organisation and scale", "Network architecture", "SASE security", "Resilience", "Managed service", "Implementation", "Pricing and contract terms", "Supplier evidence"];
  record(RFP_AREAS.map((r) => r.area).join("|") === areas.join("|"), "3: the table carries the eight ruled areas in order");
  record(/<table[\s\S]*?<caption/.test(content), "3: the table has a caption");
  record(/<th scope="col"/.test(content) && /<th scope="row"/.test(content), "3: column and row headers carry scope");
  record(/<time dateTime=\{RFP_CONTENT_REVIEWED\}>/.test(content), "3: the review date is visible and machine-readable (<time dateTime>)");
  record(/^\d{4}-\d{2}-\d{2}$/.test(RFP_CONTENT_REVIEWED), "3: review date is ISO YYYY-MM-DD", RFP_CONTENT_REVIEWED);
  record(/export const RFP_CONTENT_REVIEWED = "\d{4}-\d{2}-\d{2}"/.test(content) && !/RFP_VALIDATION_REVIEWED/.test(content), "3: the content review date is its own explicit constant, not the validator's date");
  record(RFP_CONTENT_REVIEWED >= "2026-09-03", "3: content review date is on or after the date the content was written");
  record(RFP_AREAS.every((r) => !/\bthree-year total cost\b|\bTwo references\b/.test(r.evidence)), "3: table evidence states recommendations, not universal rules");
  record(content.includes("https://netify.co.uk/sase/rfp-builder/questions/") && content.includes("https://netify.co.uk/sase/rfp-builder/sample-rfp/") && content.includes("https://netify.co.uk/sd-wan/sample-rfp/"), "3: links to the question bank and both sample RFPs");
  const faqQs = [
    "What should an SD-WAN RFP include?",
    "What should a SASE RFP include?",
    "What is the difference between an RFI and an RFP?",
    "How should SD-WAN and SASE vendors be evaluated?",
    "Is the Netify RFP Builder free?",
  ];
  record(FAQS.map((f) => f.q).join("|") === faqQs.join("|"), "3: the five ruled FAQs, in order");
  record(FAQS.every((f) => f.a.length >= 80 && f.a.length <= 900), "3: FAQ answers are short and direct (80 to 900 characters)");
  record(/<details/.test(content) && /<summary/.test(content), "3: FAQs use native <details>/<summary> (present in served HTML, no client state)");

  /* 4. Schema */
  const faq = getRfpFaqSchema() as { "@type": string; mainEntity: { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[] };
  record(faq["@type"] === "FAQPage" && faq.mainEntity.length === FAQS.length, "4: FAQPage schema built from the same FAQS array");
  record(faq.mainEntity.every((q, i) => q["@type"] === "Question" && q.name === FAQS[i].q && q.acceptedAnswer["@type"] === "Answer" && q.acceptedAnswer.text === FAQS[i].a), "4: every FAQ item is Question/Answer with matching text");
  const bc = getRfpBreadcrumbSchema() as { "@type": string; itemListElement: { "@type": string; position: number; name: string; item: string }[] };
  record(bc["@type"] === "BreadcrumbList" && bc.itemListElement.length === 2, "4: BreadcrumbList has two items");
  record(bc.itemListElement[0].position === 1 && bc.itemListElement[0].item === "https://netify.co.uk/" && bc.itemListElement[1].position === 2 && bc.itemListElement[1].item === CANON, "4: breadcrumb is Home -> canonical builder URL");
  const wp = getRfpWebPageSchema() as { "@type": string; dateModified: string; url: string; significantLink: string[] };
  record(wp["@type"] === "WebPage" && wp.dateModified === RFP_CONTENT_REVIEWED && wp.url === CANON, "4: WebPage schema carries the same review date as the visible <time>");
  record(wp.significantLink.length === 3, "4: WebPage names the question bank and both sample RFPs as significant links");
  record(CANONICAL_BUILDER_URL === CANON, "4: component canonical constant matches the page canonical");
  record(JSON.stringify(faq).length > 0 && JSON.stringify(bc).length > 0, "4: schema serialises");

  /* 5. Continuation and internal links */
  record(continuationUrl("We need SD-WAN for 20 sites.", []).startsWith(CANON + "?q="), "5: continuationUrl opens the builder page with ?q=");
  record(!/https:\/\/netify\.co\.uk\/\?q=/.test(nav), "5: nav sector RFP links open the builder page");
  record(/label: "Build an SD-WAN or SASE RFP", href: "\/sase-sd-wan-rfp-builder\/"/.test(nav), "5: mega-nav links the canonical with descriptive wording");
  record(sample.includes('href="https://netify.co.uk/sase-sd-wan-rfp-builder/"') && sample.includes("https://netify.co.uk/sd-wan/sample-rfp/"), "5: SASE sample page links the canonical builder and the SD-WAN sample");
  record(questions.includes('href="https://netify.co.uk/sase-sd-wan-rfp-builder/"') && !questions.includes('href="/sase/rfp-builder/"'), "5: question bank page links the canonical, not the redirecting /sase/rfp-builder/");
  record(!/<Link href="\/rfp-builder\/(sase|sd-wan|sse)"/.test(questions) && !/<Link href="\/rfp-builder\/sd-wan"/.test(sample), "5: no links to the retired /rfp-builder/{sase,sd-wan,sse} paths");

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PASS: rfp canonical page");
  if (failures) process.exit(1);
}

main();
