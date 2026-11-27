import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LiveMap, type LiveDriver, type LiveJob } from "./live-map";

export const metadata = { title: "Live map" };

export default async function TrackingPage() {
  const ctx = await requireOffice();
  const t = await getTranslations("tracking");
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: drivers }, { data: vehicles }, { data: jobs }] = await Promise.all([
    ctx.supabase
      .from("hl_drivers")
      .select("id, full_name, colour, phone, status, last_lat, last_lng, last_speed, last_seen_at")
      .eq("org_id", ctx.org.id)
      .neq("status", "inactive")
      .order("full_name"),
    ctx.supabase.from("hl_vehicles").select("registration, default_driver_id").eq("org_id", ctx.org.id),
    ctx.supabase
      .from("hl_jobs")
      .select("id, reference, status, driver_id, delivery_city, delivery_postcode, delivery_lat, delivery_lng, delivery_to, scheduled_date")
      .eq("org_id", ctx.org.id)
      .or(`status.eq.in_transit,and(scheduled_date.eq.${today},status.in.(booked,assigned,delivered))`)
      .limit(500),
  ]);

  const live: LiveDriver[] = (drivers ?? []).map((d) => ({
    ...d,
    vehicle: (vehicles ?? []).find((v) => v.default_driver_id === d.id)?.registration ?? null,
  }));

  return (
    <div className="animate-fade-up">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <LiveMap orgId={ctx.org.id} drivers={live} jobs={(jobs ?? []) as LiveJob[]} unit={ctx.org.distance_unit} />
    </div>
  );
}
