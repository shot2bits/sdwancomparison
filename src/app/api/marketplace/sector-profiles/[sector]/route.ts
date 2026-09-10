import { SECTOR_PROFILES, projectSectorProfile } from "@/lib/sector-profiles";

export async function GET(_req: Request, context: { params: Promise<{ sector: string }> }) {
  const { sector } = await context.params;
  if (!(sector in SECTOR_PROFILES)) return Response.json({ error: "Sector profile not found." }, { status: 404 });
  const key = sector as keyof typeof SECTOR_PROFILES;
  return Response.json({ governed_profile: SECTOR_PROFILES[key], project_state: projectSectorProfile(key) }, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" } });
}
