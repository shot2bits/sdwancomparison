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
import { diagramModel } from "./diagram";
import { deterministicExtract, unionUpdates, type FieldUpdate } from "./extract";
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
    expect(d.sites.label.includes("the UK") && d.sites.label.includes("North America"), "regions named on the one cluster");
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

  return r;
}
