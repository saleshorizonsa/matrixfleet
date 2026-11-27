import type { JobStatus } from "./types";

export function money(amount: number | null | undefined, currency = "GBP", locale = "en-GB") {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
}

export function distance(km: number | null | undefined, unit: "km" | "mi" = "km") {
  if (km === null || km === undefined) return "—";
  const v = unit === "mi" ? Number(km) * 0.621371 : Number(km);
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}`;
}

export function toDisplayDistance(km: number, unit: "km" | "mi") {
  return unit === "mi" ? km * 0.621371 : km;
}

export function date(d: string | Date | null | undefined, locale = "en-GB") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export function dateTime(d: string | Date | null | undefined, locale = "en-GB") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function daysUntil(d: string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

/** Map app locale → Intl locale */
export function intlLocale(locale: string) {
  return ({ en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL" } as Record<string, string>)[locale] ?? "en-GB";
}

export const JOB_STATUSES: JobStatus[] = ["quote", "booked", "assigned", "in_transit", "delivered", "invoiced", "cancelled"];

export const STATUS_COLORS: Record<JobStatus, string> = {
  quote: "bg-slate-100 text-slate-700 ring-slate-200",
  booked: "bg-sky-50 text-sky-700 ring-sky-200",
  assigned: "bg-violet-50 text-violet-700 ring-violet-200",
  in_transit: "bg-amber-50 text-amber-800 ring-amber-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  invoiced: "bg-teal-50 text-teal-700 ring-teal-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};
