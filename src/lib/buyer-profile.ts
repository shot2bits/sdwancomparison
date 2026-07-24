/**
 * The buyer profile: who signed up, in the team's language (24 July 2026,
 * Robert: "we very much need to see the company name and persons name").
 *
 * INTERNAL ONLY. This record feeds the sign-up alerts and the admin view
 * of who is on the marketplace. It is never shown to suppliers and never
 * rendered into a position, a notice or the board: the anonymity law
 * (anonymous, no name, no contacts) governs everything buyers publish,
 * and this store sits entirely behind it.
 *
 * Names arrive from the LinkedIn OIDC userinfo at sign-in. Company is a
 * one-question ask on the welcome step after a first LinkedIn sign-up,
 * skippable, because LinkedIn's sign-in scopes do not carry employer and
 * a wall at the welcome moment would cost the signup we just won.
 * Everything here is best effort: a storage failure must never block a
 * sign-in or lose a buyer.
 */

import { kvGetJson, kvSetJson } from "@/lib/rfp-store";

export type BuyerProfile = {
  email: string;
  name?: string;
  company?: string;
  via?: "linkedin" | "email";
  linkedin_sub?: string;
  created: number;
  updated: number;
};

const key = (email: string) => `buyer:profile:${email.trim().toLowerCase()}`;

export async function getBuyerProfile(email: string): Promise<BuyerProfile | null> {
  try {
    return await kvGetJson<BuyerProfile>(key(email));
  } catch {
    return null;
  }
}

/** Merge-and-save: only provided fields change; timestamps maintained. */
export async function saveBuyerProfile(
  email: string,
  patch: Partial<Omit<BuyerProfile, "email" | "created" | "updated">>,
): Promise<BuyerProfile | null> {
  try {
    const now = Date.now();
    const existing = await getBuyerProfile(email);
    const merged: BuyerProfile = {
      email: email.trim().toLowerCase(),
      ...(existing ?? {}),
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== "")),
      created: existing?.created ?? now,
      updated: now,
    };
    await kvSetJson(key(email), merged);
    return merged;
  } catch {
    return null; /* best effort, never a wall */
  }
}
