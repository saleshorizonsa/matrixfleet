import { getTranslations } from "next-intl/server";
import { requireDriver } from "@/lib/auth";
import type { DriverShift } from "@/lib/types";
import { ShiftPanel, type ShiftRow } from "@/components/driver/shift-panel";

export const metadata = { title: "Shift" };

function nowMs() {
  return Date.now();
}

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DriverShiftPage() {
  const { supabase, driver, org } = await requireDriver();
  const t = await getTranslations("driver.shift");
  const weekStart = startOfWeek();

  const [{ data: shifts }, { data: vehicles }] = await Promise.all([
    supabase
      .from("hl_driver_shifts")
      .select("*, vehicle:hl_vehicles(registration)")
      .eq("driver_id", driver.id)
      .or(`ended_at.is.null,started_at.gte.${weekStart.toISOString()}`)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase.from("hl_vehicles").select("id, registration").eq("org_id", org.id).neq("status", "off_road").order("registration"),
  ]);

  const rows = ((shifts ?? []) as (DriverShift & { last_break_end_at?: string | null; vehicle: { registration: string } | null })[]).map(
    (s): ShiftRow => ({
      id: s.id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      break_minutes: s.break_minutes,
      on_break_since: s.on_break_since,
      last_break_end_at: s.last_break_end_at ?? null,
      registration: s.vehicle?.registration ?? null,
    }),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("subtitle")}</p>
      </div>
      <ShiftPanel
        shifts={rows}
        weekStart={weekStart.toISOString()}
        vehicles={(vehicles ?? []) as { id: string; registration: string }[]}
        ukDomestic={org.country === "GB"}
        serverNow={nowMs()}
      />
    </div>
  );
}
