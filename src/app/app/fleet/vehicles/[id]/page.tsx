import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Pencil, Trash2, XCircle } from "lucide-react";
import { requireOffice, canManage } from "@/lib/auth";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/client";
import { StatusBadge } from "@/components/app/status-badge";
import { ExpiryBadge, Plate, VehicleIcon } from "@/components/fleet/ui";
import { ResolveCheckButton } from "@/components/fleet/resolve-check";
import { VEHICLE_DOCS } from "@/components/fleet/compliance";
import { deleteVehicle } from "../../actions";
import { dateTime, date, intlLocale } from "@/lib/format";
import type { Driver, Job, Vehicle, VehicleCheck } from "@/lib/types";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice();
  const t = await getTranslations("fleet");
  const tc = await getTranslations("common");
  const loc = intlLocale(await getLocale());

  const { data: vehicle } = await ctx.supabase.from("hl_vehicles").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Vehicle>();
  if (!vehicle) notFound();

  const [{ data: checks }, { data: drivers }, { data: jobs }] = await Promise.all([
    ctx.supabase.from("hl_vehicle_checks").select("*").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(30),
    ctx.supabase.from("hl_drivers").select("id, full_name").eq("org_id", ctx.org.id),
    ctx.supabase
      .from("hl_jobs")
      .select("id, reference, status, scheduled_date, pickup_city, delivery_city")
      .eq("vehicle_id", id)
      .order("scheduled_date", { ascending: false })
      .limit(8),
  ]);
  const driverName = new Map(((drivers ?? []) as Pick<Driver, "id" | "full_name">[]).map((d) => [d.id, d.full_name]));
  const checkList = (checks ?? []) as VehicleCheck[];
  const manage = canManage(ctx.membership.role);

  return (
    <>
      <Link href="/app/fleet/vehicles" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {t("vehicles.title")}
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Plate reg={vehicle.registration} country={ctx.org.country} size="lg" />
          </span>
        }
        description={[vehicle.make, vehicle.model, t(`kinds.${vehicle.kind}`)].filter(Boolean).join(" · ")}
        actions={
          <>
            {manage && (
              <ConfirmButton action={deleteVehicle.bind(null, vehicle.id)} message={tc("confirmDelete")} variant="ghost" size="md">
                <Trash2 className="h-4 w-4" /> {tc("delete")}
              </ConfirmButton>
            )}
            <LinkButton href={`/app/fleet/vehicles/${vehicle.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> {tc("edit")}
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("vehicles.details")} action={<VehicleIcon kind={vehicle.kind} className="h-5 w-5 text-brand-500" />} />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-slate-500">{t("vehicles.status")}</dt>
                <dd className="text-right font-medium">{t(`vehicleStatus.${vehicle.status}`)}</dd>
                <dt className="text-slate-500">{t("vehicles.capacityKg")}</dt>
                <dd className="text-right font-medium">{vehicle.capacity_kg?.toLocaleString() ?? "—"}</dd>
                <dt className="text-slate-500">{t("vehicles.pallets")}</dt>
                <dd className="text-right font-medium">{vehicle.pallets ?? "—"}</dd>
                <dt className="text-slate-500">{t("vehicles.odometer")}</dt>
                <dd className="text-right font-medium">{vehicle.odometer?.toLocaleString() ?? "—"}</dd>
                <dt className="text-slate-500">{t("vehicles.defaultDriver")}</dt>
                <dd className="text-right font-medium">{vehicle.default_driver_id ? driverName.get(vehicle.default_driver_id) : "—"}</dd>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("vehicles.documents")} />
            <CardBody className="space-y-3">
              {VEHICLE_DOCS.map((doc) => (
                <div key={doc} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">{t(`docs.${doc}`)}</span>
                  <ExpiryBadge date={vehicle[doc]} />
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("checks.title")} description={t("checks.subtitle")} />
            {checkList.length === 0 ? (
              <EmptyState icon={<ClipboardCheck className="h-7 w-7" />} title={t("checks.emptyTitle")} description={t("checks.emptyText")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {checkList.map((c) => {
                  const defects = Object.entries(c.items ?? {}).filter(([, v]) => v === "defect").map(([k]) => k);
                  return (
                    <li key={c.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        {c.passed ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <XCircle className="mt-0.5 h-5 w-5 text-rose-500" />}
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {dateTime(c.created_at, loc)} · {c.driver_id ? driverName.get(c.driver_id) : "—"}
                            {c.odometer ? <span className="text-slate-400"> · {c.odometer.toLocaleString()}</span> : null}
                          </div>
                          {defects.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {defects.map((d) => (
                                <Badge key={d} tone="red">
                                  {t.has(`checkItems.${d}`) ? t(`checkItems.${d}`) : d}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {c.defects && <p className="mt-1 text-sm text-slate-600">{c.defects}</p>}
                        </div>
                      </div>
                      {!c.passed &&
                        (c.resolved_at ? (
                          <Badge tone="green">{t("checks.resolvedOn", { date: date(c.resolved_at, loc) })}</Badge>
                        ) : (
                          <ResolveCheckButton checkId={c.id} vehicleId={vehicle.id} />
                        ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("vehicles.recentJobs")} />
            {(jobs ?? []).length === 0 ? (
              <CardBody className="text-sm text-slate-500">{t("vehicles.noJobs")}</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {((jobs ?? []) as Pick<Job, "id" | "reference" | "status" | "scheduled_date" | "pickup_city" | "delivery_city">[]).map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                      <span>
                        <span className="font-mono font-medium text-slate-900">{j.reference}</span>
                        <span className="ml-2 text-slate-500">
                          {j.pickup_city ?? "?"} → {j.delivery_city ?? "?"}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{date(j.scheduled_date, loc)}</span>
                        <StatusBadge status={j.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
