import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Truck, Gauge, Weight, Layers } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ExpiryBadge, Plate, VehicleIcon } from "@/components/fleet/ui";
import { VEHICLE_DOCS, nextExpiry } from "@/components/fleet/compliance";
import type { Driver, Vehicle } from "@/lib/types";

export const metadata = { title: "Vehicles" };

const STATUS_TONE = { available: "green", in_use: "brand", maintenance: "amber", off_road: "red" } as const;

export default async function VehiclesPage() {
  const ctx = await requireOffice();
  const t = await getTranslations("fleet");
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    ctx.supabase.from("hl_vehicles").select("*").eq("org_id", ctx.org.id).order("registration"),
    ctx.supabase.from("hl_drivers").select("id, full_name").eq("org_id", ctx.org.id),
  ]);
  const list = (vehicles ?? []) as Vehicle[];
  const driverName = new Map(((drivers ?? []) as Pick<Driver, "id" | "full_name">[]).map((d) => [d.id, d.full_name]));
  const limit = limitsFor(ctx.org).vehicles;
  const atLimit = Number.isFinite(limit) && list.length >= limit;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("vehicles.title")}
        description={
          Number.isFinite(limit) ? t("vehicles.usage", { count: list.length, limit }) : t("vehicles.countOnly", { count: list.length })
        }
        actions={
          atLimit ? (
            <LinkButton href="/app/settings/billing" variant="lime">
              {t("vehicles.upgrade")}
            </LinkButton>
          ) : (
            <LinkButton href="/app/fleet/vehicles/new">
              <Plus className="h-4 w-4" /> {t("vehicles.add")}
            </LinkButton>
          )
        }
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck className="h-7 w-7" />}
            title={t("vehicles.emptyTitle")}
            description={t("vehicles.emptyText")}
            action={
              <LinkButton href="/app/fleet/vehicles/new">
                <Plus className="h-4 w-4" /> {t("vehicles.add")}
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => {
            const next = nextExpiry(v as unknown as Record<string, unknown>, VEHICLE_DOCS);
            return (
              <Link key={v.id} href={`/app/fleet/vehicles/${v.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-brand-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                        <VehicleIcon kind={v.kind} className="h-5 w-5" />
                      </div>
                      <div>
                        <Plate reg={v.registration} country={ctx.org.country} size="sm" />
                        <div className="mt-1 text-sm text-slate-600">{[v.make, v.model].filter(Boolean).join(" ") || t(`kinds.${v.kind}`)}</div>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[v.status]}>{t(`vehicleStatus.${v.status}`)}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Weight className="h-3.5 w-3.5" /> {v.capacity_kg ? `${v.capacity_kg.toLocaleString()} kg` : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> {v.pallets ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> {v.odometer ? v.odometer.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-500">{v.default_driver_id ? driverName.get(v.default_driver_id) : t("vehicles.noDriver")}</span>
                    {next ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">{t(`docs.${next.doc}`)}</span>
                        <ExpiryBadge date={next.date} compact />
                      </span>
                    ) : (
                      <span className="text-slate-400">{t("vehicles.noDates")}</span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
