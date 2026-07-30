/**
 * SECTOR PACKS (Robert's go, 24 Jul 2026, on the sector intelligence
 * challenge): sector is the lens, never a second ledger. A pack is a pure,
 * versioned, dated parameter set that a STANDING SECTOR FACT unlocks. It
 * influences through the doors that already exist and holds no authority:
 *
 *  - PACK QUESTIONS join the earned-question engine (13.14 discipline:
 *    a trigger from the buyer's own facts, a suppressor, evidence).
 *  - PACK SUGGESTIONS are offered clauses with an accept and decline
 *    lifecycle. Accepting lands through the desk's own machinery (the
 *    same item click or stated note an earned question uses), so the
 *    provenance is the buyer's touch, never the pack's. Declining is
 *    permanent and stays on the record: "suggested for healthcare,
 *    declined; kept on the record."
 *  - RISK NOTES are advice with provenance (the pack id and version),
 *    rendered quietly, never published, never facts.
 *
 * THE PACK LAW (fixtured): no pack ever writes a fact. Only the buyer's
 * answer or touch does. A suggestion whose fact already stands never
 * shows; a declined suggestion never returns.
 *
 * Flavours overlay a base pack when the buyer's own words show them (NHS
 * over healthcare). Flavour detection is conservative: no words, no
 * flavour, no content.
 *
 * Evidence grounding: Robert's search console and AI Performance reading,
 * 24 Jul 2026, showed buyers arriving through sector-shaped query families
 * (healthcare strongest: healthcare managed services, MDR for healthcare,
 * healthcare IAM, NHS cloud deployments). Those families are recorded per
 * question via the console_sector_2407 evidence source; counts are not
 * claimed because none were recorded.
 *
 * PURE: no I/O, no React (Article 17). Versioned like the rulebook.
 */

import type { EarnedQuestion, QuestionAnswer, QuestionEvidence } from "@/lib/workspace/questions";
import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import type { BuyingId } from "@/lib/workspace/extract";

export const PACKS_VERSION = "sector-packs v2026-07-24";

export type PackSuggestion = {
  id: string;
  /** Taxonomy section the suggestion renders inside (in place, 13.6). */
  section: string;
  label: string;
  /** Why this sector earns the suggestion; renders beside it and in the log. */
  reason: string;
  /** Accepting lands through the desk's own machinery: an existing
   *  taxonomy item (the buyer's touch) or a stated note (their words kept). */
  accept: Extract<QuestionAnswer, { kind: "items" } | { kind: "note" }>;
  evidence?: QuestionEvidence[];
};

export type PackRiskNote = { id: string; text: string };

export type PackQuestionCtx = {
  requirement: SecurityRequirementInput;
  buying: BuyingId | null;
  opModel: string | null;
  notedIds: string[];
  /** The buyer's own words (fact quotes, receipts, the title): flavour
   *  detection and nothing else. Empty means no flavour, conservatively. */
  corpus: string;
};

export type PackQuestion = EarnedQuestion & {
  earnedBy: (c: PackQuestionCtx) => boolean;
  earnedByProse: string;
};

export type SectorPack = {
  id: string;
  label: string;
  version: string;
  /** Matches the standing organisation.sector value. */
  sectorMatch: RegExp;
  flavours: Array<{ id: string; label: string; match: RegExp }>;
  questions: PackQuestion[];
  suggestions: PackSuggestion[];
  flavourSuggestions: Record<string, PackSuggestion[]>;
  riskNotes: PackRiskNote[];
  flavourRiskNotes: Record<string, PackRiskNote[]>;
};

const sectorIs = (r: SecurityRequirementInput, re: RegExp) => re.test(String(r.organisation?.sector ?? ""));
const networkBuying = (b: BuyingId | null) => b === "sase" || b === "sdwan" || b === "sse";
const hasNoted = (ids: string[], id: string) => ids.includes(id);

/** The pilot pack (the strategy doc's recommended first pair): healthcare,
 *  with the NHS flavour. The hardest test of influence without authority. */
