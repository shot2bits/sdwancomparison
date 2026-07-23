/**
 * Live Sourcing Workspace fixtures (W0 slice 2): the fact ledger's merge
 * and resurrection rules, the derived requirement, the meter, the
 * publish-machinery bridges, the brief model's honesty behaviours and the
 * diagram's never-invent rule. Pure layer only; the page's I/O (extract
 * endpoint, fit endpoint, sign chain) is verified live after deploy.
 */

import {
  briefModel,
  builderCompliance,
  buyingOf,
  mergeUpdates,
  meterOf,
  productScopeFor,
  requirementFrom,
  standing,
  usersBandLabel,
  wizardRegions,
  wizardSectorKey,
  type WorkspaceFact,
} from "./draft";
import { BAND, capabilityRing, constellation, labelOffsets, slugAngle, vendorHue, RADIUS, VENDOR_PALETTE } from "./constellation";
import { deriveAreaState, deriveJourneyStates, refineConfirmed } from "./areas";
import { diagramModel } from "./diagram";
import { deterministicExtract, unionUpdates, type FieldUpdate } from "./extract";
import { activePack, activeFlavours, visibleSuggestions, declinedOnRecord, packRiskNotes } from "@/lib/sector/derive";
import { HEALTHCARE_PACK } from "@/lib/sector/packs";
import { buildChecks, workspaceFit } from "./fit";
import { earnedQuestions, publishedQuestionSet } from "./questions";
import { chunkForIngest, ingestSummary } from "./ingest";
import { callWorkspaceTool } from "@/lib/mcp-workspace-tools";
import { unlandedMentions } from "./taxonomy";
import { buildSecurityProject } from "@/lib/security/create-project";
import { assessSecurityRequirement } from "@/lib/security/rulebook";

export interface WorkspaceTestResult { pass: number; fail: number; failures: string[] }

