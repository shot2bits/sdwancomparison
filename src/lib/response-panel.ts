import "server-only";
import seed from "../../data/response-panel.json";
import { kvRaw } from "./rfp-store";
import {
  ResponsePanelRowSchema,
  responsePanelMember,
  type ResponsePanelRow,
} from "./response-panel-contract";
export async function getResponsePanel(): Promise<ResponsePanelRow[]> {
  const rows = new Map<string, ResponsePanelRow>();
  for (const raw of seed) {
    const row = ResponsePanelRowSchema.parse(raw);
    if (responsePanelMember(row)) rows.set(row.slug, row);
  }
  // A hash update is atomic, avoiding a separately committed membership index.
  const values = (await kvRaw(["HGETALL", "sourcing:response-panel"])) as
    string[] | null;
  for (let i = 1; i < (values?.length ?? 0); i += 2) {
    const row = ResponsePanelRowSchema.parse(JSON.parse(values![i]));
    if (responsePanelMember(row)) rows.set(row.slug, row);
  }
  return [...rows.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
export async function publicResponsePanel(): Promise<ResponsePanelRow[]> {
  try {
    return await getResponsePanel();
  } catch {
    console.error("Response panel unavailable; no membership claimed");
    return [];
  }
}
export async function saveResponsePanel(input: unknown) {
  const row = ResponsePanelRowSchema.parse(input);
  if (!responsePanelMember(row))
    throw Error("Acknowledgement must be dated in the past.");
  await kvRaw([
    "HSET",
    "sourcing:response-panel",
    row.slug,
    JSON.stringify(row),
  ]);
  return row;
}
