import { getProject, indexRfpForBuyer } from "./rfp-store";
import { confirmedSourcingOwner } from "./sourcing-access";
import type { SourcingRecord } from "./sourcing-store";

/** Repeatable repair for old confirmations and interrupted account-index writes. */
export async function repairSourcingBuyerIndex(record: SourcingRecord) {
  const project = await getProject(record.project_id);
  if (!(await confirmedSourcingOwner(project, record.request.email))) return;
  await indexRfpForBuyer(record.request.email, record.project_id);
}
