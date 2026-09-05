/** Public comparison and private project entrances share these URLs. */
export function buyingPlatformPath(search = '') {
  // /sase/home is the serving route behind the canonical URL. Keep local previews local.
  const local = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return `${local ? '/sase/home/' : '/sase-sd-wan-rfp-builder/'}${search ? `?${search}` : ''}`;
}
export const COMPARISON_PROJECT_DRAFT_KEY = 'netify_comparison_project_draft_v1';
export const PROJECT_DRAFT_KEY = 'netify_short_project_draft_v1';
export const projectTokenKey = (id: string) => `netify_marketplace_project_${id}`;