export const HEALTHCARE_PACK: SectorPack = {
  id: "healthcare",
  label: "Healthcare",
  version: PACKS_VERSION,
  sectorMatch: /health|pharma/i,
  flavours: [
    { id: "nhs", label: "NHS", match: /\bnhs\b|\bhscn\b|integrated care (?:board|system)|\bicb\b/i },
  ],
  questions: [
    {
      id: "q-hc-mdr",
      question: "Healthcare buyers increasingly pair network change with managed detection and response. Is MDR in scope here?",
      section: "security",
      weight: 78,
      earnedBy: (c) =>
        sectorIs(c.requirement, /health|pharma/i) &&
        !hasNoted(c.notedIds, "qn-q-hc-mdr") &&
        c.buying !== "managed_security",
      earnedByProse: "the buyer's sector is healthcare and managed security is not already what is being bought",
      options: [
        { label: "MDR in scope", answer: { kind: "note", text: "Managed detection and response (MDR) in scope alongside the network service" } },
        { label: "Not in scope", answer: { kind: "dismiss" } },
      ],
      evidence: [{ source: "console_sector_2407", query: "managed detection and response for healthcare" }],
    },
    {
      id: "q-hc-iam",
      question: "Identity questions follow healthcare procurements. Should vendors state how they integrate with your identity provider?",
      section: "security",
      weight: 74,
      earnedBy: (c) => sectorIs(c.requirement, /health|pharma/i) && !hasNoted(c.notedIds, "qn-q-hc-iam"),
      earnedByProse: "the buyer's sector is healthcare",
      options: [
        { label: "Yes, ask bidders", answer: { kind: "note", text: "Vendors to state identity provider integration (IAM) in their response" } },
        { label: "Not needed", answer: { kind: "dismiss" } },
      ],
      evidence: [{ source: "console_sector_2407", query: "healthcare identity and access management" }],
    },
    {
      id: "q-hc-clinical",
      question: "Do clinical systems (EPR, PACS, pathology) depend on the sites being changed?",
      section: "change",
      weight: 86,
      earnedBy: (c) =>
        sectorIs(c.requirement, /health|pharma/i) &&
        networkBuying(c.buying) &&
        (c.requirement.estate?.sites ?? 0) >= 2 &&
        !hasNoted(c.notedIds, "qn-q-hc-clinical"),
      earnedByProse: "the buyer's sector is healthcare, a network service is being bought and more than one site is stated",
      options: [
        { label: "Yes, clinical systems depend on them", answer: { kind: "note", text: "Clinical systems depend on affected sites; change windows and rollback plans to be agreed around clinical safety" } },
        { label: "No clinical dependency", answer: { kind: "dismiss" } },
      ],
      evidence: [{ source: "console_sector_2407", query: "healthcare managed services and implementation concerns" }],
    },
    {
      id: "q-nhs-hscn",
      question: "HSCN: does any site still depend on Health and Social Care Network connectivity, and does it stay or migrate?",
      section: "estate",
      weight: 87,
      earnedBy: (c) =>
        sectorIs(c.requirement, /health|pharma/i) &&
        networkBuying(c.buying) &&
        HEALTHCARE_PACK.flavours[0].match.test(c.corpus) &&
        !hasNoted(c.notedIds, "qn-q-nhs-hscn"),
      earnedByProse: "the buyer's own words show NHS context and a network service is being bought",
      options: [
        { label: "HSCN stays, integrate it", answer: { kind: "note", text: "HSCN dependency remains and must be integrated with the new network" } },
        { label: "HSCN migrates away", answer: { kind: "note", text: "HSCN connectivity migrates away as part of this project" } },
        { label: "No HSCN dependency", answer: { kind: "dismiss" } },
      ],
      evidence: [{ source: "console_sector_2407", query: "NHS cloud deployments" }],
    },
  ],
  suggestions: [
    {
      id: "hs-cep",
      section: "compliance",
      label: "Cyber Essentials Plus expected of bidders",
      reason: "healthcare buyers commonly require it of vendors handling patient-adjacent systems",
      accept: { kind: "items", itemIds: ["c-cep"] },
      evidence: [{ source: "console_sector_2407", query: "healthcare managed services" }],
    },
    {
      id: "hs-clinical-windows",
      section: "change",
      label: "Changes scheduled around clinical safety windows",
      reason: "implementation concerns recur in healthcare buyer searches; rollback plans protect clinical continuity",
      accept: { kind: "note", text: "Changes scheduled around clinical safety windows; rollback plans required" },
      evidence: [{ source: "console_sector_2407", query: "healthcare managed services and implementation concerns" }],
    },
  ],
  flavourSuggestions: {
    nhs: [
      {
        id: "ns-residency",
        section: "compliance",
        label: "UK data residency for patient-adjacent traffic",
        reason: "NHS deployments typically constrain where patient-adjacent traffic may break out",
        accept: { kind: "note", text: "UK data residency required for patient-adjacent traffic" },
        evidence: [{ source: "console_sector_2407", query: "NHS cloud deployments" }],
      },
    ],
  },
  riskNotes: [
    { id: "hr-winter", text: "Winter pressures commonly freeze clinical network change from late November; plan cutovers outside them." },
  ],
  flavourRiskNotes: {
    nhs: [
      { id: "nr-hscn-lead", text: "HSCN peering and information governance sign-off commonly add lead time; vendors should evidence NHS onboarding experience." },
    ],
  },
};

export const SECTOR_PACKS: SectorPack[] = [HEALTHCARE_PACK];

/** Every pack question across all packs, for the engine and the feeds. */
export const PACK_QUESTIONS: PackQuestion[] = SECTOR_PACKS.flatMap((p) => p.questions);
