import { ShortlistInputSchema } from './shortlist-core';
import type { ProjectDetails } from './rfp-types';
import { quickListingReadiness } from './publication-policy';

export function isShortProject(project: Pick<ProjectDetails, 'journey'>): boolean {
  return project.journey?.mode === 'quick_list' || project.journey?.mode === 'find_providers';
}

/** Shared by publication and preview; a provider search does not require a full RFP. */
export function shortProjectReadiness(project: ProjectDetails) {
  const raw = project.entrance_context?.raw_input ?? {};
  const outcome = project.buyer.notes.trim();
  const timescale = String(raw.timescale ?? '').trim();
  const readiness = quickListingReadiness({ solutionScope: project.buyer.product_scope === 'not_stated' ? '' : project.buyer.product_scope, sector: project.buyer.sector, siteCount: project.buyer.site_count, regions: project.buyer.regions, operatingModel: project.buyer.operating_model, outcome, timescale });
  const reasons = [...readiness.reasons];
  const company = project.buyer.organisation.trim();
  if (company.length < 2) reasons.push('Confirmed company name (private)');
  const publicText = `${outcome} ${timescale}`;
  if (/@|https?:\/\//i.test(publicText) || (company.length >= 3 && publicText.toLowerCase().includes(company.toLowerCase()))) reasons.push('Remove your company name, email or website from the public requirement and timescale');
  return { allowed: reasons.length === 0, reasons };
}

export function shortProjectNotice(project: ProjectDetails) {
  return {
    summary: `${project.buyer.notes.trim()} The buyer is seeking indicative, comparable responses. Publication is anonymous and non-binding; pricing stays private to the buyer.`,
    timeline_note: String(project.entrance_context?.raw_input.timescale ?? '').trim(),
  };
}

/** Preserve explicitly chosen capability filters while current project facts take precedence. */
export function projectMatchingInput(project: ProjectDetails) {
  const raw = project.entrance_context?.raw_input.shortlist ?? project.entrance_context?.shortlist_input ?? {};
  const parsed = ShortlistInputSchema.safeParse(raw);
  return {
    ...(parsed.success ? parsed.data : {}),
    sector: project.buyer.sector,
    organisation_size: project.buyer.organisation_size,
    service_model: project.buyer.operating_model,
    required_regions: project.buyer.regions,
  };
}
