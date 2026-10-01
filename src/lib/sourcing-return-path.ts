/** Only the private project path is accepted from sourcing recovery links. */
export function sourcingReturnPath(search: string): string | null {
  const values = new URLSearchParams(search).getAll("return_to");
  return values.length === 1 && /^\/sase\/rfp-builder\/rfp_[a-z0-9]+\/$/.test(values[0])
    ? values[0] : null;
}
