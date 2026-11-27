import type { Driver, Vehicle } from "@/lib/types";

export type Urgency = "expired" | "week" | "month" | "ok" | "missing";

export interface ComplianceItem {
  id: string;
  subjectType: "vehicle" | "driver";
  subjectId: string;
  subjectLabel: string;
  doc: string; // i18n key in fleet.docs
  date: string | null;
  days: number | null;
  urgency: Urgency;
}

export const VEHICLE_DOCS = ["mot_expiry", "insurance_expiry", "tax_expiry", "tacho_calibration_expiry", "next_service_date"] as const;
export const DRIVER_DOCS = ["licence_expiry", "cpc_expiry", "tacho_card_expiry"] as const;

export function daysLeft(d: string | null | undefined): number | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function urgencyOf(days: number | null): Urgency {
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= 7) return "week";
  if (days <= 30) return "month";
  return "ok";
}

export const URGENCY_TONE: Record<Urgency, "red" | "amber" | "sky" | "green" | "slate"> = {
  expired: "red",
  week: "amber",
  month: "sky",
  ok: "green",
  missing: "slate",
};

export function complianceItems(
  vehicles: Pick<Vehicle, "id" | "registration" | (typeof VEHICLE_DOCS)[number]>[],
  drivers: Pick<Driver, "id" | "full_name" | (typeof DRIVER_DOCS)[number]>[],
  { includeMissing = false } = {},
): ComplianceItem[] {
  const out: ComplianceItem[] = [];
  for (const v of vehicles) {
    for (const doc of VEHICLE_DOCS) {
      const date = v[doc];
      if (!date && !includeMissing) continue;
      const days = daysLeft(date);
      out.push({ id: `v-${v.id}-${doc}`, subjectType: "vehicle", subjectId: v.id, subjectLabel: v.registration, doc, date, days, urgency: urgencyOf(days) });
    }
  }
  for (const d of drivers) {
    for (const doc of DRIVER_DOCS) {
      const date = d[doc];
      if (!date && !includeMissing) continue;
      const days = daysLeft(date);
      out.push({ id: `d-${d.id}-${doc}`, subjectType: "driver", subjectId: d.id, subjectLabel: d.full_name, doc, date, days, urgency: urgencyOf(days) });
    }
  }
  return out.sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
}

/** The soonest expiring document of a vehicle/driver. */
export function nextExpiry<T extends Record<string, unknown>>(row: T, docs: readonly string[]) {
  let best: { doc: string; date: string; days: number } | null = null;
  for (const doc of docs) {
    const date = row[doc] as string | null;
    const days = daysLeft(date);
    if (date && days !== null && (!best || days < best.days)) best = { doc, date, days };
  }
  return best;
}

export function isOnline(lastSeen: string | null | undefined, minutes = 10) {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < minutes * 60_000;
}
