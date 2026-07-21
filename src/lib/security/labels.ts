/**
 * Human labels for the security engine's internal codes (Harry's retest,
 * NF1, 21 July 2026): chips were humanised in the first QA batch but the
 * same raw values still surfaced in generated prose — verdict reasoning
 * ("Declared compliance (cyber_essentials_plus, nhs_dspt)…"), the builder's
 * summary line and question rationale lines ("Required capability: sse").
 *
 * This is DISPLAY-side humanisation only. Stored verdicts, protected
 * transparency items and the Story's verbatim quotes are never rewritten
 * (Article 9: the record stays exactly as recorded); working surfaces
 * render the record readably. Composing readable text at source belongs to
 * the next rulebook revision, governed as such.
 */

export const SECURITY_CODE_LABELS: Record<string, string> = {
  // Capabilities (SEC-RULES-2026.1)
  endpoint: "Endpoint protection",
  mdr_soc: "Managed detection and response",
  sse: "Secure service edge",
  siem_logging: "SIEM and logging",
  managed_firewall: "Managed firewall",
  awareness: "Security awareness training",
  email_security: "Email security",
  backup_resilience: "Backup and resilience",
  // Compliance (engine vocabulary)
  iso27001: "ISO 27001",
  iso_27001: "ISO 27001",
  pci_dss: "PCI DSS",
  cyber_essentials_plus: "Cyber Essentials Plus",
  fca: "FCA",
  nhs_dspt: "NHS DSPT",
  // Compliance (builder vocabulary)
  uk_gdpr: "UK GDPR / DUAA",
  iec_62443: "IEC 62443",
  cyber_resilience_bill: "UK Cyber Resilience Bill",
  dora: "EU DORA",
  nis2: "EU NIS2",
  // Cloud platforms
  m365: "Microsoft 365",
  google: "Google Workspace",
  aws: "AWS",
  azure: "Azure",
  other_saas: "other SaaS",
};

/** Label a single code; unknown codes pass through unchanged. */
export function securityCodeLabel(code: string): string {
  return SECURITY_CODE_LABELS[code] ?? code;
}

/**
 * Humanise codes inside generated prose. Two strategies, both conservative:
 * unambiguous snake_case tokens are replaced globally; short single-word
 * ids (sse, endpoint, awareness…) are replaced only inside the known
 * "capability: a, b" and "compliance (a, b)" list patterns, so ordinary
 * English words are never touched.
 */
export function humaniseSecurityCodes(text: string): string {
  let t = text.replace(
    /\b(mdr_soc|siem_logging|managed_firewall|email_security|backup_resilience|cyber_essentials_plus|pci_dss|nhs_dspt|other_saas|iso27001|iso_27001|m365|uk_gdpr|iec_62443|cyber_resilience_bill)\b/g,
    (m) => SECURITY_CODE_LABELS[m] ?? m,
  );
  t = t.replace(/capability: ([a-z0-9_]+(?:, [a-z0-9_]+)*)/g, (_m, list: string) =>
    "capability: " + list.split(", ").map((id) => securityCodeLabel(id)).join(", "),
  );
  t = t.replace(/compliance \(([^)]+)\)/gi, (_m, list: string) =>
    `compliance (${list.split(",").map((id) => securityCodeLabel(id.trim())).join(", ")})`,
  );
  return t;
}
