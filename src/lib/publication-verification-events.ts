import "server-only";
import { getProject } from "./rfp-store";
import { recordMarketplaceFunnelEvent } from "./marketplace-funnel-safe";

/** Observability only. Never changes sign-in, ownership, consent or publication. */
export async function recordPublicationVerification(projectId: string, email: string, event: "verification_requested" | "verification_completed") {
  try {
    const project = await getProject(projectId);
    if (!project || project.consent?.flow !== "marketplace_project") return;
    if (project.owner_email && project.owner_email.toLowerCase() !== email.toLowerCase()) return;
    if (event === "verification_completed" && !project.owner_email) return;
    await recordMarketplaceFunnelEvent({ event, project_id: projectId, source: project.journey?.source, mode: project.journey?.mode, channel: "web" });
  } catch { /* Measurement cannot block authentication. */ }
}
