"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eraseUserAccount } from "@/lib/account-deletion";
import { requireDriver } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Job, JobStatus } from "@/lib/types";

export type DriverStep = "start" | "arrived_pickup" | "collected" | "arrived_delivery";

type Result = { ok: true } | { ok: false; error: string };

async function loadMyJob(jobId: string) {
  const ctx = await requireDriver();
  const { data: job } = await ctx.supabase
    .from("hl_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("driver_id", ctx.driver.id)
    .maybeSingle<Job>();
  return { ctx, job };
}

/** Advance a job one step in the driver flow. */
export async function driverStep(jobId: string, step: DriverStep, lat?: number | null, lng?: number | null): Promise<Result> {
  const { ctx, job } = await loadMyJob(jobId);
  if (!job) return { ok: false, error: "notFound" };
  if (["delivered", "invoiced", "cancelled"].includes(job.status)) return { ok: false, error: "closed" };

  const patch: Partial<Job> = {};
  let status: JobStatus | null = null;
  if (step === "start" && (job.status === "booked" || job.status === "assigned")) status = "assigned";
  if (step === "collected") {
    status = "in_transit";
    patch.picked_up_at = new Date().toISOString();
  }
  if (status && status !== job.status) patch.status = status;

  if (Object.keys(patch).length) {
    const { error } = await ctx.supabase.from("hl_jobs").update(patch).eq("id", job.id);
    if (error) return { ok: false, error: error.message };
  }
  // status changes already create a timeline event via trigger; add the step marker for the others
  if (step !== "collected") {
    await ctx.supabase.from("hl_job_events").insert({
      org_id: job.org_id,
      job_id: job.id,
      kind: step,
      lat: lat ?? null,
      lng: lng ?? null,
      created_by: ctx.user.id,
    });
  }
  revalidatePath(`/driver/jobs/${job.id}`);
  revalidatePath("/driver");
  return { ok: true };
}

export async function submitPod(
  jobId: string,
  input: {
    signedBy: string;
    signaturePath: string | null;
    photoPaths: string[];
    notes: string | null;
    lat: number | null;
    lng: number | null;
  },
): Promise<Result> {
  const { ctx, job } = await loadMyJob(jobId);
  if (!job) return { ok: false, error: "notFound" };
  if (!input.signedBy.trim()) return { ok: false, error: "recipientRequired" };
  const prefix = `${job.org_id}/${job.id}/`;
  const paths = [input.signaturePath, ...input.photoPaths].filter(Boolean) as string[];
  if (paths.some((p) => !p.startsWith(prefix))) return { ok: false, error: "badPath" };

  const now = new Date().toISOString();
  const { error } = await ctx.supabase
    .from("hl_jobs")
    .update({
      status: "delivered",
      delivered_at: now,
      picked_up_at: job.picked_up_at ?? now,
      pod_signed_by: input.signedBy.trim(),
      pod_signature_path: input.signaturePath,
      pod_photo_paths: input.photoPaths.slice(0, 4),
      pod_notes: input.notes,
      pod_lat: input.lat,
      pod_lng: input.lng,
    })
    .eq("id", job.id);
  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("hl_job_events").insert({
    org_id: job.org_id,
    job_id: job.id,
    kind: "pod",
    message: input.signedBy.trim(),
    lat: input.lat,
    lng: input.lng,
    created_by: ctx.user.id,
  });
  await audit(ctx, "job.delivered", "job", job.id, { reference: job.reference, photos: input.photoPaths.length });
  revalidatePath(`/driver/jobs/${job.id}`);
  revalidatePath("/driver");
  return { ok: true };
}

export async function reportProblem(jobId: string, message: string, lat?: number | null, lng?: number | null): Promise<Result> {
  const { ctx, job } = await loadMyJob(jobId);
  if (!job) return { ok: false, error: "notFound" };
  if (!message.trim()) return { ok: false, error: "messageRequired" };
  const { error } = await ctx.supabase.from("hl_job_events").insert({
    org_id: job.org_id,
    job_id: job.id,
    kind: "problem",
    message: message.trim().slice(0, 1000),
    lat: lat ?? null,
    lng: lng ?? null,
    created_by: ctx.user.id,
  });
  if (error) return { ok: false, error: error.message };
  await audit(ctx, "job.problem_reported", "job", job.id, { reference: job.reference });
  revalidatePath(`/driver/jobs/${job.id}`);
  return { ok: true };
}

export async function submitVehicleCheck(input: {
  vehicleId: string;
  odometer: number | null;
  items: Record<string, "ok" | "defect" | "na">;
  defects: string | null;
  photoPaths: string[];
}): Promise<Result> {
  const ctx = await requireDriver();
  const { data: vehicle } = await ctx.supabase.from("hl_vehicles").select("id, org_id").eq("id", input.vehicleId).maybeSingle();
  if (!vehicle || vehicle.org_id !== ctx.org.id) return { ok: false, error: "notFound" };
  const passed = !Object.values(input.items).includes("defect");
  if (!passed && !input.defects?.trim()) return { ok: false, error: "defectRequired" };
  if (input.photoPaths.some((p) => !p.startsWith(`${ctx.org.id}/checks/`))) return { ok: false, error: "badPath" };

  const { data, error } = await ctx.supabase
    .from("hl_vehicle_checks")
    .insert({
      org_id: ctx.org.id,
      vehicle_id: vehicle.id,
      driver_id: ctx.driver.id,
      odometer: input.odometer,
      items: input.items,
      defects: input.defects?.trim() || null,
      passed,
      photo_paths: input.photoPaths.slice(0, 4),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await audit(ctx, passed ? "vehicle_check.passed" : "vehicle_check.defect", "vehicle_check", data.id, { vehicle_id: vehicle.id });
  revalidatePath("/driver/check");
  return { ok: true };
}

export async function startShift(vehicleId: string | null): Promise<Result> {
  const ctx = await requireDriver();
  const { data: open } = await ctx.supabase
    .from("hl_driver_shifts")
    .select("id")
    .eq("driver_id", ctx.driver.id)
    .is("ended_at", null)
    .maybeSingle();
  if (open) return { ok: false, error: "shiftOpen" };
  const { error } = await ctx.supabase.from("hl_driver_shifts").insert({
    org_id: ctx.org.id,
    driver_id: ctx.driver.id,
    vehicle_id: vehicleId || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/driver/shift");
  return { ok: true };
}

export async function toggleBreak(shiftId: string): Promise<Result> {
  const ctx = await requireDriver();
  const { data: shift } = await ctx.supabase
    .from("hl_driver_shifts")
    .select("*")
    .eq("id", shiftId)
    .eq("driver_id", ctx.driver.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!shift) return { ok: false, error: "notFound" };
  const now = new Date();
  const patch = shift.on_break_since
    ? {
        on_break_since: null,
        last_break_end_at: now.toISOString(),
        break_minutes: shift.break_minutes + Math.round((now.getTime() - new Date(shift.on_break_since).getTime()) / 60000),
      }
    : { on_break_since: now.toISOString() };
  const { error } = await ctx.supabase.from("hl_driver_shifts").update(patch).eq("id", shift.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/driver/shift");
  return { ok: true };
}

export async function endShift(shiftId: string, notes: string | null): Promise<Result> {
  const ctx = await requireDriver();
  const { data: shift } = await ctx.supabase
    .from("hl_driver_shifts")
    .select("*")
    .eq("id", shiftId)
    .eq("driver_id", ctx.driver.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!shift) return { ok: false, error: "notFound" };
  const now = new Date();
  const extraBreak = shift.on_break_since ? Math.round((now.getTime() - new Date(shift.on_break_since).getTime()) / 60000) : 0;
  const { error } = await ctx.supabase
    .from("hl_driver_shifts")
    .update({
      ended_at: now.toISOString(),
      on_break_since: null,
      break_minutes: shift.break_minutes + extraBreak,
      notes: notes?.trim() || null,
    })
    .eq("id", shift.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/driver/shift");
  return { ok: true };
}

/** Driver self-service erasure (GDPR Art. 17): login, GPS history and audit-trail email. */
export async function deleteDriverAccount(_: { error?: string } | undefined, fd: FormData): Promise<{ error?: string } | undefined> {
  const ctx = await requireDriver();
  // owners/admins who also drive delete their account from Settings → Privacy (last-owner checks live there)
  if (ctx.membership.role !== "driver") return { error: "deleteFailed" };
  if (String(fd.get("confirm") ?? "").trim() !== "DELETE") return { error: "deleteMismatch" };
  await audit(ctx, "user.deleted", "user", ctx.user.id);
  const res = await eraseUserAccount(ctx.user.id, ctx.user.email);
  if ("error" in res) return { error: "deleteFailed" };
  await ctx.supabase.auth.signOut();
  redirect("/?deleted=1");
}