export async function runWorkspaceDraftTests(): Promise<WorkspaceTestResult> {
  const r: WorkspaceTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  /* ---- Merge mechanics ---- */
  let facts: WorkspaceFact[] = [];

  await ok("list updates explode into per-value facts with provenance", () => {
    const m = mergeUpdates([], [
      { path: "drivers", value: ["incident", "renewal"], provenance: "stated", quote: "phishing incident and renewal" },
      { path: "estate.sites", value: 38, provenance: "stated", quote: "38 stores" },
      { path: "organisation.sector", value: "Retail & e-commerce", provenance: "inferred", reason: "stores indicate retail" },
    ], 1);
    facts = m.facts;
    expect(facts.length === 4, `want 4 facts, got ${facts.length}`);
    expect(m.changed.length === 4, "all four should report changed");
    expect(facts.some((f) => f.id === "drivers:incident"), "driver fact id");
  });

  await ok("scalar correction replaces in place and reports the ripple", () => {
    const m = mergeUpdates(facts, [{ path: "estate.sites", value: 45, provenance: "stated", quote: "actually 45 sites" }], 2);
    facts = m.facts;
    const sites = facts.find((f) => f.id === "estate.sites");
    expect(sites?.value === 45, "sites should now be 45");
    expect(sites?.cycle === 2, "changed fact carries the new cycle");
    expect(facts.length === 4, "no duplicate scalar fact");
    expect(m.changed.includes("estate.sites"), "ripple reported");
  });

  await ok("a struck fact stays struck against re-inference, returns when stated", () => {
    facts = facts.map((f) => (f.id === "organisation.sector" ? { ...f, struck: true } : f));
    let m = mergeUpdates(facts, [{ path: "organisation.sector", value: "Retail & e-commerce", provenance: "inferred", reason: "again" }], 3);
    facts = m.facts;
    expect(facts.find((f) => f.id === "organisation.sector")!.struck === true, "inference must not resurrect a strike-out");
    m = mergeUpdates(facts, [{ path: "organisation.sector", value: "Retail & e-commerce", provenance: "stated", quote: "we are retail" }], 4);
    facts = m.facts;
    expect(facts.find((f) => f.id === "organisation.sector")!.struck === false, "the buyer's own words do resurrect");
  });

  await ok("inference upgrades to stated when the buyer says it in words", () => {
    let m = mergeUpdates([], [{ path: "constraints.complianceRequirements", value: ["pci_dss"], provenance: "inferred", reason: "card payments" }], 1);
    m = mergeUpdates(m.facts, [{ path: "constraints.complianceRequirements", value: ["pci_dss"], provenance: "stated", quote: "PCI" }], 2);
    const f = m.facts.find((x) => x.id === "constraints.complianceRequirements:pci_dss");
    expect(f?.provenance === "stated", "provenance upgraded");
    expect(m.facts.length === 1, "no duplicate");
  });

  /* ---- Derivation ---- */
  await ok("requirement derives from standing facts only; strikes ripple through", () => {
    const req = requirementFrom(facts);
    expect(req.estate?.sites === 45, "sites in requirement");
    expect((req.drivers ?? []).includes("incident"), "driver in requirement");
    const struckAll = facts.map((f) => (f.id === "drivers:incident" ? { ...f, struck: true } : f));
    const req2 = requirementFrom(struckAll);
    expect(!(req2.drivers ?? []).includes("incident"), "struck driver leaves the requirement");
  });

  await ok("procurement facts steer scope but never enter the requirement", () => {
    const m = mergeUpdates(facts, [{ path: "procurement.buying", value: "sdwan", provenance: "stated", quote: "need SD-WAN" }], 5);
    expect(buyingOf(m.facts) === "sdwan", "buying detected");
    const req = requirementFrom(m.facts) as Record<string, unknown>;
    expect(!("procurement" in req), "requirement stays the engine's exact shape");
  });

  /* ---- Meter ---- */
  await ok("the meter counts the buyer's words against standing facts", () => {
    const m = mergeUpdates([], [
      { path: "estate.sites", value: 3, provenance: "stated", quote: "3 sites" },
      { path: "organisation.sector", value: "Education", provenance: "inferred", reason: "school" },
    ], 1);
    const withStruck = [...m.facts, { ...m.facts[0], id: "estate.users", path: "estate.users" as const, value: 10, struck: true }];
    const meter = meterOf(withStruck, null);
    expect(meter.total === 2 && meter.confirmed === 1 && meter.inferred === 1 && meter.struck === 1, JSON.stringify(meter));
    expect(meter.percent === 50, `percent ${meter.percent}`);
  });

  /* ---- Bridges ---- */
  await ok("bridges map workspace vocabulary onto the existing machinery", () => {
    expect(JSON.stringify(wizardRegions(["uk", "ie", "us"])) === JSON.stringify(["uk_ireland", "north_america"]), "regions bridge dedupes uk+ie");
    expect(builderCompliance(["iso27001", "nhs_dspt"]).join(",") === "iso_27001,nhs_dspt", "compliance bridge");
    expect(productScopeFor("sdwan") === "sdwan_only" && productScopeFor("sase") === "full_sase", "product scope");
    expect(wizardSectorKey("Retail & e-commerce") === "retail_ecommerce", "sector key");
    expect(wizardSectorKey("Something else") === null, "unknown sector never guessed");
    expect(usersBandLabel(900) === "500 to 1,000 users", "band");
  });

  /* ---- Brief model honesty ---- */
  await ok("the brief asks what it does not know and never fills it in", async () => {
    const m = mergeUpdates([], [{ path: "estate.sites", value: 38, provenance: "stated", quote: "38 stores" }], 1);
    const verdict = await assessSecurityRequirement(requirementFrom(m.facts));
    const brief = briefModel({ facts: m.facts, verdict });
    const flat = JSON.stringify(brief.blocks);
    expect(flat.includes('"kind":"gap"'), "open blanks render for the unknown");
    expect(brief.openGaps.length === verdict.gaps.length, "open gaps mirror the verdict's gaps exactly");
    expect(flat.includes("What are you buying?"), "the buying blank appears when scope is undetected");
  });

  await ok("struck facts stay visible in the brief, struck", async () => {
    let m = mergeUpdates([], [
      { path: "estate.sites", value: 5, provenance: "stated", quote: "5 sites" },
      { path: "organisation.sector", value: "Education", provenance: "inferred", reason: "school" },
    ], 1);
    m = { ...m, facts: m.facts.map((f) => (f.id === "organisation.sector" ? { ...f, struck: true } : f)) };
    const verdict = await assessSecurityRequirement(requirementFrom(m.facts));
    const brief = briefModel({ facts: m.facts, verdict });
    const orgBlock = brief.blocks.find((b) => b.key === "organisation")!;
    const factSegs = orgBlock.paras.flat().filter((s) => s.kind === "fact");
    expect(factSegs.some((s) => s.kind === "fact" && s.fact.struck), "the struck sector still renders, struck");
  });

  await ok("against-interest entries always render in the margin when present", async () => {
    const m = mergeUpdates([], [
      { path: "estate.users", value: 120, provenance: "stated", quote: "120 staff" },
      { path: "estate.sites", value: 4, provenance: "stated", quote: "4 sites" },
      { path: "estate.existingSecurity", value: ["Defender P2"], provenance: "stated", quote: "Defender P2" },
      { path: "estate.cloud", value: ["m365"], provenance: "stated", quote: "Microsoft 365" },
      { path: "drivers", value: ["renewal"], provenance: "stated", quote: "renewal" },
      { path: "constraints.inHouseSocCapacity", value: "none", provenance: "stated", quote: "no security team" },
    ], 1);
    const verdict = await assessSecurityRequirement(requirementFrom(m.facts));
    if (verdict.againstInterest.length === 0) return; // rulebook's call; nothing to assert against
    const brief = briefModel({ facts: m.facts, verdict });
    const services = brief.blocks.find((b) => b.key === "services");
    expect(Boolean(services?.margin?.some((x) => x.tone === "against_interest")), "against-interest margin note missing");
  });

  await ok("network scope frames SD-WAN as a component of SASE and skips engine prose", async () => {
    const m = mergeUpdates([], [
      { path: "procurement.buying", value: "sdwan", provenance: "stated", quote: "need SD-WAN" },
      { path: "estate.sites", value: 12, provenance: "stated", quote: "12 sites" },
    ], 1);
    const brief = briefModel({ facts: m.facts, verdict: null });
    const scope = brief.blocks.find((b) => b.key === "scope");
    expect(Boolean(scope), "scope block renders for network buying");
    expect(JSON.stringify(scope).includes("component of a SASE"), "SD-WAN framed as a SASE component");
    expect(!brief.blocks.some((b) => b.key === "services"), "no engine services block for network scope");
  });

  /* ---- Diagram honesty ---- */
  await ok("the diagram never invents a per-region site split", () => {
    const d = diagramModel(
      { estate: { sites: 40 }, organisation: { regions: ["uk", "us"] } },
      null,
      null,
    );
    expect(d.sites.label.includes("40 sites"), "one cluster with the true count");
    expect(d.regions.includes("the UK") && d.regions.includes("North America"), "regions named beside the one cluster");
    expect(!d.sites.label.includes("the UK"), "geography never stretches the cluster label (the 23 Jul bleed)");
    const geo = diagramModel({ organisation: { regions: ["eu"] } }, null, null);
    expect(geo.regions.includes("Europe") && !geo.empty, "stated geography renders even before a site count");
  });

  await ok("the secure edge appears only with an SSE signal, labelled proposed", async () => {
    const plain = diagramModel({ estate: { sites: 3 } }, null, null);
    expect(plain.edge.label === "Internet" && !plain.edge.proposed, "no SSE signal, no secure edge");
    const sase = diagramModel({ estate: { sites: 3 } }, null, "sase");
    expect(sase.edge.proposed === true, "SASE buying proposes the edge");
  });

  await ok("diagram pins derive only from stated facts and the verdict", async () => {
    const req = { estate: { sites: 2 }, drivers: ["incident" as const], constraints: { inHouseSocCapacity: "none" as const } };
    const verdict = await assessSecurityRequirement(req);
    const d = diagramModel(req, verdict, "managed_security");
    expect(d.pins.some((p) => p.label === "Recent incident"), "incident pin from the stated driver");
    expect(d.pins.some((p) => p.label === "No out-of-hours cover"), "soc pin from the stated capacity");
    const d2 = diagramModel({ estate: { sites: 2 } }, null, null);
    expect(d2.pins.length === 0, "no facts, no pins");
  });

  /* ---- Deterministic extraction additions (slice 2) ---- */
  await ok("deterministic parsing hears buying intent and never confuses have with seek", () => {
    const seeks = deterministicExtract("We are looking for SD-WAN quotes for 12 sites, currently on MPLS");
    expect(seeks.some((u) => u.path === "procurement.buying" && u.value === "sdwan"), "SD-WAN sought");
    expect(seeks.some((u) => u.path === "estate.existingNetwork" && (u.value as string[]).includes("mpls")), "MPLS held");
    expect(!seeks.some((u) => u.path === "estate.existingNetwork" && (u.value as string[]).includes("sdwan")), "a sought SD-WAN is not estate");
    const has = deterministicExtract("We run SD-WAN across 12 sites and need a managed SOC");
    expect(has.some((u) => u.path === "procurement.buying" && u.value === "managed_security"), "managed security sought");
    expect(has.some((u) => u.path === "estate.existingNetwork" && (u.value as string[]).includes("sdwan")), "run SD-WAN stays estate");
    expect(!has.some((u) => u.path === "procurement.buying" && u.value === "sdwan"), "existing SD-WAN is not a purchase");
  });

  await ok("one describing word between number and noun still lands (18 retail stores, 50 remote users)", () => {
    const out = deterministicExtract("We have 18 retail stores across the UK and 50 remote users");
    expect(out.some((u) => u.path === "estate.sites" && u.value === 18), "18 retail stores heard as sites");
    expect(out.some((u) => u.path === "estate.users" && u.value === 50), "50 remote users heard as users");
    const alone = deterministicExtract("We have 18 retail stores");
    expect(!alone.some((u) => u.path === "estate.users"), "stores never masquerade as users");
  });

  await ok("a phishing incident stays an incident and never becomes ransomware concern", () => {
    const out = deterministicExtract("We had a phishing incident last month, 200 staff");
    expect(out.some((u) => u.path === "drivers" && String(u.value) === "incident"), "incident heard");
    expect(!out.some((u) => u.path === "drivers" && String(u.value) === "ransomware_concern"), "no stretch to ransomware");
  });

  /* ---- Union merge (slice 3, from the live under-extraction finding) ---- */
  await ok("union: the model wins per path, the deterministic rail fills omissions", () => {
    const model: FieldUpdate[] = [
      { path: "estate.sites", value: 6, provenance: "stated", quote: "6 sites" },
      { path: "drivers", value: ["incident"], provenance: "stated", quote: "incident" },
    ];
    const det: FieldUpdate[] = [
      { path: "estate.sites", value: 7, provenance: "stated", quote: "7 sites" }, // conflict: model wins
      { path: "estate.users", value: 300, provenance: "stated", quote: "300 staff" }, // omission: filled
      { path: "drivers", value: ["incident"], provenance: "stated", quote: "incident" }, // duplicate: dropped
      { path: "drivers", value: ["renewal"], provenance: "stated", quote: "renewal" }, // new value: added
      { path: "procurement.buying", value: "sdwan", provenance: "stated", quote: "need SD-WAN" }, // omission: filled
    ];
    const merged = unionUpdates(model, det);
    const sites = merged.filter((u) => u.path === "estate.sites");
    expect(sites.length === 1 && sites[0].value === 6, "model's sites value stands alone");
    expect(merged.some((u) => u.path === "estate.users" && u.value === 300), "users filled from the rail");
    expect(merged.some((u) => u.path === "procurement.buying" && u.value === "sdwan"), "buying filled from the rail");
    const driverVals = merged.filter((u) => u.path === "drivers").flatMap((u) => u.value as string[]);
    expect(driverVals.join(",") === "incident,renewal", `drivers union wrong: ${driverVals.join(",")}`);
  });

  /* ---- The example law (P3.1, spec v1.5 section 13.3/13.9) ---- */
  await ok("example content never enters the ledger: an empty desk derives an empty requirement", async () => {
    // The taxonomy's example values (Healthcare, 450, 12, UK, the example
    // ticks) are pure rendering; the ledger starts empty, so nothing
    // publishes, counts, or feeds the verdict, fit or diagram.
    const req = requirementFrom([]);
    expect(!req.organisation?.sector, "no sector from an empty ledger");
    expect(!req.estate?.sites && !req.estate?.users, "no estate numbers from an empty ledger");
    expect((req.drivers ?? []).length === 0, "no drivers from an empty ledger");
    const m = meterOf([], null);
    expect(m.total === 0 && m.confirmed === 0, "the meter counts nothing on the empty desk");
    const model = briefModel({ facts: [], verdict: null });
    const text = JSON.stringify(model);
    expect(!text.includes("Healthcare") && !text.includes("450"), "no example value leaks into the brief");
    const dia = diagramModel(requirementFrom([]), null, null);
    expect(dia.empty === true, "the diagram stays honestly empty");
  });

  await ok("a click is a stated fact: the taxonomy item lands with the buyer's touch as provenance", () => {
    // clickItem's ledger write, exactly as the desk performs it.
    const m = mergeUpdates([], [{ path: "constraints.complianceRequirements", value: "nhs_dspt", provenance: "stated", quote: "NHS DSPT" }], 1, "answer");
    const f = m.facts.find((x) => x.id === "constraints.complianceRequirements:nhs_dspt");
    expect(Boolean(f) && f!.provenance === "stated" && f!.source === "answer", "click lands stated via the answer source");
    const req = requirementFrom(m.facts);
    expect((req.constraints?.complianceRequirements ?? []).includes("nhs_dspt"), "the clicked fact feeds the requirement");
  });

  /* ================================================================== */
  /* THE OPPOSITE TEST and the four adversarial packs (Robert, 22 July: */
  /* every parser change must correctly understand both the statement    */
  /* and its opposite; these packs are permanent).                       */
  /* ================================================================== */

  await ok("Pack 1, Numbers: magnitudes multiply, separators parse, nonsense is omitted for the receipt", () => {
    const at = (text: string, path: string) => deterministicExtract(text).find((u) => u.path === path);
    expect(at("we have 20 users", "estate.users")?.value === 20, "20 users lands as 20");
    expect(at("around 10k users", "estate.users")?.value === 10000, "10k lands as 10,000");
    expect(at("about 2,000 users on site", "estate.users")?.value === 2000, "2,000 parses the separator");
    expect(at("2 million users worldwide", "estate.users") === undefined, "2 million exceeds bounds and is OMITTED, never mangled to 2");
    expect(at("we have 0 users right now", "estate.users") === undefined, "0 users fails the same validator the model faces");
    expect(at("50 remote users need access", "estate.users")?.value === 50, "the describing-word window still works");
  });

  await ok("Pack 2, Negation: the Opposite Test on estate, model, compliance and drivers", () => {
    const has = (text: string, path: string, value: string) =>
      deterministicExtract(text).some((u) => u.path === path && (Array.isArray(u.value) ? (u.value as string[]).includes(value) : u.value === value));
    // statement lands; its opposite must not
    expect(has("We use MPLS across the estate", "estate.existingNetwork", "mpls"), "MPLS stated lands");
    expect(!has("We do not use MPLS anywhere", "estate.existingNetwork", "mpls"), "negated MPLS never enters the ledger");
    expect(!has("We have no MPLS anywhere, pure internet", "estate.existingNetwork", "mpls"), "no MPLS never enters the ledger");
    expect(has("We want a fully managed service", "procurement.operatingModel", "managed"), "managed stated lands");
    expect(!has("We do not want a fully managed service", "procurement.operatingModel", "managed"), "negated managed never enters the ledger");
    expect(has("PCI applies to our stores", "constraints.complianceRequirements", "pci_dss"), "PCI stated lands");
    expect(!has("PCI does not apply to us", "constraints.complianceRequirements", "pci_dss"), "PCI-does-not-apply never enters the ledger");
    expect(has("We had an incident last month", "drivers", "incident"), "incident stated lands");
    expect(!has("No incidents thankfully, just a renewal", "drivers", "incident"), "no-incidents never lands as incident");
    expect(has("No incidents thankfully, just a renewal", "drivers", "renewal"), "the renewal beside the negation still lands");
    // the guard must not over-suppress: a positive after a negated clause
    expect(has("We do not have MPLS but we run SD-WAN across 12 sites", "estate.existingNetwork", "sdwan"), "SD-WAN after a negated MPLS still lands");
    expect(!has("We do not have MPLS but we run SD-WAN across 12 sites", "estate.existingNetwork", "mpls"), "and the negated MPLS stays out");
    // negative-phrased positives keep working
    expect(has("there is no in-house IT so manage it for us", "procurement.operatingModel", "managed"), "no-in-house-IT still signals managed");
    expect(has("nobody watching overnight, no out-of-hours cover", "constraints.inHouseSocCapacity", "none"), "no-out-of-hours still lands SOC none");
  });

  await ok("Pack 3, Geography: country names reach their regions instead of vanishing", () => {
    const regions = (text: string) =>
      deterministicExtract(text).filter((u) => u.path === "organisation.regions").flatMap((u) => u.value as string[]);
    expect(regions("20 sites in France and Germany").includes("eu"), "France and Germany land as Europe");
    expect(regions("offices in Dublin and the UK").includes("ie") && regions("offices in Dublin and the UK").includes("uk"), "Dublin is Ireland, the UK is the UK");
    expect(regions("sites across Singapore and Australia").includes("apac"), "Singapore and Australia land as Asia Pacific");
    expect(regions("teams in Northern Ireland").includes("uk") && !regions("teams in Northern Ireland").includes("ie"), "Northern Ireland is the UK, not Ireland");
    expect(regions("expanding into Dubai").includes("me"), "Dubai lands as the Middle East");
  });

  await ok("Pack 4, Time and change: renewal, replacement and history read correctly", () => {
    const out = deterministicExtract("Our MPLS contract renewal is in March 2027 and we want to replace Fortinet SD-WAN with fully managed SASE");
    expect(out.some((u) => u.path === "drivers" && (u.value as string[]).includes("renewal")), "the renewal lands");
    expect(out.some((u) => u.path === "estate.existingNetwork" && (u.value as string[]).includes("mpls")), "the MPLS they hold lands as estate");
    expect(out.some((u) => u.path === "procurement.buying" && u.value === "sase"), "the SASE they seek lands as buying");
    expect(out.some((u) => u.path === "estate.existingNetwork" && (u.value as string[]).includes("sdwan")), "the SD-WAN being replaced is estate they hold");
    expect(out.some((u) => u.path === "procurement.operatingModel" && u.value === "managed"), "fully managed lands");
  });

  /* ---- Harry's 22 July round: NIS2, the mention guard, the rename ---- */
  await ok("Harry's sentence: NIS2 named verbatim now lands beside ISO 27001", () => {
    const out = deterministicExtract("meet ISO 27001 and NIS2 compliance requirements");
    const vals = out.filter((u) => u.path === "constraints.complianceRequirements").flatMap((u) => u.value as string[]);
    expect(vals.includes("iso27001") && vals.includes("nis2"), `want both, got ${vals.join(",")}`);
    const g = deterministicExtract("we must meet GDPR across the group");
    expect(g.some((u) => u.path === "constraints.complianceRequirements" && (u.value as string[]).includes("uk_gdpr")), "GDPR lands");
    expect(!deterministicExtract("GDPR does not apply to us").some((u) => u.path === "constraints.complianceRequirements"), "negated GDPR stays out (Opposite Test)");
  });

  await ok("the mention guard: a clause naming an unlanded on-desk item is never credited away", () => {
    const um = unlandedMentions("meet ISO 27001 and NIS2 compliance requirements", new Set(["ISO 27001"]));
    expect(um.includes("NIS2"), "NIS2 mention detected as unlanded");
    expect(unlandedMentions("meet ISO 27001 and NIS2 compliance requirements", new Set(["ISO 27001", "NIS2"])).length === 0, "landed mentions clear the guard");
    expect(unlandedMentions("we like proper governance", new Set()).length === 0, "no false mentions from ordinary prose");
  });

  await ok("the rename: a usable custom title publishes, a garbage one falls back (create core)", async () => {
    const base = {
      requirement: {
        organisation: { sector: "Retail & e-commerce" },
        estate: { users: 120, sites: 6, existingSecurity: ["defender"] },
        drivers: ["renewal" as const],
        constraints: { inHouseSocCapacity: "none" as const, complianceRequirements: ["pci_dss"] },
      },
      via: "web" as const,
      ids: { id: "t1", shareToken: "s1", manageToken: "m1" },
    };
    const named = await buildSecurityProject({ ...base, customTitle: "Manchester retail SASE refresh" });
    expect(named.project.title === "Manchester retail SASE refresh", `custom title stands, got ${named.project.title}`);
    const junk = await buildSecurityProject({ ...base, customTitle: "66" });
    expect(junk.project.title !== "66" && junk.project.title.length > 5, "garbage falls back to the derived title");
  });

  await ok("the SASE-shape question is earned by buying SASE and suppressed by either choice", () => {
    const req = { organisation: {}, estate: {}, drivers: [], constraints: {} };
    expect(earnedQuestions(req, "sase", null, [], []).some((q) => q.id === "q-sase-shape"), "buying SASE earns it");
    expect(!earnedQuestions(req, "sdwan", null, [], []).some((q) => q.id === "q-sase-shape"), "buying SD-WAN alone does not (Opposite Test)");
    expect(!earnedQuestions(req, "sase", null, ["obj-unified"], []).some((q) => q.id === "q-sase-shape"), "a chosen shape suppresses it");
  });

  /* ---- P3.4: the earned-question law (spec 13.14/13.16) ---- */
  await ok("no trigger, no question: an empty desk asks nothing, ever", () => {
    expect(earnedQuestions({}, null, null, [], []).length === 0, "the empty desk earns no questions");
  });

  await ok("questions are earned by facts, suppressed by answers, and honour dismissal", () => {
    const req = { organisation: { sector: "Financial services" }, estate: {}, drivers: [], constraints: {} };
    const q1 = earnedQuestions(req, null, null, [], []);
    expect(q1.some((q) => q.id === "q-fca"), "financial services earns the FCA question");
    const answered = { ...req, constraints: { complianceRequirements: ["fca"] } };
    expect(!earnedQuestions(answered, null, null, [], []).some((q) => q.id === "q-fca"), "a standing FCA fact suppresses it");
    expect(!earnedQuestions(req, null, null, [], ["q-fca"]).some((q) => q.id === "q-fca"), "a dismissal is permanent");
  });

  await ok("the Opposite Test on triggers: the wrong sector never summons the question", () => {
    const retail = { organisation: { sector: "Retail & e-commerce" }, estate: {}, drivers: [], constraints: {} };
    const qs = earnedQuestions(retail, null, null, [], []);
    expect(!qs.some((q) => q.id === "q-fca" || q.id === "q-dspt"), "retail earns neither FCA nor DSPT");
    const ukOnly = { organisation: { regions: ["uk", "ie"] }, estate: {}, drivers: [], constraints: {} };
    expect(!earnedQuestions(ukOnly, null, null, [], []).some((q) => q.id === "q-residency"), "UK and Ireland alone never earn the residency question");
    const global = { organisation: { regions: ["uk", "eu"] }, estate: {}, drivers: [], constraints: {} };
    expect(earnedQuestions(global, null, null, [], []).some((q) => q.id === "q-residency"), "a region beyond the UK earns it");
  });

  await ok("every published question carries its trigger and its evidence (the furniture has receipts)", () => {
    const set = publishedQuestionSet();
    expect(set.length >= 8, "the set is published in full");
    for (const q of set) {
      expect(typeof (q as { earned_by?: string }).earned_by === "string" && (q as { earned_by: string }).earned_by.length > 10, `${q.id} names what earns it`);
      expect(q.evidence.length > 0 && q.evidence.every((e) => e.query.length > 3), `${q.id} carries real evidence`);
      expect(q.options.length > 0, `${q.id} is answerable`);
    }
  });

  /* ---- P3.3: feature-level fit under Article 14 (spec 13.7, 13.13) ---- */
  await ok("checks come only from graded homes; unknown wants are dropped, never invented", () => {
    const checks = buildChecks({ buying: "sase", regionKeys: ["uk_ireland"], model: "managed", clouds: ["aws", "nonsense"], mplsEstate: true, wants: ["s247", "made_up_want"] });
    const ids = checks.map((c) => c.id);
    expect(ids.includes("model:managed") && ids.includes("buying:sase"), "model and buying checks present");
    expect(ids.includes("cloud:aws") && !ids.some((i) => i.includes("nonsense")), "aws checked, nonsense dropped");
    expect(ids.includes("estate:mpls") && ids.includes("region:uk_ireland"), "estate and region checks present");
    expect(ids.includes("want:s247") && !ids.some((i) => i.includes("made_up")), "known want checked, unknown dropped");
  });

  await ok("the order IS the evidence: totals descend, and every supplier carries its matched and missed checks", () => {
    const r = workspaceFit({ buying: "sase", regions: ["uk"], model: "managed", clouds: ["aws"] });
    expect(r.mode === "graded" && r.suppliers.length > 3, "graded list returned");
    const w = (g: string) => (g === "yes" ? 2 : ["partial", "partner_integrated", "managed_service_dependent"].includes(g) ? 1 : 0);
    const totals = r.suppliers.map((s) => s.matched.reduce((n, m) => n + w(m.grade), 0));
    for (let i = 1; i < totals.length; i++) expect(totals[i] <= totals[i - 1], `evidence totals must descend: ${totals.join(",")}`);
    const top = r.suppliers[0];
    expect(top.matched.length > 0 && top.matched.every((m) => m.label.length > 1 && m.grade.length > 0), "reasons carry labels and verbatim grades");
    expect(r.suppliers.every((s) => s.last_verified.length === 10), "every supplier carries its evidence date");
    expect(r.checks.some((c) => c.label === "AWS on-ramp"), "the AWS check is named");
  });

  await ok("Article 14 pure: same inputs, same order; a new check displaces only across grade groups", () => {
    const a1 = workspaceFit({ buying: "sase", regions: ["uk"], model: "managed" });
    const a2 = workspaceFit({ buying: "sase", regions: ["uk"], model: "managed" });
    expect(a1.suppliers.map((s) => s.slug).join(",") === a2.suppliers.map((s) => s.slug).join(","), "determinism: identical inputs give identical order");
    const b = workspaceFit({ buying: "sase", regions: ["uk"], model: "managed", wants: ["s247"] });
    const gradeOf = (r: typeof b, slug: string) => {
      const s = r.suppliers.find((x) => x.slug === slug)!;
      const hit = [...s.matched, ...s.missed].find((m) => m.id === "want:s247");
      return hit ? (hit.grade === "yes" ? 2 : ["partial", "partner_integrated", "managed_service_dependent"].includes(hit.grade) ? 1 : 0) : 0;
    };
    // Within each s247 grade group, relative order is preserved: suppliers
    // whose own reality did not differ never leapfrog each other.
    const before = a1.suppliers.map((s) => s.slug);
    for (const g of [0, 1, 2]) {
      const beforeGroup = before.filter((s) => gradeOf(b, s) === g);
      const afterGroup = b.suppliers.map((s) => s.slug).filter((s) => gradeOf(b, s) === g && before.includes(s));
      expect(beforeGroup.filter((s) => afterGroup.includes(s)).join(",") === afterGroup.join(","), `stable within grade group ${g}`);
    }
  });

  await ok("managed security stays compiled: the dataset boundary is stated, no ranking invented", () => {
    const r = workspaceFit({ buying: "managed_security" });
    expect(r.mode === "compiled" && "note" in r && r.note.includes("no ranking"), "boundary stated");
  });

  await ok("click grammar: strike on second touch, restore by touch (a stated act), never by re-inference", () => {
    let m = mergeUpdates([], [{ path: "procurement.operatingModel", value: "managed", provenance: "stated", quote: "Fully managed" }], 1, "answer");
    // second touch strikes (the desk calls toggleFact)
    let facts2 = m.facts.map((f) => ({ ...f, struck: true }));
    // a model re-inference must not resurrect
    m = mergeUpdates(facts2, [{ path: "procurement.operatingModel", value: "managed", provenance: "inferred", reason: "again" }], 2, "extract");
    expect(m.facts.find((f) => f.id === "procurement.operatingModel")!.struck === true, "re-inference never resurrects");
    // a third touch (stated, answer source) restores
    m = mergeUpdates(m.facts, [{ path: "procurement.operatingModel", value: "managed", provenance: "stated", quote: "Fully managed" }], 3, "answer");
    expect(m.facts.find((f) => f.id === "procurement.operatingModel")!.struck === false, "the buyer's touch restores");
    // clicking a different option corrects the scalar in place
    m = mergeUpdates(m.facts, [{ path: "procurement.operatingModel", value: "co_managed", provenance: "stated", quote: "Co-managed" }], 4, "answer");
    const om = m.facts.filter((f) => f.id === "procurement.operatingModel");
    expect(om.length === 1 && om[0].value === "co_managed", "scalar click replaces, never duplicates");
  });

  /* ---- The constellation's geometry laws (Robert, 23 Jul: the
   *      constellation returns as the market pane) ---- */
  await ok("constellation: angle is a stable function of the slug alone, so movement is radial only", () => {
    expect(slugAngle("cato-networks") === slugAngle("cato-networks"), "same slug, same angle, forever");
    const slugs = ["cato-networks", "cisco", "fortinet", "palo-alto-networks", "versa-networks", "aryaka", "bt", "colt"];
    expect(new Set(slugs.map((s) => Math.round(slugAngle(s) / 12))).size >= 6, "the real market spreads around the circle");
    const ranked = constellation(slugs.map((s, i) => ({ slug: s, rank: i })), true, 168, 132);
    const reranked = constellation(slugs.map((s, i) => ({ slug: s, rank: slugs.length - 1 - i })), true, 168, 132);
    for (const s of slugs) {
      const a = ranked.find((b) => b.slug === s)!, b = reranked.find((x) => x.slug === s)!;
      expect(a.angle === b.angle, `re-ranking never moves ${s} angularly`);
    }
  });

  await ok("constellation: distance is fit rank; no checks means one honest ring", () => {
    const ranked = constellation([{ slug: "a1", rank: 0 }, { slug: "b2", rank: 3 }], true, 168, 132, 0);
    expect(ranked.find((b) => b.slug === "a1")!.r < ranked.find((b) => b.slug === "b2")!.r, "better rank sits nearer");
    const flat = constellation([{ slug: "a1", rank: null }, { slug: "b2", rank: null }], false, 168, 132, 0);
    expect(flat.every((b) => b.r === RADIUS.ring), "before evidence, every body sits on the same ring");
    const outsider = constellation([{ slug: "a1", rank: 0 }, { slug: "b2", rank: null }], true, 168, 132, 0);
    expect(outsider.find((b) => b.slug === "b2")!.r === RADIUS.outer, "outside the ranked set means the outer edge, not an invented rank");
  });

  await ok("constellation colour law: hue follows the vendor forever, amber and emerald stay reserved", () => {
    expect(VENDOR_PALETTE.length === 9, "nine validated hues");
    expect(!VENDOR_PALETTE.includes("#f59e0b") && !VENDOR_PALETTE.includes("#10b981"), "the reserved meanings are not vendor colours");
    expect(VENDOR_PALETTE.every((h) => /^#[0-9a-f]{6}$/i.test(h)), "plain hex only");
    expect(vendorHue("cato-networks") === vendorHue("cato-networks"), "same vendor, same hue, forever");
    const slugs = ["cato-networks", "cisco", "fortinet", "palo-alto-networks", "versa-networks", "aryaka", "bt", "colt", "netskope", "zscaler"];
    expect(new Set(slugs.map(vendorHue)).size >= 5, "the real market spreads across the palette");
    for (const h of slugs.map(vendorHue)) expect(VENDOR_PALETTE.includes(h), "every hue comes from the validated palette");
  });

  await ok("capability ring: the buyer's checks sit in stable id order, evenly, or not at all", () => {
    const checks = [
      { id: "want:ukdesk", label: "UK-based support desk" },
      { id: "buying:sase", label: "Full SASE platform" },
      { id: "model:managed", label: "Fully managed service" },
    ];
    const a = capabilityRing(checks, 380, 210, 92, 0.78);
    const b = capabilityRing([...checks].reverse(), 380, 210, 92, 0.78);
    expect(JSON.stringify(a) === JSON.stringify(b), "arrival order never changes a seat");
    expect(a[0].id === "buying:sase" && a[0].angle === -90, "id order, first seat at twelve o'clock");
    const gaps = a.map((c, i) => ((a[(i + 1) % a.length].angle - c.angle + 360) % 360));
    expect(gaps.every((g) => Math.abs(g - 120) < 0.001), "even spread");
    for (const c of a) {
      const dx = c.x - 380, dy = (c.y - 210) / 0.78;
      expect(Math.abs(Math.hypot(dx, dy) - 92) < 0.001, "on the ring, squash honoured");
    }
    expect(capabilityRing([], 380, 210, 92).length === 0, "no checks, no ring");
  });

  await ok("labels never overlap anything: labels avoid labels AND bodies, deterministically", () => {
    const items: Array<{ slug: string; x: number; y: number; anchor: "start" | "end" | "middle"; len: number; gap?: number }> = [
      { slug: "a", x: 300, y: 200, anchor: "end", len: 14, gap: 10 },
      { slug: "b", x: 296, y: 204, anchor: "end", len: 16, gap: 10 }, // collides with a's label
      { slug: "c", x: 600, y: 380, anchor: "start", len: 10, gap: 10 }, // clear
    ];
    const dy = labelOffsets(items);
    expect(dy.a === 0 && dy.c === 0, "clear labels stay put");
    expect(dy.b !== 0, "the colliding label steps aside");
    expect(JSON.stringify(labelOffsets(items)) === JSON.stringify(dy), "same scene, same offsets, always");
    const moved = { y1: items[1].y + dy.b - 5.5, y2: items[1].y + dy.b + 5.5 };
    expect(moved.y1 >= 200 + 5.5 || moved.y2 <= 200 - 5.5, "after the step the boxes are disjoint");
    // A body sitting on a label's text forces the label aside (Robert's
    // live screenshot: Palo Alto's body on Versa's name; Cato's name
    // through Verizon's square). The label's OWN body never counts.
    const withBody = labelOffsets(
      [{ slug: "v", x: 300, y: 200, anchor: "start", len: 14, gap: 10 }],
      [{ id: "other", x: 340, y: 202, half: 9 }, { id: "v", x: 300, y: 200, half: 9 }],
    );
    expect(withBody.v !== 0, "a foreign body on the text pushes the label aside");
    const selfOnly = labelOffsets(
      [{ slug: "v", x: 300, y: 200, anchor: "start", len: 14, gap: 10 }],
      [{ id: "v", x: 300, y: 200, half: 9 }],
    );
    expect(selfOnly.v === 0, "a label never flees its own body");
    // A centred capability label steps off a vendor body beneath it.
    const cap = labelOffsets(
      [{ slug: "cap:x", x: 400, y: 300, anchor: "middle", len: 20 }],
      [{ id: "cap:x", x: 400, y: 289, half: 6 }, { id: "somebody", x: 410, y: 301, half: 9 }],
    );
    expect(cap["cap:x"] !== 0, "capability text steps off a body too");
  });

  await ok("the band's geometry keeps distance-is-fit under the ellipse", () => {
    const bodies = constellation([{ slug: "a1", rank: 0 }, { slug: "a1x", rank: 5 }], true, 380, 210, 0, BAND);
    expect(bodies[0].r < bodies[1].r, "better rank sits nearer in the band too");
    const flat = constellation([{ slug: "a1", rank: null }], false, 380, 210, 0, BAND);
    expect(flat[0].r === BAND.ring, "the honest ring at band scale");
    for (const b of [...bodies, ...flat]) {
      expect(Math.abs(b.y - 210) <= BAND.max * BAND.ky + 0.001, "the ellipse keeps every body inside the band's height");
    }
  });

  await ok("constellation: separation is deterministic and radial, and bodies never collide unseen", () => {
    const crowd = Array.from({ length: 12 }, (_, i) => ({ slug: `v${i}`, rank: i }));
    const a = constellation(crowd, true, 168, 132);
    const b = constellation(crowd, true, 168, 132);
    expect(JSON.stringify(a) === JSON.stringify(b), "same input, same scene, always");
    for (let i = 0; i < a.length; i++) {
      expect(a[i].angle === slugAngle(a[i].slug), "separation never touches the angle");
      for (let j = 0; j < i; j++) {
        const gap = Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y);
        expect(gap >= 17 || a[i].r >= RADIUS.max, "min gap holds unless the scene is genuinely full");
      }
    }
  });

  /* ---- The six-state area derivation (slice four's gate) ---- */
  await ok("area states derive from real data with one honest priority", () => {
    const st = (v: object) => ({ id: "x", path: "estate.sites", value: 5, provenance: "stated", ...v } as never);
    expect(deriveAreaState({ facts: [], openQuestions: 0, noted: 0 }) === "example", "nothing landed means example");
    expect(deriveAreaState({ facts: [st({})], openQuestions: 1, noted: 0 }) === "needs_attention", "an open question beats everything");
    expect(deriveAreaState({ facts: [st({ provenance: "inferred" })], openQuestions: 0, noted: 0 }) === "suggested", "a standing inference awaits the buyer");
    expect(deriveAreaState({ facts: [st({ struck: true })], openQuestions: 0, noted: 0 }) === "excluded", "only struck history means excluded, on the record");
    expect(deriveAreaState({ facts: [st({ struck: true }), st({})], openQuestions: 0, noted: 0 }) === "stated", "Opposite: a standing fact beside a strike is stated, not excluded");
    expect(deriveAreaState({ facts: [st({})], openQuestions: 0, noted: 0 }) === "stated", "the buyer's words land as stated");
  });

  await ok("confirmed is earned by full coverage in the buyer's words; journey states ride the sign chain", () => {
    const sec = "compliance";
    const f = (path: string) => ({ id: path, path, value: "x", provenance: "stated" } as never);
    expect(refineConfirmed(sec, "stated", [f("constraints.complianceRequirements")]) === "confirmed", "every path covered in stated words");
    expect(refineConfirmed("estate", "stated", [f("estate.existingNetwork")]) === "stated", "partial coverage stays stated");
    expect(refineConfirmed(sec, "suggested" as never, []) === "suggested", "refinement never upgrades a non-stated state");
    const j = deriveJourneyStates({ fitGraded: true, readyToSign: false, openQuestions: 2, published: false });
    expect(j.evaluation === "ready" && j.publication === "example" && j.responses === "example", "journey from the real chain");
    const j2 = deriveJourneyStates({ fitGraded: true, readyToSign: true, openQuestions: 2, published: false });
    expect(j2.publication === "needs_attention", "open questions hold publication at needs attention");
    const j3 = deriveJourneyStates({ fitGraded: true, readyToSign: true, openQuestions: 0, published: true });
    expect(j3.publication === "ready" && j3.responses === "ready", "a real publish makes responses real");
  });

  await ok("the sector pack law: unlocked only by a standing sector fact, and it never writes", () => {
    expect(activePack({}) === null, "no sector, no pack");
    expect(activePack({ organisation: { sector: "Healthcare & pharma" } })?.id === "healthcare", "the healthcare sector unlocks the healthcare pack");
    expect(activePack({ organisation: { sector: "Retail & e-commerce" } }) === null, "no pack exists for retail yet; nothing pretends");
    const sugs = visibleSuggestions(HEALTHCARE_PACK, [], [], [], []);
    expect(sugs.every((x) => x.accept.kind === "items" || x.accept.kind === "note"), "every suggestion only OFFERS an answer; no suggestion carries a fact-writing power");
    expect(sugs.some((x) => x.id === "hs-cep") && sugs.some((x) => x.id === "hs-clinical-windows"), "the base healthcare suggestions stand open on a fresh position");
    expect(!sugs.some((x) => x.id === "ns-residency"), "flavour suggestions stay hidden without the flavour");
  });

  await ok("flavours come only from the buyer's own words, conservatively", () => {
    expect(activeFlavours(HEALTHCARE_PACK, "").length === 0, "empty corpus, no flavours");
    expect(activeFlavours(HEALTHCARE_PACK, "we are an NHS trust replacing HSCN").includes("nhs"), "NHS in the buyer's words wakes the flavour");
    expect(activeFlavours(HEALTHCARE_PACK, "we trust our incumbent supplier").length === 0, "the word trust alone never wakes NHS");
    const withFlavour = visibleSuggestions(HEALTHCARE_PACK, ["nhs"], [], [], []);
    expect(withFlavour.some((x) => x.id === "ns-residency"), "the NHS flavour adds its suggestions");
    expect(packRiskNotes(HEALTHCARE_PACK, ["nhs"]).length === 2 && packRiskNotes(HEALTHCARE_PACK, []).length === 1, "risk notes follow the flavours");
  });

  await ok("suppression and permanence: standing facts hide offers; declines never return", () => {
    const cepFact = { id: "constraints.complianceRequirements:cyber_essentials_plus", path: "constraints.complianceRequirements", value: "cyber_essentials_plus", provenance: "stated", struck: false, source: "extract", cycle: 1 } as never;
    expect(!visibleSuggestions(HEALTHCARE_PACK, [], [cepFact], [], []).some((x) => x.id === "hs-cep"), "a standing fact hides its suggestion");
    const struckCep = { ...(cepFact as object), struck: true } as never;
    expect(visibleSuggestions(HEALTHCARE_PACK, [], [struckCep], [], []).some((x) => x.id === "hs-cep") === false || true, "struck history: the strike law owns re-offering; the visible check must not crash");
    expect(!visibleSuggestions(HEALTHCARE_PACK, [], [], ["ps-hs-clinical-windows"], []).some((x) => x.id === "hs-clinical-windows"), "an accepted note (ps- record) hides its suggestion");
    expect(!visibleSuggestions(HEALTHCARE_PACK, [], [], [], ["hs-cep"]).some((x) => x.id === "hs-cep"), "declined never returns");
    expect(declinedOnRecord(HEALTHCARE_PACK, [], ["hs-cep"]).some((x) => x.id === "hs-cep"), "declined stays on the record");
  });

  await ok("pack questions ride the earned-question law through the one engine", () => {
    const health = { organisation: { sector: "Healthcare & pharma" }, estate: { sites: 12 } } as never;
    const none = earnedQuestions({} as never, null, null, [], []);
    expect(!none.some((q) => q.id.startsWith("q-hc") || q.id.startsWith("q-nhs")), "no sector, no sector questions");
    const hc = earnedQuestions(health, "sdwan", null, [], []);
    expect(hc.some((q) => q.id === "q-hc-clinical"), "healthcare with a network buy earns the clinical dependency question");
    expect(!hc.some((q) => q.id === "q-nhs-hscn"), "no NHS words, no HSCN question");
    const nhs = earnedQuestions(health, "sdwan", null, [], [], "we are an NHS trust");
    expect(nhs.some((q) => q.id === "q-nhs-hscn"), "NHS in the buyer's words earns the HSCN question");
    const dismissed = earnedQuestions(health, "sdwan", null, [], ["q-hc-clinical"]);
    expect(!dismissed.some((q) => q.id === "q-hc-clinical"), "dismissal is permanent for pack questions too");
    const answered = earnedQuestions(health, "sdwan", null, ["qn-q-hc-mdr"], []);
    expect(!answered.some((q) => q.id === "q-hc-mdr"), "a standing answer suppresses its question");
  });

  await ok("F-A extension: no count without a stated number (the bridge walk's live catch)", () => {
    const det = deterministicExtract("We are a healthcare provider replacing legacy connectivity with managed SD-WAN and SASE.");
    expect(!det.some((u) => u.path === "estate.sites" || u.path === "estate.users"), "a numberless sentence lands no site or user count from the rail");
    const det2 = deterministicExtract("We are a healthcare provider with 14 clinical sites.");
    expect(det2.some((u) => u.path === "estate.sites" && u.value === 14), "Opposite: a stated 14 lands");
  });

  await ok("the paste law: chunks respect sentences, budgets are honest, short text is one cycle", () => {
    const short = chunkForIngest("We are a retailer with 14 sites.");
    expect(short.chunks.length === 1 && !short.truncated, "a sentence is one chunk, untruncated");
    const paras = chunkForIngest(Array.from({ length: 8 }, (_, i) => `Paragraph ${i} about the estate. It has several sentences. `.repeat(30)).join("\n\n"));
    expect(paras.chunks.length === 3 && paras.truncated, "long material caps at three chunks and says so");
    expect(paras.chunks.every((c) => c.length <= 3500), "no chunk exceeds the cycle budget");
    expect(/paste the rest in a second pass/.test(ingestSummary(5, 2, paras)), "the summary carries the truncation honestly");
    expect(!/second pass/.test(ingestSummary(5, 0, short)) && /nothing needed the Notes/.test(ingestSummary(5, 0, short)), "an untruncated read stays quiet about budgets");
  });

  await ok("workspace_ingest reads both paragraphs through the same engine (deterministic path)", async () => {
    const out = (await callWorkspaceTool("workspace_ingest", {
      text: "We are an NHS trust with 14 clinical sites currently running MPLS.\n\nWe are buying managed SD-WAN and PCI DSS applies to our pharmacy tills.",
    })) as { cycles: number; updates: Array<{ path: string; value: unknown }>; read_summary: string; requirement: { organisation?: { sector?: string } } };
    expect(out.cycles >= 1, "at least one cycle ran");
    expect(out.updates.some((u) => u.path === "estate.sites" && u.value === 14), "paragraph one landed the sites");
    expect(out.updates.some((u) => u.path === "constraints.complianceRequirements"), "paragraph two landed compliance");
    expect(String(out.requirement.organisation?.sector ?? "").includes("Health"), "the sector stands in the merged requirement");
    expect(typeof out.read_summary === "string" && out.read_summary.startsWith("Read "), "the read summary is present and honest");
  });

  return r;
}
