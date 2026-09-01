import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { authenticateMarketplaceProject, MarketplaceProjectUnauthorised } from "@/lib/marketplace-project-session";
import { getProject, saveProject } from "@/lib/rfp-store";
import { executePublish } from "@/lib/rfp-publish";
import { isMarketUnlocked } from "@/lib/market-unlock";
import { ProjectDetailsSchema } from "@/lib/rfp-types";
import { MARKETPLACE_PUBLICATION_CONSENT_TEXT, MARKETPLACE_PUBLICATION_CONSENT_VERSION, PUBLICATION_POLICY_VERSION, publicationAuthorization, publicationCompleted } from "@/lib/publication-policy";
import { recordMarketplaceFunnelEvent } from "@/lib/marketplace-funnel";

const BodySchema = z.object({
  base_revision: z.number().int().min(0),
  consent_version: z.literal(MARKETPLACE_PUBLICATION_CONSENT_VERSION),
  consent_text: z.literal(MARKETPLACE_PUBLICATION_CONSENT_TEXT),
  marketing_opt_in: z.boolean().default(false),
}).strict();

function bearer(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function POST(req: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  try {
    const input = BodySchema.parse(await req.json());
    const marketplaceSession = await authenticateMarketplaceProject(projectId, bearer(req));
    if (marketplaceSession.revision !== input.base_revision) return Response.json({ error: `Revision conflict: expected ${marketplaceSession.revision}.` }, { status: 409 });
    const project = await getProject(projectId);
    if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
    const session = await sessionFromRequest(req);
    const sessionEmail = session && (session.role === "buyer" || session.role === "netify") ? session.email : "";
    const ownsProject = Boolean(sessionEmail) && (!project.owner_email || project.owner_email.toLowerCase() === sessionEmail.toLowerCase());
    const authorization = publicationAuthorization({ ownerAuthorized: ownsProject, verifiedSession: Boolean(sessionEmail), channel: "web" });
    if (!authorization.allowed) return Response.json({ error: "sign_in_required", auth_required: true, message: "Verify your work email before publishing. The private draft is unchanged." }, { status: 401 });

    const priorConsent = (project.consents ?? []).find((item) => item.action === "marketplace.publish" && item.granted_by.toLowerCase() === sessionEmail.toLowerCase() && item.text === input.consent_text);
    const at = priorConsent?.at ?? Date.now();
    const consented = await saveProject(ProjectDetailsSchema.parse({
      ...project,
      owner_email: project.owner_email || sessionEmail,
      consent: project.consent?.version === input.consent_version ? project.consent : { version: input.consent_version, agreed_at: at, flow: "marketplace_project" },
      consents: priorConsent ? project.consents : [...(project.consents ?? []), { at, action: "marketplace.publish", granted_by: sessionEmail, via: "web", text: input.consent_text }],
    }));
    const result = await executePublish(consented, sessionEmail, { shortlist_size: 5, list_on_board: true, marketing_opt_in: input.marketing_opt_in });
    const unlocked = await isMarketUnlocked(projectId);
    if (!publicationCompleted({ publicBoardOpportunityId: result.board.opportunity_id, marketUnlockValid: unlocked })) {
      await recordMarketplaceFunnelEvent({ event: "publication_incomplete", project_id: project.id, source: project.journey?.source, mode: project.journey?.mode, channel: "web", detail: { board_created: Boolean(result.board.opportunity_id) } });
      return Response.json({ ok: false, code: "board_publication_incomplete", error: result.board.reason ?? "Board publication did not complete.", market_unlocked: false, publication_policy_version: PUBLICATION_POLICY_VERSION }, { status: 409 });
    }
    await recordMarketplaceFunnelEvent({ event: "publication_completed", project_id: project.id, source: project.journey?.source, mode: project.journey?.mode, channel: "web", detail: { board_created: true } });
    return Response.json({ ok: true, opportunity_id: result.board.opportunity_id, opportunity_url: result.board.url, market_unlocked: true, publication_policy_version: PUBLICATION_POLICY_VERSION });
  } catch (error) {
    if (error instanceof MarketplaceProjectUnauthorised) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ error: error instanceof Error ? error.message : "Publication failed." }, { status: 400 });
  }
}
