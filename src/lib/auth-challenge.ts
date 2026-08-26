import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const MIN_AGE_MS = 700;

function secret(): string {
  return process.env.AUTH_BOT_SECRET || process.env.CRON_SECRET || (process.env.NODE_ENV === "production" ? "" : "netify-local-auth-challenge");
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueAuthChallenge(): string | null {
  if (!secret()) return null;
  const payload = Buffer.from(JSON.stringify({ issued: Date.now(), nonce: randomBytes(18).toString("base64url") })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAuthChallenge(token: string): { ok: true; nonce: string } | { ok: false } {
  if (!secret() || !token.includes(".")) return { ok: false };
  const [payload, supplied] = token.split(".", 2);
  const expected = signature(payload);
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return { ok: false };
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { issued?: unknown; nonce?: unknown };
    const age = Date.now() - Number(parsed.issued);
    if (!Number.isFinite(age) || age < MIN_AGE_MS || age > MAX_AGE_MS || typeof parsed.nonce !== "string" || parsed.nonce.length < 16) return { ok: false };
    return { ok: true, nonce: parsed.nonce };
  } catch {
    return { ok: false };
  }
}
