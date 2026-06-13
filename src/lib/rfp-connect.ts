/**
 * Connection helpers shared by the API, the agent and the MCP tools.
 * Suppliers are the graded vendors from the shortlist directory, identified
 * by slug. A connection is the buyer-to-supplier relationship plus its
 * asynchronous message thread.
 */

import { getConnection, saveConnection, newId } from "@/lib/rfp-store";
import { getShortlistDataset } from "@/lib/vendors";
import { MESSAGE_TYPES, type ConnectionMessage, type MessageType, type SupplierConnection } from "@/lib/rfp-types";

export function vendorBySlug(slug: string) {
  return getShortlistDataset().find((v) => v.slug === slug) ?? null;
}

function statusFor(type: MessageType, from: "buyer" | "supplier", current: SupplierConnection["status"]): SupplierConnection["status"] {
  if (type === "decline") return "declined";
  if (type === "contact_share") return "contact_shared";
  if (type === "demo_request") return "demo_requested";
  if (from === "supplier" && current === "invited") return "engaged";
  if (from === "supplier") return current === "invited" ? "engaged" : current;
  return current === "invited" ? current : current;
}

/** Invite a graded vendor to an RFP (idempotent) with an optional intro message. */
export async function inviteSupplier(rfpId: string, vendorSlug: string, intro: string): Promise<SupplierConnection | { error: string }> {
  const vendor = vendorBySlug(vendorSlug);
  if (!vendor) return { error: `Unknown vendor slug: ${vendorSlug}` };
  const existing = await getConnection(rfpId, vendorSlug);
  if (existing) return existing;
  const now = Date.now();
  const conn: SupplierConnection = {
    id: newId("conn"),
    rfp_id: rfpId,
    vendor_slug: vendorSlug,
    vendor_name: vendor.name,
    token: newId("stok"),
    status: "invited",
    messages: intro
      ? [{ id: newId("msg"), from: "buyer", type: "intro", body: intro, payload: {}, created: now, read: false }]
      : [],
    created: now,
    updated: now,
  };
  return saveConnection(conn);
}

export async function addMessage(
  conn: SupplierConnection,
  from: "buyer" | "supplier",
  type: MessageType,
  body: string,
  payload: Record<string, string> = {},
): Promise<SupplierConnection> {
  if (!MESSAGE_TYPES.includes(type)) type = "message";
  const msg: ConnectionMessage = { id: newId("msg"), from, type, body, payload, created: Date.now(), read: false };
  const status = statusFor(type, from, conn.status);
  return saveConnection({ ...conn, status, messages: [...conn.messages, msg] });
}
