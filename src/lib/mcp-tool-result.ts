/** Text remains available to older MCP clients; structured output is the same JSON value. */
export function mcpToolResult(value: unknown) {
  const result = value == null ? { error: 'The tool returned no result.' } : value;
  const json = JSON.stringify(result);
  const plain = JSON.parse(json) as unknown;
  const failed = !!plain && typeof plain === 'object' && 'error' in plain && plain.error != null;
  return {
    content: [{ type: 'text' as const, text: json }],
    ...(!failed && plain !== null && typeof plain === 'object' && !Array.isArray(plain) ? { structuredContent: plain } : {}),
    ...(failed ? { isError: true } : {}),
  };
}
