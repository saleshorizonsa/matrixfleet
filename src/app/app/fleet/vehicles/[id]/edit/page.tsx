import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "@/components/fleet/vehicle-form";
import type { Vehicle } from "@/lib/types";

export const metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("fleet");
  const [{ data: vehicle }, { data: drivers }] = await Promise.all([
    ctx.supabase.from("hl_vehicles").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Vehicle>(),
    ctx.supabase.from("hl_drivers").select("id, full_name").eq("org_id", ctx.org.id).order("full_name"),
  ]);
  if (!vehicle) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("vehicles.edit", { reg: vehicle.registration })} />
      <VehicleForm vehicle={vehicle} drivers={drivers ?? []} country={ctx.org.country} />
    </div>
  );
}
