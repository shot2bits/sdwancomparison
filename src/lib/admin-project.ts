import { z } from "zod";
import { isAdminEmail } from "./access-control";
import { getProject, kvGetJson, type AuthSession } from "./rfp-store";
import { getLatestPublishedSnapshot } from "./published-snapshot";
import { isStudioProject, studioDraftFromProject } from "./studio-project";
import { BidRequestSchema } from "./studio-engagement";

export function adminStudioActivity(raw: unknown) {
  const requests = z.array(BidRequestSchema).parse(raw ?? []);
  return {
    requests,
    bid_requests: requests.length,
    approved_engagements: requests.filter((r) => r.status === "approved")
      .length,
    supplier_responses: requests.filter((r) =>
      r.messages.some((m) => m.from === "supplier"),
    ).length,
  };
}

/** Explicit admin-only, read-only projection. Never issues an owner token or authorises buyer actions. */
export async function readAdminProject(
  id: string,
  session: AuthSession | null,
) {
  if (!isAdminEmail(session?.email))
    throw new Error("Netify administrator access required.");
  if (!/^rfp_[a-z0-9]+$/i.test(id)) return null;
  const project = await getProject(id);
  if (!project) return null;
  const snapshot = await getLatestPublishedSnapshot(id);
  const studio = isStudioProject(project);
  const draft = studio
    ? (snapshot?.frozen_content.studio_requirement ??
      studioDraftFromProject(project))
    : null;
  const content = snapshot?.frozen_content ?? project;
  const activity = studio
    ? adminStudioActivity(await kvGetJson(`studio:${id}:bid_requests`))
    : null;
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    format: draft?.format.toUpperCase() ?? "RFP",
    company: project.buyer.organisation,
    owner_email: project.owner_email,
    created: project.created,
    updated: project.updated,
    requirement_source: snapshot ? "Published requirement" : "Saved draft",
    requirement: draft?.requirement ?? content.buyer.notes,
    scope: draft?.scope ?? project.buyer.product_scope,
    sites: draft?.sites ?? String(content.buyer.site_count ?? ""),
    users: draft?.users ?? "",
    regions: draft?.regions ?? content.buyer.regions,
    service: draft?.service ?? content.buyer.operating_model,
    timing: draft?.timescale ?? "",
    questions:
      draft?.format === "rfi"
        ? []
        : content.rfp_sections
            .filter((s) => s.included)
            .flatMap((s) => s.questions),
    requests: activity?.requests ?? [],
    public_notice: snapshot?.public_projection.opportunity_id
      ? `/sase/opportunities/${snapshot.public_projection.opportunity_id}/`
      : null,
  };
}
