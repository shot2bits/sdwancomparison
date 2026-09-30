import { createHash, randomBytes } from "node:crypto";
import { kvGetJson, kvRaw, getProject } from "./rfp-store";
import type { SourcingRecord } from "./sourcing-store";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const lifetime = 30 * 24 * 60 * 60;
export const sourcingCookieName = (id: string) => `netify_sourcing_${id}`;
type Grant = {
  project_id: string;
  request_id: string;
  email: string;
  expires_at: number;
};
export async function issueSourcingAccess(record: SourcingRecord) {
  if (record.status !== "desk_review") throw new Error("Request not confirmed");
  const token = randomBytes(32).toString("base64url");
  await kvRaw([
    "SET",
    `sourcing:access:${hash(token)}`,
    JSON.stringify({
      project_id: record.project_id,
      request_id: record.id,
      email: record.request.email,
      expires_at: Date.now() + lifetime * 1000,
    } satisfies Grant),
    "EX",
    lifetime,
  ]);
  return `${sourcingCookieName(record.project_id)}=${token}; Path=/sase/; HttpOnly; Secure; SameSite=Lax; Max-Age=${lifetime}`;
}
export async function sourcingAccess(
  req: Request,
  id: string,
): Promise<Grant | null> {
  if (!/^rfp_[a-z0-9]+$/.test(id)) return null;
  const token = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(sourcingCookieName(id) + "="))
    ?.split("=")[1];
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const g = await kvGetJson<Grant>(`sourcing:access:${hash(token)}`);
  if (!g || g.project_id !== id || g.expires_at <= Date.now()) return null;
  const r = await kvGetJson<SourcingRecord>(`sourcing:request:${g.request_id}`);
  if (
    !r ||
    r.status !== "desk_review" ||
    r.project_id !== id ||
    r.request.email !== g.email
  )
    return null;
  const p = await getProject(id);
  return p?.owner_email?.toLowerCase() === g.email.toLowerCase() ? g : null;
}
