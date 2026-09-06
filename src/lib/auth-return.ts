/** Only local application destinations may be carried through email verification. */
export function authReturnPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 400 || !/^\/(?:sase\/|sase-sd-wan-rfp-builder\/?(?:\?|$))[\w\-/.~%?=&]*$/.test(value)) return '';
  return value;
}

/** Both the original builder and the buying workspace refer to the same saved RFP. */
export function publicationProjectFromReturn(value: string): string | null {
  if (!authReturnPath(value)) return null;
  const url = new URL(value, 'https://netify.co.uk');
  const legacy = url.pathname.match(/^\/sase\/rfp-builder\/(rfp_[a-z0-9]+)\/?$/i);
  if (legacy) return legacy[1];
  if (!['/sase/workspace', '/sase/workspace/', '/sase-sd-wan-rfp-builder', '/sase-sd-wan-rfp-builder/'].includes(url.pathname)) return null;
  const project = url.searchParams.get('project');
  return project && /^rfp_[a-z0-9]+$/i.test(project) ? project : null;
}
