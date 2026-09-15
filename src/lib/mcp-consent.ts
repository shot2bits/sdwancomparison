/** Applies to agent/API writes; existing owner, version and publication checks still run. */
export const MCP_EXPLICIT_CONSENT_TOOLS = new Set([
  'start_project', 'update_requirements', 'preview_provider_matches',
  'generate_rfp_from_opportunity', 'opportunity_respond', 'supplier_reply',
  'respond_to_rfp', 'generate_security_rfp',
]);
export function mcpConsentError(name: string, args: Record<string, unknown>) {
  return MCP_EXPLICIT_CONSENT_TOOLS.has(name) && args.consent !== true
    ? {error: 'explicit_consent_required', message: 'Confirm this specific action with the user, then pass consent: true. This does not replace ownership, supplier identity or publication consent.'}
    : null;
}
export function withMcpConsentSchema<T extends {name: string; description: string; inputSchema: object}>(definition: T) {
  if (!MCP_EXPLICIT_CONSENT_TOOLS.has(definition.name)) return definition;
  const schema = definition.inputSchema as {properties?: Record<string, unknown>; required?: readonly string[]};
  return {...definition,
    description: `${definition.description} Requires explicit consent: true for this action. For writes without an idempotency key, read back the saved project or connection after an uncertain response; do not automatically retry.`,
    inputSchema: {...schema, properties: {...schema.properties, consent: {type: 'boolean', const: true}}, required: [...new Set([...(schema.required ?? []), 'consent'])]},
  };
}
