import { z } from "zod";
export const CIRCUIT_CONSENT =
  "Publish my anonymous circuit-pricing project to the Netify Opportunity Board. Netify may use my private requirements and local contacts to source pricing and email me when responses are available. This is not an order.";
const text = (max = 300) => z.string().trim().max(max);
export const CircuitLineSchema = z
  .object({
    id: z.string().uuid(),
    name: text(120).min(1),
    country: text(100).min(2),
    address: text(1000),
    kind: z.enum(["Ethernet", "Broadband", "4G / 5G SIM only", "4G / 5G with router"]),
    remote: z.boolean(),
    quantity: z.number().int().min(1).max(100000),
    bandwidth: text(150).min(1),
    data: text(300),
    resilience: z.enum([
      "Single connection",
      "Dual RA02 Ethernet",
      "Broadband backup",
      "Cellular backup",
    ]),
    operation: z.enum(["Active / passive", "Load balancing", "Not applicable"]),
    router: z.enum(["No router", "Managed router", "Fortinet SD-WAN edge", "Meraki SD-WAN edge"]),
    contact_name: text(150),
    contact_email: z.union([z.literal(""), z.email().max(254)]),
    contact_phone: text(80),
    protect: z.boolean(),
    devices: z.number().int().min(0).max(100000),
    term: text(100).min(1),
  })
  .strict()
  .superRefine((l, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (l.kind !== "4G / 5G SIM only" && l.address.length < 8)
      issue(`${l.name}: full service address required.`);
    if (l.country !== "United Kingdom" && (!l.contact_name || !l.contact_email || !l.contact_phone))
      issue(`${l.name}: name, email and telephone for a local contact required outside the UK.`);
    if (
      l.country !== "United Kingdom" &&
      ["Fortinet SD-WAN edge", "Meraki SD-WAN edge"].includes(l.router)
    )
      issue("Fortinet and Meraki edges are UK-only.");
    if (
      l.protect &&
      (!l.remote || l.country !== "United Kingdom" || l.kind === "Ethernet" || l.devices < 1)
    )
      issue(
        "CrowdStrike is optional for UK broadband/cellular remote users only; specify devices.",
      );
    if (l.resilience === "Dual RA02 Ethernet" && l.kind !== "Ethernet")
      issue("Dual RA02 requires Ethernet.");
    if (l.resilience !== "Single connection" && l.operation === "Not applicable")
      issue("Select active/passive or load balancing for resilient connections.");
  });
export const CircuitInputSchema = z
  .object({
    company: text(200).min(2),
    sector: text(100).min(2),
    timescale: text(200).min(2),
    scope: z.enum(["Underlay only", "With SD-WAN / SASE"]),
    lines: z.array(CircuitLineSchema).min(1).max(500),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.lines.map((l) => l.id)).size !== v.lines.length)
      c.addIssue({ code: "custom", message: "Each location needs a unique ID." });
  });
export type CircuitLine = z.infer<typeof CircuitLineSchema>;
export type CircuitInput = z.infer<typeof CircuitInputSchema>;
export const CircuitQuoteSchema = z
  .object({
    id: z.string().uuid(),
    line_id: z.string().uuid(),
    supplier: text(200).min(2),
    reference: text(200).min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
    monthly: z.number().nonnegative().max(1e9),
    installation: z.number().nonnegative().max(1e9),
    term: text(100).min(1),
    lead_time: text(200).min(1),
    valid_until: z.iso.date(),
    sla: text(4000).min(1),
    resilience_confirmation: text(2000).min(1),
    exclusions: text(4000).min(1),
    evidence_url: z.url().refine((s) => s.startsWith("https://"), "Use an HTTPS evidence link."),
    protection_details: text(2000),
    notes: text(4000),
  })
  .strict();
export type CircuitQuote = z.infer<typeof CircuitQuoteSchema> & {
  created: number;
  created_by: string;
  notification: "pending" | "accepted" | "failed";
  notification_at?: number;
};
export type CircuitRecord = CircuitInput & {
  id: string;
  owner_email: string;
  created: number;
  updated: number;
  status: "draft" | "sourcing" | "quotes_available";
  revision: number;
  opportunity_id: string | null;
  consent?: { text: string; at: number };
  quotes: CircuitQuote[];
  team_notification?: "accepted" | "failed";
};
export const newCircuitLine = (): CircuitLine => ({
  id: crypto.randomUUID(),
  name: "",
  country: "United Kingdom",
  address: "",
  kind: "Ethernet",
  remote: false,
  quantity: 1,
  bandwidth: "",
  data: "",
  resilience: "Single connection",
  operation: "Not applicable",
  router: "No router",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  protect: false,
  devices: 0,
  term: "36 months",
});
export function circuitPublicSummary(input: CircuitInput) {
  const locations = input.lines.filter((l) => !l.remote).length;
  const remote = input.lines.filter((l) => l.remote).reduce((n, l) => n + l.quantity, 0);
  return `Business seeking market pricing for ${locations} business locations and ${remote} remote connections. Access types requested: ${[...new Set(input.lines.map((l) => l.kind))].join(", ")}. Netify is coordinating sourcing. Pricing and service addresses remain private. This is a non-binding request, not an order.`;
}
