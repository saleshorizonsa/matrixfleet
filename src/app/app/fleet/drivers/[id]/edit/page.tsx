import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DriverForm } from "@/components/fleet/driver-form";
import type { Driver } from "@/lib/types";

export const metadata = { title: "Edit driver" };

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("fleet");
  const { data: driver } = await ctx.supabase.from("hl_drivers").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Driver>();
  if (!driver) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("drivers.edit", { name: driver.full_name })} />
      <DriverForm driver={driver} />
    </div>
  );
}
