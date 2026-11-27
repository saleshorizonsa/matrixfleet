import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { DispatchBoard, type BoardDriver, type BoardJob } from "./board";

export const metadata = { title: "Dispatch" };

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("dispatch");
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDay(new Date());

  const cols = "id, reference, status, driver_id, sort_order, scheduled_date, pickup_city, pickup_postcode, delivery_city, delivery_postcode, distance_km, delivery_lat, delivery_lng, pallets, weight_kg, adr, temperature_controlled, pickup_from, delivery_to, price_net, currency, customer:hl_customers(name)";

  const [{ data: drivers }, { data: vehicles }, { data: dayJobs }, { data: unscheduled }] = await Promise.all([
    ctx.supabase.from("hl_drivers").select("id, full_name, colour, status, last_seen_at").eq("org_id", ctx.org.id).eq("status", "active").order("full_name"),
    ctx.supabase.from("hl_vehicles").select("id, registration, default_driver_id").eq("org_id", ctx.org.id),
    ctx.supabase
      .from("hl_jobs")
      .select(cols)
      .eq("org_id", ctx.org.id)
      .eq("scheduled_date", day)
      .in("status", ["booked", "assigned", "in_transit", "delivered"])
      .order("sort_order"),
    ctx.supabase
      .from("hl_jobs")
      .select(cols)
      .eq("org_id", ctx.org.id)
      .is("scheduled_date", null)
      .eq("status", "booked")
      .order("created_at")
      .limit(50),
  ]);

  const boardDrivers: BoardDriver[] = (drivers ?? []).map((d) => ({
    id: d.id,
    full_name: d.full_name,
    colour: d.colour,
    last_seen_at: d.last_seen_at,
    vehicle: (vehicles ?? []).find((v) => v.default_driver_id === d.id)?.registration ?? null,
  }));

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <LinkButton href="/app/jobs/new">
            <Plus className="h-4 w-4" /> {t("newJob")}
          </LinkButton>
        }
      />
      <DispatchBoard
        day={day}
        orgId={ctx.org.id}
        unit={ctx.org.distance_unit}
        drivers={boardDrivers}
        jobs={[...((dayJobs ?? []) as unknown as BoardJob[]), ...((unscheduled ?? []) as unknown as BoardJob[])]}
      />
    </div>
  );
}
