"use server";
import { revalidatePath } from "next/cache";
import { requireOffice } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Job } from "@/lib/types";
import { actionError } from "@/lib/action-error";

/**
 * Move a job onto a driver's run (or back to unassigned) for `day`, and persist the
 * new order of every job in the target column.
 */
export async function moveJob(input: { jobId: string; driverId: string | null; orderedIds: string[]; day: string }) {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const { jobId, driverId, orderedIds, day } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "bad date" };

  const { data: job } = await ctx.supabase
    .from("hl_jobs")
    .select("id, status, driver_id, vehicle_id")
    .eq("id", jobId)
    .eq("org_id", ctx.org.id)
    .single<Pick<Job, "id" | "status" | "driver_id" | "vehicle_id">>();
  if (!job) return { error: "not found" };
  if (!["booked", "assigned", "in_transit"].includes(job.status)) return { error: "locked" };

  const patch: Record<string, unknown> = { driver_id: driverId, scheduled_date: day };
  if (job.status !== "in_transit") patch.status = driverId ? "assigned" : "booked";
  if (driverId && driverId !== job.driver_id) {
    const { data: v } = await ctx.supabase
      .from("hl_vehicles")
      .select("id")
      .eq("org_id", ctx.org.id)
      .eq("default_driver_id", driverId)
      .limit(1)
      .maybeSingle();
    patch.vehicle_id = v?.id ?? job.vehicle_id;
  }
  if (!driverId) patch.vehicle_id = null;

  const { error } = await ctx.supabase.from("hl_jobs").update(patch).eq("id", jobId).eq("org_id", ctx.org.id);
  if (error) return actionError(error, "app/dispatch");

  // persist order within the column
  await Promise.all(
    orderedIds.slice(0, 100).map((id, i) => ctx.supabase.from("hl_jobs").update({ sort_order: i }).eq("id", id).eq("org_id", ctx.org.id)),
  );

  if (driverId !== job.driver_id) await audit(ctx, "job.dispatched", "job", jobId, { driverId, day });
  revalidatePath("/app/dispatch");
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true };
}
