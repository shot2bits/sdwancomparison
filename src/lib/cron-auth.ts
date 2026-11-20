import { createHash, timingSafeEqual } from "node:crypto";

/**
 * True when the request carries `Authorization: Bearer <CRON_SECRET>` (what
 * Vercel Cron sends). Always false when CRON_SECRET is not configured.
 * Compares SHA-256 digests in constant time, so neither the secret nor its
 * length leaks through response timing.
 */
export function hasCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
