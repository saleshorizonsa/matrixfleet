"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { limitsFor } from "@/lib/plans";
import { syncExtraVehicles } from "@/lib/stripe";
import { APP_URL, num, str } from "@/lib/utils";
import { actionError } from "@/lib/action-error";

export type FormState = { error?: string; ok?: boolean } | undefined;

const FLEET_ROLES = ["owner", "admin", "dispatcher"] as const;

function vehiclePayload(fd: FormData) {
  return {
    registration: (str(fd, "registration") ?? "").toUpperCase(),
    make: str(fd, "make"),
    model: str(fd, "model"),
    kind: str(fd, "kind") ?? "van",
    capacity_kg: num(fd, "capacity_kg"),
    pallets: num(fd, "pallets"),
    mot_expiry: str(fd, "mot_expiry"),
    insurance_expiry: str(fd, "insurance_expiry"),
    tax_expiry: str(fd, "tax_expiry"),
    tacho_calibration_expiry: str(fd, "tacho_calibration_expiry"),
    next_service_date: str(fd, "next_service_date"),
    odometer: num(fd, "odometer"),
    status: str(fd, "status") ?? "available",
    default_driver_id: str(fd, "default_driver_id"),
  };
}

export async function saveVehicle(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOffice([...FLEET_ROLES]);
  const id = str(fd, "id");
  const payload = vehiclePayload(fd);
  if (!payload.registration) return { error: "registrationRequired" };

  if (id) {
    const { error } = await ctx.supabase.from("hl_vehicles").update(payload).eq("id", id).eq("org_id", ctx.org.id);
    if (error) return actionError(error, "app/fleet");
    await audit(ctx, "vehicle.updated", "vehicle", id, { registration: payload.registration });
    revalidatePath("/app/fleet", "layout");
    redirect(`/app/fleet/vehicles/${id}`);
  }

  const limit = limitsFor(ctx.org).vehicles;
  const { count } = await ctx.supabase.from("hl_vehicles").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id);
  if (Number.isFinite(limit) && (count ?? 0) >= limit) return { error: "planLimit" };

  const { data, error } = await ctx.supabase
    .from("hl_vehicles")
    .insert({ ...payload, org_id: ctx.org.id })
    .select("id")
    .single();
  if (error) return actionError(error, "app/fleet");
  await audit(ctx, "vehicle.created", "vehicle", data.id, { registration: payload.registration });
  await syncExtraVehicles(ctx.org.id); // Growth/Pro: bill vehicles above the included ones
  revalidatePath("/app/fleet", "layout");
  redirect(`/app/fleet/vehicles/${data.id}`);
}

export async function deleteVehicle(id: string) {
  const ctx = await requireOffice(["owner", "admin"]);
  await ctx.supabase.from("hl_vehicles").delete().eq("id", id).eq("org_id", ctx.org.id);
  await audit(ctx, "vehicle.deleted", "vehicle", id);
  await syncExtraVehicles(ctx.org.id);
  revalidatePath("/app/fleet", "layout");
  redirect("/app/fleet/vehicles");
}

export async function resolveCheck(checkId: string, vehicleId: string) {
  const ctx = await requireOffice([...FLEET_ROLES]);
  await ctx.supabase
    .from("hl_vehicle_checks")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", checkId)
    .eq("org_id", ctx.org.id);
  await audit(ctx, "vehicle_check.resolved", "vehicle_check", checkId);
  revalidatePath(`/app/fleet/vehicles/${vehicleId}`);
  revalidatePath("/app/fleet/compliance");
  revalidatePath("/app");
}

function driverPayload(fd: FormData) {
  return {
    full_name: str(fd, "full_name") ?? "",
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
    licence_number: str(fd, "licence_number"),
    licence_categories: str(fd, "licence_categories"),
    licence_expiry: str(fd, "licence_expiry"),
    cpc_expiry: str(fd, "cpc_expiry"),
    tacho_card_expiry: str(fd, "tacho_card_expiry"),
    status: str(fd, "status") ?? "active",
    colour: /^#[0-9a-fA-F]{6}$/.test(str(fd, "colour") ?? "") ? str(fd, "colour")! : "#5B5BF7",
  };
}

export async function saveDriver(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOffice([...FLEET_ROLES]);
  const id = str(fd, "id");
  const payload = driverPayload(fd);
  if (!payload.full_name) return { error: "nameRequired" };
  if (id) {
    const { error } = await ctx.supabase.from("hl_drivers").update(payload).eq("id", id).eq("org_id", ctx.org.id);
    if (error) return actionError(error, "app/fleet");
    await audit(ctx, "driver.updated", "driver", id);
    revalidatePath("/app/fleet", "layout");
    redirect(`/app/fleet/drivers/${id}`);
  }
  const { data, error } = await ctx.supabase.from("hl_drivers").insert({ ...payload, org_id: ctx.org.id }).select("id").single();
  if (error) return actionError(error, "app/fleet");
  await audit(ctx, "driver.created", "driver", data.id);
  revalidatePath("/app/fleet", "layout");
  redirect(`/app/fleet/drivers/${data.id}`);
}

export async function deleteDriver(id: string) {
  const ctx = await requireOffice(["owner", "admin"]);
  await ctx.supabase.from("hl_drivers").delete().eq("id", id).eq("org_id", ctx.org.id);
  await audit(ctx, "driver.deleted", "driver", id);
  revalidatePath("/app/fleet", "layout");
  redirect("/app/fleet/drivers");
}

export type InviteState = { error?: string; link?: string; email?: string } | undefined;

export async function inviteDriver(_: InviteState, fd: FormData): Promise<InviteState> {
  const ctx = await requireOffice([...FLEET_ROLES]);
  const driverId = str(fd, "driver_id");
  const email = str(fd, "email")?.toLowerCase();
  if (!driverId || !email) return { error: "emailRequired" };

  // keep driver record email in sync so acceptance links the right profile
  await ctx.supabase.from("hl_drivers").update({ email }).eq("id", driverId).eq("org_id", ctx.org.id);

  const { data, error } = await ctx.supabase
    .from("hl_invitations")
    .insert({ org_id: ctx.org.id, email, role: "driver", invited_by: ctx.user.id })
    .select("token")
    .single();
  if (error) return actionError(error, "app/fleet");
  await audit(ctx, "invitation.created", "invitation", driverId, { role: "driver" }); // no email in the audit trail
  return { link: `${APP_URL}/invite/${data.token}`, email };
}
