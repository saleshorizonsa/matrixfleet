import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "@/components/fleet/vehicle-form";

export const metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("fleet");
  const { data: drivers } = await ctx.supabase.from("hl_drivers").select("id, full_name").eq("org_id", ctx.org.id).order("full_name");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("vehicles.add")} />
      <VehicleForm drivers={drivers ?? []} country={ctx.org.country} />
    </div>
  );
}
