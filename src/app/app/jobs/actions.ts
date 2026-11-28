"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOffice } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { bool, num, str } from "@/lib/utils";
import type { Customer, Job, JobStatus } from "@/lib/types";
import { actionError } from "@/lib/action-error";

export type JobFormState = { error?: string } | undefined;

const ADDRESS_FIELDS = ["name", "address", "city", "postcode", "country", "contact", "phone"] as const;

function parseJob(fd: FormData) {
  const row: Record<string, unknown> = {};
  for (const side of ["pickup", "delivery"] as const) {
    for (const f of ADDRESS_FIELDS) row[`${side}_${f}`] = str(fd, `${side}_${f}`);
    row[`${side}_lat`] = num(fd, `${side}_lat`);
    row[`${side}_lng`] = num(fd, `${side}_lng`);
    row[`${side}_from`] = str(fd, `${side}_from`);
    row[`${side}_to`] = str(fd, `${side}_to`);
    if (row[`${side}_country`]) row[`${side}_country`] = String(row[`${side}_country`]).toUpperCase().slice(0, 2);
  }
  Object.assign(row, {
    customer_id: str(fd, "customer_id"),
    customer_ref: str(fd, "customer_ref"),
    goods_description: str(fd, "goods_description"),
    weight_kg: num(fd, "weight_kg"),
    pallets: num(fd, "pallets"),
    volume_m3: num(fd, "volume_m3"),
    adr: bool(fd, "adr"),
    adr_un_number: bool(fd, "adr") ? str(fd, "adr_un_number") : null,
    temperature_controlled: bool(fd, "temperature_controlled"),
    distance_km: num(fd, "distance_km"),
    duration_min: num(fd, "duration_min"),
    price_net: num(fd, "price_net"),
    cost_estimate: num(fd, "cost_estimate"),
    scheduled_date: str(fd, "scheduled_date"),
    driver_id: str(fd, "driver_id"),
    vehicle_id: str(fd, "vehicle_id"),
    notes: str(fd, "notes"),
  });
  if (row.pallets !== null) row.pallets = Math.round(row.pallets as number);
  return row;
}

export async function saveJob(_: JobFormState, fd: FormData): Promise<JobFormState> {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const id = str(fd, "id");
  const intent = str(fd, "intent"); // "quote" | "book"
  const row = parseJob(fd);
  if (!row.pickup_city && !row.pickup_postcode && !row.pickup_address) return { error: "pickupRequired" };
  if (!row.delivery_city && !row.delivery_postcode && !row.delivery_address) return { error: "deliveryRequired" };

  let jobId = id;
  if (id) {
    const { data: existing } = await ctx.supabase.from("hl_jobs").select("status").eq("id", id).single<{ status: JobStatus }>();
    const patch: Record<string, unknown> = { ...row };
    if (existing?.status === "quote" && intent === "book") patch.status = row.driver_id ? "assigned" : "booked";
    else if (existing && ["booked", "assigned"].includes(existing.status)) patch.status = row.driver_id ? "assigned" : "booked";
    const { error } = await ctx.supabase.from("hl_jobs").update(patch).eq("id", id).eq("org_id", ctx.org.id);
    if (error) return actionError(error, "app/jobs");
    await audit(ctx, "job.updated", "job", id);
  } else {
    const status: JobStatus = intent === "quote" ? "quote" : row.driver_id ? "assigned" : "booked";
    const { data, error } = await ctx.supabase
      .from("hl_jobs")
      .insert({ ...row, org_id: ctx.org.id, status, currency: ctx.org.currency, reference: "", created_by: ctx.user.id })
      .select("id, reference")
      .single<{ id: string; reference: string }>();
    if (error || !data) return actionError(error ?? new Error("no row returned"), "app/jobs insert");
    jobId = data.id;
    await audit(ctx, "job.created", "job", data.id, { reference: data.reference, status });
  }
  revalidatePath("/app/jobs");
  revalidatePath("/app/dispatch");
  redirect(`/app/jobs/${jobId}`);
}

