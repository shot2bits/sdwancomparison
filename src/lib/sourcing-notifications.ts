import { repairSourcingBuyerIndex } from "./sourcing-buyer-index";
import { recordSourcingMetric } from "./sourcing-metrics";
import "server-only";
import { publicResponsePanel } from "./response-panel";
import {
  SOURCING_NEED_LABELS,
  SOURCING_ACTION_LABELS,
  sourcingUndertaking,
} from "./sourcing-contract";
import { z } from "zod";
import { kvGetJson, kvSetJson, kvRaw } from "./rfp-store";
import { activityMailFetch, activityMailKey } from "./activity-mail";
import { circuitLock } from "./circuit-store";
import { SITE_URL } from "./structured-data";
import { getLiveShortlistDataset } from "./live-shortlist";
import type { SourcingRecord } from "./sourcing-store";
import operations from "../../data/sourcing-operations.json";
export type ConfirmationNotifications = {
  desk: "pending" | "accepted";
  buyer: "pending" | "accepted";
  attempted_at: string | null;
};
export const notificationKey = (id: string) =>
  `sourcing:confirmed-notifications:${id}`;
export async function notificationStatus(
  id: string,
): Promise<ConfirmationNotifications> {
  return (
    (await kvGetJson<ConfirmationNotifications>(notificationKey(id))) ?? {
      desk: "pending",
      buyer: "pending",
      attempted_at: null,
    }
  );
}
export function workingHoursSince(
  from: number,
  now: number,
  config: {
    working_day_start_hour: number | null;
    working_day_end_hour: number | null;
    time_zone: string;
  } = operations,
): number | null {
  const start = config.working_day_start_hour,
    end = config.working_day_end_hour;
  if (start === null || end === null || end <= start) return null;
  // The configured UK schedule uses whole hours. UTC-hour boundaries also
  // preserve UK wall-clock business hours over GMT/BST changes.
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.time_zone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  let milliseconds = 0;
  for (let t = Math.floor(from / 3600000) * 3600000; t < now; t += 3600000) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(t)).map((p) => [p.type, p.value]),
    );
    const hour = Number(parts.hour);
    if (!["Sat", "Sun"].includes(parts.weekday) && hour >= start && hour < end)
      milliseconds += Math.max(
        0,
        Math.min(t + 3600000, now) - Math.max(t, from),
      );
  }
  return milliseconds / 3600000;
}
export function queueAge(confirmed: number, now = Date.now()) {
  const working = workingHoursSince(confirmed, now);
  const threshold = operations.overdue_working_hours as number | null;
  return {
    elapsed_hours: Math.max(0, (now - confirmed) / 3600000),
    working_hours: working,
    overdue: threshold !== null && working !== null && working > threshold,
  };
}
export async function notifyConfirmedSourcing(record: SourcingRecord) {
  if (record.status !== "desk_review") return;
  try { await repairSourcingBuyerIndex(record); }
  catch { console.error("Sourcing buyer index repair pending", { request_id: record.id }); }
  try {
    await circuitLock(`sourcing-notifications:${record.id}`, async () => {
      const status = await notificationStatus(record.id);
      if (status.desk === "accepted" && status.buyer === "accepted") return;
      status.attempted_at = new Date().toISOString();
      const vendors = (await getLiveShortlistDataset()).vendors;
      const panel = await publicResponsePanel();
      const recipients =
        record.request.recipients
          .map(
            (r) =>
              `${vendors.find((v) => v.slug === r.slug)?.name ?? r.slug}: ${r.actions.map((action) => SOURCING_ACTION_LABELS[action]).join(", ")}${panel.find((p) => p.slug === r.slug) ? ` — route via Netify to ${panel.find((p) => p.slug === r.slug)!.contact_name} (${panel.find((p) => p.slug === r.slug)!.contact_email_domain})` : " — desk to establish supplier contact and terms"}`,
          )
          .join("\n") ||
        "No providers approved yet; Netify will prepare a named plan for buyer review.";
      const b = record.request.brief;
      const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
      const payloads = {
        desk: {
          from,
          to: process.env.SOURCING_DESK_EMAIL ?? operations.desk_email ?? "",
          subject: `Sourcing request ${record.id} confirmed`,
          text: `Request: ${record.id}\nProject: ${record.project_id}\nBuyer domain: ${record.request.email.split("@")[1]}\nSector: ${b.sector ?? "Not specified"}\nSites: ${b.sites}\nUsers: ${b.remote_users}\nRegion: ${b.region}\nService: ${SOURCING_NEED_LABELS[b.need]}\nApproved recipients:\n${recipients}\n\nAnonymous supplier brief:\n${b.supplier_brief}\n\n${SITE_URL}/admin/sourcing/`,
        },
        buyer: {
          from,
          to: record.request.email,
          subject: "Your Netify request is recorded",
          text: `Your request is recorded. Open your private project for the current desk status.\n\nApproved recipients:\n${recipients}\n\nNetify reviews every request before any supplier receives it.\n${sourcingUndertaking()}\n\nYour private project status:\n${SITE_URL}/rfp-builder/${record.project_id}/\nOpen this link in the browser where you confirmed your request, or sign in with the same work email at ${SITE_URL}/account/.`,
        },
      };
      // Each recipient has an independent durable receipt; a failure never drops the queued request.
      for (const channel of ["desk", "buyer"] as const) {
        if (status[channel] === "accepted") continue;
        try {
          let payload = await kvGetJson<(typeof payloads)[typeof channel]>(
            `${notificationKey(record.id)}:${channel}:payload`,
          );
          if (!payload) {
            payload = { ...payloads[channel] };
            // An immutable receipt describes recording, not a desk state that can change on retry.
            if (!z.email().safeParse(payload.to).success)
              throw Error("Notification destination not configured");
            await kvSetJson(
              `${notificationKey(record.id)}:${channel}:payload`,
              payload,
            );
          }
          const response = await activityMailFetch(
            "https://api.resend.com/emails",
            {
              method: "POST",
              headers: {
                authorization: `Bearer ${activityMailKey()}`,
                "Content-Type": "application/json",
                "Idempotency-Key": `sourcing-confirmed-${record.id}-${channel}`,
              },
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify(payload),
            },
          );
          if (!response.ok) throw Error("Notification delivery not accepted");
          status[channel] = "accepted";
          if (channel === "desk")
            await recordSourcingMetric(
              "desk_notified",
              record.request.acquisition,
              record.id,
            );
        } catch {
          status[channel] = "pending";
          console.error("Sourcing confirmation notification pending", {
            request_id: record.id,
            channel,
          });
        }
        await kvSetJson(notificationKey(record.id), status);
      }
    });
  } catch {
    console.error("Sourcing confirmation notification retry needed", {
      request_id: record.id,
    });
  }
}

export async function pendingSourcingNotifications() {
  const ids = (await kvRaw([
    "ZRANGE",
    "sourcing:desk-review",
    0,
    -1,
  ])) as string[];
  const states = await Promise.all(ids.map(notificationStatus));
  return {
    requests: ids.length,
    desk_pending: states.filter((s) => s.desk !== "accepted").length,
    buyer_pending: states.filter((s) => s.buyer !== "accepted").length,
  };
}
