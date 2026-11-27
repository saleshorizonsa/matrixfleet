import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireDriver } from "@/lib/auth";
import type { Vehicle, VehicleCheck } from "@/lib/types";
import { dateTime, intlLocale } from "@/lib/format";
import { CheckForm } from "@/components/driver/check-form";

export const metadata = { title: "Vehicle check" };

export default async function DriverCheckPage() {
  const { supabase, driver, org } = await requireDriver();
  const t = await getTranslations("driver.check");
  const loc = intlLocale(await getLocale());

  const [{ data: vehicles }, { data: checks }, { data: shift }, { data: defaultVeh }] = await Promise.all([
    supabase.from("hl_vehicles").select("id, registration, make, model, odometer, status").eq("org_id", org.id).neq("status", "off_road").order("registration"),
    supabase
      .from("hl_vehicle_checks")
      .select("*, vehicle:hl_vehicles(registration)")
      .eq("driver_id", driver.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("hl_driver_shifts").select("vehicle_id").eq("driver_id", driver.id).is("ended_at", null).maybeSingle(),
    supabase.from("hl_vehicles").select("id").eq("default_driver_id", driver.id).limit(1).maybeSingle(),
  ]);

  const list = (checks ?? []) as (VehicleCheck & { vehicle: { registration: string } | null })[];
  const today = new Date().toDateString();
  const doneToday = list.find((c) => new Date(c.created_at).toDateString() === today);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      {doneToday && (
        <div className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${doneToday.passed ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200"}`}>
          {doneToday.passed ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <TriangleAlert className="h-6 w-6 text-amber-600" />}
          <div className="text-sm">
            <div className="font-semibold text-slate-900">{t("doneToday", { reg: doneToday.vehicle?.registration ?? "" })}</div>
            <div className="text-slate-600">{doneToday.passed ? t("noDefects") : t("defectsReported")}</div>
          </div>
        </div>
      )}

      <CheckForm
        orgId={org.id}
        vehicles={((vehicles ?? []) as Pick<Vehicle, "id" | "registration" | "make" | "model" | "odometer">[])}
        defaultVehicleId={shift?.vehicle_id ?? defaultVeh?.id ?? null}
      />

      {list.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t("history")}</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{c.vehicle?.registration ?? "—"}</div>
                  <div className="truncate text-xs text-slate-500">
                    {dateTime(c.created_at, loc)}
                    {c.odometer ? ` · ${c.odometer.toLocaleString(loc)}` : ""}
                    {c.defects ? ` · ${c.defects}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.passed ? "bg-emerald-50 text-emerald-700" : c.resolved_at ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700"}`}
                >
                  {c.passed ? t("pass") : c.resolved_at ? t("resolved") : t("fail")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
