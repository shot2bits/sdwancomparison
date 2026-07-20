/**
 * SEC-RULES-2026.1 approved test fixtures (review pack F1 to F6, with
 * Robert's 21 July amendments applied). These are the parity suite: the
 * rulebook must satisfy every expectation here before any route ships, and
 * the page advisor and the MCP tool must both reproduce them, because both
 * call the one function.
 */

import type { SecurityRequirementInput } from "./rulebook";

export interface FixtureExpectation {
  capability: string;
  needed: string;
  route?: string | null;
}

export interface SecurityFixture {
  id: string;
  title: string;
  input: SecurityRequirementInput;
  expect: {
    path: string | null;
    confidence?: string;
    capabilities: FixtureExpectation[];
    againstInterestCapabilities?: string[];
    minGaps?: number;
  };
}

export const SECURITY_FIXTURES: SecurityFixture[] = [
  {
    id: "F1",
    title: "SMB product fit (MDR-1c: audit does not over-prescribe)",
    input: {
      organisation: { sector: "professional services" },
      estate: {
        users: 35,
        sites: 1,
        devices: { computers: 40, mobiles: 10 },
        cloud: ["m365"],
        existingSecurity: [],
      },
      drivers: ["audit"],
      constraints: { inHouseSocCapacity: "none", complianceRequirements: [] },
    },
    expect: {
      path: "product_path",
      confidence: "high",
      capabilities: [
        { capability: "endpoint", needed: "required", route: "bt_product" },
        { capability: "mdr_soc", needed: "recommended", route: "marketplace_service" },
        { capability: "awareness", needed: "recommended", route: "bt_product" },
      ],
      againstInterestCapabilities: [],
    },
  },
  {
    id: "F2",
    title: "Enterprise managed service with the keep-Defender denial",
    input: {
      organisation: { sector: "finance", sizeBand: "large" },
      estate: {
        users: 300,
        sites: 4,
        devices: { computers: 280, mobiles: 150, servers: 20 },
        cloud: ["m365", "aws"],
        existingSecurity: ["Microsoft Defender P2"],
        existingNetwork: ["internet"],
      },
      drivers: ["incident", "compliance"],
      constraints: { inHouseSocCapacity: "none", complianceRequirements: ["iso27001"] },
    },
    expect: {
      path: "service_path",
      confidence: "medium",
      capabilities: [
        { capability: "endpoint", needed: "not_indicated", route: null },
        { capability: "mdr_soc", needed: "required", route: "marketplace_service" },
        { capability: "siem_logging", needed: "required", route: "marketplace_service" },
        { capability: "awareness", needed: "required" },
      ],
      againstInterestCapabilities: ["endpoint", "email_security"],
    },
  },
  {
    id: "F3",
    title: "Hybrid retail fit with the EPOS exclusion honest",
    input: {
      organisation: { sector: "retail" },
      estate: {
        users: 45,
        sites: 6,
        devices: { computers: 30 },
        specialDevices: ["epos"],
        cloud: [],
        existingSecurity: [],
        existingNetwork: ["bt_broadband"],
      },
      drivers: ["growth", "ransomware_concern"],
      constraints: { inHouseSocCapacity: "none", complianceRequirements: [] },
    },
    expect: {
      /* Under the approved required-only path amendment, the only required
         path-driving capability routes bt_product; MDR (recommended, MDR-1d)
         is conditional and backup is carried buyer-side. */
      path: "product_path",
      capabilities: [
        { capability: "endpoint", needed: "required", route: "bt_product" },
        { capability: "mdr_soc", needed: "recommended", route: "marketplace_service" },
        { capability: "managed_firewall", needed: "recommended", route: "bt_product" },
        { capability: "backup_resilience", needed: "required", route: "out_of_scope" },
      ],
    },
  },
  {
    id: "F4",
    title: "Insufficient information degrades honestly (G-5)",
    input: {
      drivers: ["audit"],
    },
    expect: {
      path: null,
      confidence: "low",
      capabilities: [
        { capability: "endpoint", needed: "cannot_assess", route: null },
        { capability: "mdr_soc", needed: "cannot_assess", route: null },
        { capability: "awareness", needed: "recommended" },
      ],
      minGaps: 3,
    },
  },
  {
    id: "F5",
    title: "Cloud-first SaaS company: the firewall denial",
    input: {
      organisation: { sector: "software" },
      estate: {
        users: 60,
        sites: 0,
        devices: { computers: 60, mobiles: 30 },
        cloud: ["m365", "aws"],
        existingSecurity: ["CrowdStrike via MSP"],
      },
      drivers: ["consolidation"],
      constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: [] },
    },
    expect: {
      path: "service_path",
      capabilities: [
        { capability: "endpoint", needed: "required" },
        { capability: "managed_firewall", needed: "not_indicated", route: null },
        { capability: "sse", needed: "required", route: "marketplace_service" },
      ],
      againstInterestCapabilities: ["managed_firewall"],
    },
  },
  {
    id: "F6",
    title: "Semantic SASE escalation: transformation, not procurement",
    input: {
      organisation: { sector: "manufacturing", sizeBand: "large" },
      estate: {
        users: 400,
        sites: 12,
        devices: { computers: 350, servers: 30 },
        cloud: ["m365"],
        existingSecurity: [],
        existingNetwork: ["mpls"],
      },
      drivers: ["renewal", "consolidation"],
      constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: [] },
    },
    expect: {
      path: "escalate_sase",
      capabilities: [
        { capability: "sse", needed: "recommended", route: "escalate_sase" },
      ],
    },
  },
];

/** F5 note: endpoint expected required because "CrowdStrike via MSP" IS a
 *  graded incumbent, but the consolidation driver suspends END-2's keep rule
 *  by design; the interesting assertions are the firewall denial and the
 *  marketplace SSE route. If Robert prefers END-2 to hold even under
 *  consolidation, flip the driver in this fixture and END-2's condition. */
