import "server-only";
import type { AppContext } from "@/lib/auth";
import type { JobFormCustomer, JobFormDriver, JobFormVehicle } from "@/components/jobs/job-form";
import { DEFAULT_PRICING } from "@/lib/pricing";

export async function loadJobFormData(ctx: AppContext) {
  const [customers, drivers, vehicles] = await Promise.all([
    ctx.supabase.from("hl_customers").select("id, name, rate_per_distance, country").eq("org_id", ctx.org.id).order("name"),
    ctx.supabase.from("hl_drivers").select("id, full_name").eq("org_id", ctx.org.id).neq("status", "inactive").order("full_name"),
    ctx.supabase
      .from("hl_vehicles")
      .select("id, registration, default_driver_id")
      .eq("org_id", ctx.org.id)
      .neq("status", "off_road")
      .order("registration"),
  ]);
  return {
    org: {
      currency: ctx.org.currency,
      distance_unit: ctx.org.distance_unit,
      pricing: { ...DEFAULT_PRICING, ...(ctx.org.pricing ?? {}) },
      country: ctx.org.country,
    },
    customers: (customers.data ?? []) as JobFormCustomer[],
    drivers: (drivers.data ?? []) as JobFormDriver[],
    vehicles: (vehicles.data ?? []) as JobFormVehicle[],
  };
}
