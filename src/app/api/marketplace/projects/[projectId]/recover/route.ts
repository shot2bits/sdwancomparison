import { sessionFromRequest } from '@/lib/auth';
import { getProject } from '@/lib/rfp-store';
import { recoverMarketplaceSession } from '@/lib/marketplace-project-session';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/** A fresh draft credential is issued only to its verified, persisted owner. */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await sessionFromRequest(req);
  if (!session || !['buyer', 'netify'].includes(session.role)) return Response.json({ error: 'Verify your work email to reopen your saved project.', auth_required: true }, { status: 401, headers });
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project?.owner_email || project.owner_email.toLowerCase() !== session.email.toLowerCase()) return Response.json({ error: 'Project not found.' }, { status: 404, headers });
  try { return Response.json(await recoverMarketplaceSession(project), { headers }); }
  catch { return Response.json({ error: 'Your project could not be reopened. Try again; your saved work has not been deleted.' }, { status: 503, headers }); }
}
