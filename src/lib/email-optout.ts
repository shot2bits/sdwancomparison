import { createHmac } from "node:crypto";
import { kvGetJson, kvSetJson } from "@/lib/rfp-store";

/**
 * One-click email opt-out. The unsubscribe link in any Netify email carries
 * an HMAC of the recipient address, so a link can only unsubscribe the
 * address it was sent to. The opt-out list lives in KV under email:optout
 * and is honoured by every non-requested email sender (the publish nudge;
 * add future senders here too).
 */

const OPTOUT_KEY = "email:optout";

function secret(): string {
  return (
    process.env.UNSUB_SECRET ??
    process.env.CRON_SECRET ??
    process.env.RESEND_API_KEY ??
    "netify-unsub-fallback"
  );
}

export function signUnsubscribe(email: string): string {
  return createHmac("sha256", secret()).update(email.toLowerCase().trim()).digest("hex").slice(0, 32);
}

export function verifyUnsubscribe(email: string, sig: string): boolean {
  if (!email || !sig) return false;
  return signUnsubscribe(email) === sig.trim();
}

export async function addOptout(email: string): Promise<void> {
  const addr = email.toLowerCase().trim();
  const list = (await kvGetJson<string[]>(OPTOUT_KEY)) ?? [];
  if (!list.includes(addr)) {
    list.push(addr);
    await kvSetJson(OPTOUT_KEY, list);
  }
}

export async function getOptouts(): Promise<Set<string>> {
  const list = (await kvGetJson<string[]>(OPTOUT_KEY)) ?? [];
  return new Set(list.map((e) => e.toLowerCase()));
}