export async function quickAddCustomer(input: {
  name: string;
  email?: string;
  country?: string;
  vat_number?: string;
}): Promise<{ customer?: Pick<Customer, "id" | "name" | "rate_per_distance" | "country">; error?: string }> {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const name = input.name?.trim();
  if (!name) return { error: "name required" };
  const { data, error } = await ctx.supabase
    .from("hl_customers")
    .insert({
      org_id: ctx.org.id,
      name,
      email: input.email?.trim() || null,
      country: (input.country || ctx.org.country).toUpperCase(),
      vat_number: input.vat_number?.trim() || null,
    })
    .select("id, name, rate_per_distance, country")
    .single();
  if (error) return actionError(error, "app/jobs");
  await audit(ctx, "customer.created", "customer", data.id, { via: "job-form" });
  revalidatePath("/app/customers");
  return { customer: data };
}

export async function setJobStatus(jobId: string, status: JobStatus) {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const patch: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "in_transit") patch.picked_up_at = now;
  if (status === "delivered") patch.delivered_at = now;
  if (status === "booked") patch.driver_id = null;
  const { error } = await ctx.supabase.from("hl_jobs").update(patch).eq("id", jobId).eq("org_id", ctx.org.id);
  if (error) return actionError(error, "app/jobs");
  await audit(ctx, "job.status", "job", jobId, { status });
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app/jobs");
  revalidatePath("/app/dispatch");
  return { ok: true };
}

export async function assignJob(jobId: string, driverId: string | null, vehicleId: string | null) {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const { data: job } = await ctx.supabase.from("hl_jobs").select("status").eq("id", jobId).single<Pick<Job, "status">>();
  const patch: Record<string, unknown> = { driver_id: driverId, vehicle_id: vehicleId };
  if (job && ["booked", "assigned"].includes(job.status)) patch.status = driverId ? "assigned" : "booked";
  const { error } = await ctx.supabase.from("hl_jobs").update(patch).eq("id", jobId).eq("org_id", ctx.org.id);
  if (error) return actionError(error, "app/jobs");
  await audit(ctx, "job.assigned", "job", jobId, { driverId, vehicleId });
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app/dispatch");
  return { ok: true };
}

export async function duplicateJob(jobId: string) {
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const { data: src } = await ctx.supabase.from("hl_jobs").select("*").eq("id", jobId).single<Job>();
  if (!src) return { error: "not found" };
  const omit = [
    "id", "reference", "tracking_token", "created_at", "updated_at", "picked_up_at", "delivered_at", "pod_signed_by",
    "pod_signature_path", "pod_photo_paths", "pod_notes", "pod_lat", "pod_lng", "invoice_id", "driver_id", "sort_order",
  ];
  const copy: Record<string, unknown> = Object.fromEntries(Object.entries(src).filter(([k]) => !omit.includes(k)));
  copy.status = src.status === "quote" ? "quote" : "booked";
  copy.reference = "";
  copy.created_by = ctx.user.id;
  copy.scheduled_date = null;
  const { data, error } = await ctx.supabase.from("hl_jobs").insert(copy).select("id").single<{ id: string }>();
  if (error || !data) return actionError(error ?? new Error("no row returned"), "app/jobs");
  await audit(ctx, "job.duplicated", "job", data.id, { from: jobId });
  revalidatePath("/app/jobs");
  redirect(`/app/jobs/${data.id}/edit`);
}

export async function addJobNote(jobId: string, message: string) {
  const ctx = await requireOffice();
  const text = message.trim();
  if (!text) return { error: "empty" };
  const { error } = await ctx.supabase
    .from("hl_job_events")
    .insert({ org_id: ctx.org.id, job_id: jobId, kind: "note", message: text.slice(0, 2000), created_by: ctx.user.id });
  if (error) return actionError(error, "app/jobs");
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteJob(jobId: string) {
  const ctx = await requireOffice(["owner", "admin"]);
  const { data: job } = await ctx.supabase.from("hl_jobs").select("reference, invoice_id").eq("id", jobId).single();
  if (job?.invoice_id) return { error: "invoiced" };
  const { error } = await ctx.supabase.from("hl_jobs").delete().eq("id", jobId).eq("org_id", ctx.org.id);
  if (error) return actionError(error, "app/jobs");
  await audit(ctx, "job.deleted", "job", jobId, { reference: job?.reference });
  revalidatePath("/app/jobs");
  redirect("/app/jobs");
}
