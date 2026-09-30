import { createHash } from "node:crypto";
import { kvRaw, kvConfigured } from "./rfp-store";
const local = new Map<string, { count: number; until: number }>();
export async function sourcingPlanAllowed(ip: string) {
  const key =
    "sourcing:plan-limit:" + createHash("sha256").update(ip).digest("hex");
  if (kvConfigured()) {
    const n = Number(await kvRaw(["INCR", key]));
    if (n === 1) await kvRaw(["EXPIRE", key, 60]);
    return n <= 30;
  }
  const now = Date.now();
  for (const [k, v] of local) if (v.until <= now) local.delete(k);
  const value = local.get(key) ?? { count: 0, until: now + 60000 };
  value.count++;
  local.set(key, value);
  return value.count <= 30;
}
