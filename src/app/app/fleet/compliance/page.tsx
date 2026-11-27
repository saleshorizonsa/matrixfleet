import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertOctagon, CalendarClock, ClipboardX, ShieldCheck } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { ComplianceTable } from "@/components/fleet/compliance-table";
import { ResolveCheckButton } from "@/components/fleet/resolve-check";
import { complianceItems } from "@/components/fleet/compliance";
import { dateTime, intlLocale } from "@/lib/format";
import type { Driver, Vehicle, VehicleCheck } from "@/lib/types";

export const metadata = { title: "Compliance" };

export default async function CompliancePage() {
  const ctx = await requireOffice();
  const t = await getTranslations("fleet");
  const loc = intlLocale(await getLocale());

  const [{ data: vehicles }, { data: drivers }, { data: checks }] = await Promise.all([
    ctx.supabase.from("hl_vehicles").select("*").eq("org_id", ctx.org.id),
    ctx.supabase.from("hl_drivers").select("*").eq("org_id", ctx.org.id).neq("status", "inactive"),
    ctx.supabase
      .from("hl_vehicle_checks")
      .select("*")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);
  const vList = (vehicles ?? []) as Vehicle[];
  const dList = (drivers ?? []) as Driver[];
  const items = complianceItems(vList, dList, { includeMissing: true });
  const checkList = (checks ?? []) as VehicleCheck[];
  const reg = new Map(vList.map((v) => [v.id, v.registration]));
  const dName = new Map(dList.map((d) => [d.id, d.full_name]));

  const expired = items.filter((i) => i.urgency === "expired").length;
  const soon = items.filter((i) => i.urgency === "week" || i.urgency === "month").length;
  const unresolved = checkList.filter((c) => !c.passed && !c.resolved_at).length;
  const tracked = items.filter((i) => i.urgency !== "missing").length;
  const score = tracked ? Math.round(((tracked - expired) / tracked) * 100) : 100;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("compliance.title")} description={t("compliance.subtitle")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("compliance.score")} value={`${score}%`} icon={<ShieldCheck className="h-5 w-5" />} tone={score >= 95 ? "green" : score >= 80 ? "amber" : "red"} />
        <Stat label={t("compliance.expired")} value={expired} icon={<AlertOctagon className="h-5 w-5" />} tone="red" />
        <Stat label={t("compliance.dueSoon")} value={soon} icon={<CalendarClock className="h-5 w-5" />} tone="amber" />
        <Stat label={t("compliance.openDefects")} value={unresolved} icon={<ClipboardX className="h-5 w-5" />} tone={unresolved ? "red" : "green"} />
      </div>

      <ComplianceTable items={items} />

      <Card className="mt-6">
        <CardHeader title={t("checks.latest")} description={t("checks.latestHint")} />
        {checkList.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">{t("checks.emptyText")}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {checkList.map((c) => {
              const defects = Object.entries(c.items ?? {}).filter(([, v]) => v === "defect").map(([k]) => k);
              return (
                <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <Link href={`/app/fleet/vehicles/${c.vehicle_id}`} className="font-mono font-semibold text-slate-900 hover:text-brand-600">
                      {reg.get(c.vehicle_id) ?? "—"}
                    </Link>
                    <span className="ml-2 text-slate-500">
                      {dateTime(c.created_at, loc)} · {c.driver_id ? dName.get(c.driver_id) ?? "—" : "—"}
                    </span>
                    {defects.length > 0 && (
                      <span className="ml-2 inline-flex flex-wrap gap-1">
                        {defects.map((d) => (
                          <Badge key={d} tone="red">
                            {t.has(`checkItems.${d}`) ? t(`checkItems.${d}`) : d}
                          </Badge>
                        ))}
                      </span>
                    )}
                    {c.defects && <div className="mt-0.5 text-slate-600">{c.defects}</div>}
                  </div>
                  {c.passed ? (
                    <Badge tone="green">{t("checks.passed")}</Badge>
                  ) : c.resolved_at ? (
                    <Badge tone="teal">{t("checks.resolvedShort")}</Badge>
                  ) : (
                    <ResolveCheckButton checkId={c.id} vehicleId={c.vehicle_id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
