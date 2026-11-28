"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { limitsFor } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingConfigured, getStripe } from "@/lib/stripe";
import { str, num } from "@/lib/utils";
import { isLocale } from "@/i18n/config";
import { country, hasVat } from "@/lib/countries";
import type { Role } from "@/lib/types";
import { eraseOrphanedUsers, eraseUserAccount } from "@/lib/account-deletion";
import { actionError } from "@/lib/action-error";

export type ActionState = { ok?: boolean; error?: string; token?: string } | undefined;

const ROLES: Role[] = ["owner", "admin", "dispatcher", "driver", "accountant"];

/* ---------------------------------------------------------------- Company */
export async function updateCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOffice(ADMIN_ROLES);
  const ctry = str(fd, "country") ?? ctx.org.country;
  if (!country(ctry)) return { error: "invalidCountry" };
  const unit = str(fd, "distance_unit");
  const locale = str(fd, "locale");
  const vat = num(fd, "default_vat_rate");
  const terms = num(fd, "payment_terms_days");
  const name = str(fd, "name");
  if (!name) return { error: "nameRequired" };

  const update = {
    name,
    legal_name: str(fd, "legal_name"),
    legal_name_ar: str(fd, "legal_name_ar"),
    building_number: str(fd, "building_number")?.replace(/\s+/g, "") ?? null,
    district: str(fd, "district"),
    additional_number: str(fd, "additional_number")?.replace(/\s+/g, "") ?? null,
    vat_number: str(fd, "vat_number")?.replace(/\s+/g, "").toUpperCase() ?? null,
    company_number: str(fd, "company_number"),
    address_line1: str(fd, "address_line1"),
    address_line2: str(fd, "address_line2"),
    city: str(fd, "city"),
    postcode: str(fd, "postcode")?.toUpperCase() ?? null,
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    website: str(fd, "website"),
    country: ctry,
    currency: (str(fd, "currency") ?? ctx.org.currency).toUpperCase(),
    distance_unit: unit === "km" || unit === "mi" ? unit : ctx.org.distance_unit,
    locale: isLocale(locale) ? locale : ctx.org.locale,
    // no VAT system in force (Qatar, Kuwait) → 0 %
    default_vat_rate: !hasVat(ctry) ? 0 : vat !== null && vat >= 0 && vat <= 50 ? vat : ctx.org.default_vat_rate,
    invoice_prefix: (str(fd, "invoice_prefix") ?? "INV").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "INV",
    payment_terms_days: terms !== null && terms >= 0 && terms <= 180 ? Math.round(terms) : ctx.org.payment_terms_days,
    bank_name: str(fd, "bank_name"),
    bank_iban: str(fd, "bank_iban")?.replace(/\s+/g, "").toUpperCase() ?? null,
    bank_bic: str(fd, "bank_bic")?.toUpperCase() ?? null,
    bank_sort_code: str(fd, "bank_sort_code"),
    bank_account: str(fd, "bank_account"),
  };

  const { error } = await ctx.supabase.from("hl_organizations").update(update).eq("id", ctx.org.id);
  if (error) return actionError(error, "app/settings");
  await audit(ctx, "organization.updated", "organization", ctx.org.id, { fields: Object.keys(update) });
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function uploadLogo(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOffice(ADMIN_ROLES);
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "noFile" };
  if (file.size > 2 * 1024 * 1024) return { error: "fileTooLarge" };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { error: "fileType" };
  if (file.size > 2 * 1024 * 1024) return { error: "fileTooLarge" };
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const path = `${ctx.org.id}/logo-${Date.now()}.${ext}`;
  const { error } = await ctx.supabase.storage.from("hl-logos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return actionError(error, "app/settings");
  const { data } = ctx.supabase.storage.from("hl-logos").getPublicUrl(path);
  const { error: upErr } = await ctx.supabase.from("hl_organizations").update({ logo_url: data.publicUrl }).eq("id", ctx.org.id);
  if (upErr) return actionError(upErr, "app/settings");
  await audit(ctx, "organization.logo_updated", "organization", ctx.org.id);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function removeLogo() {
  const ctx = await requireOffice(ADMIN_ROLES);
  await ctx.supabase.from("hl_organizations").update({ logo_url: null }).eq("id", ctx.org.id);
  await audit(ctx, "organization.logo_removed", "organization", ctx.org.id);
  revalidatePath("/app", "layout");
}

/* ---------------------------------------------------------------- Pricing */
export async function updatePricing(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOffice(ADMIN_ROLES);
  const field = (k: string) => {
    const v = num(fd, k);
    return v !== null && v >= 0 && v < 100000 ? v : 0;
  };
  const pricing = {
    base_fee: field("base_fee"),
    rate_per_distance: field("rate_per_distance"),
    fuel_surcharge_pct: Math.min(100, field("fuel_surcharge_pct")),
    adr_surcharge: field("adr_surcharge"),
    per_pallet: field("per_pallet"),
  };
  const { error } = await ctx.supabase.from("hl_organizations").update({ pricing }).eq("id", ctx.org.id);
  if (error) return actionError(error, "app/settings");
  await audit(ctx, "organization.pricing_updated", "organization", ctx.org.id, pricing);
  revalidatePath("/app/settings/pricing");
  return { ok: true };
}

/* ---------------------------------------------------------------- Team */
export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOffice(ADMIN_ROLES);
  const email = str(fd, "email")?.toLowerCase();
  const role = str(fd, "role") as Role | null;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalidEmail" };
  if (!role || !ROLES.includes(role)) return { error: "invalidRole" };
  if (role === "owner" && ctx.membership.role !== "owner") return { error: "onlyOwnerCanInviteOwner" };

  const [{ count: members }, { count: pending }] = await Promise.all([
    ctx.supabase.from("hl_memberships").select("*", { count: "exact", head: true }).eq("org_id", ctx.org.id),
    ctx.supabase
      .from("hl_invitations")
      .select("*", { count: "exact", head: true })
      .eq("org_id", ctx.org.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  const limit = limitsFor(ctx.org).users;
  if ((members ?? 0) + (pending ?? 0) >= limit) return { error: "userLimit" };

  const { data, error } = await ctx.supabase
    .from("hl_invitations")
    .insert({ org_id: ctx.org.id, email, role, invited_by: ctx.user.id })
    .select("token")
    .single();
  if (error) return actionError(error, "app/settings");
  await audit(ctx, "invitation.created", "invitation", undefined, { role }); // no email in the audit trail
  revalidatePath("/app/settings/team");
  return { ok: true, token: data.token };
}

export async function revokeInvitation(id: string) {
  const ctx = await requireOffice(ADMIN_ROLES);
  await ctx.supabase.from("hl_invitations").delete().eq("id", id).eq("org_id", ctx.org.id);
  await audit(ctx, "invitation.revoked", "invitation", id);
  revalidatePath("/app/settings/team");
}

async function ownerCount(ctx: Awaited<ReturnType<typeof requireOffice>>) {
  const { count } = await ctx.supabase
    .from("hl_memberships")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ctx.org.id)
    .eq("role", "owner");
  return count ?? 0;
}

export async function changeRole(userId: string, role: Role) {
  const ctx = await requireOffice(ADMIN_ROLES);
  if (!ROLES.includes(role)) return { error: "invalidRole" };
  const { data: target } = await ctx.supabase
    .from("hl_memberships")
    .select("role")
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .single();
  if (!target) return { error: "notFound" };
  if ((target.role === "owner" || role === "owner") && ctx.membership.role !== "owner") return { error: "onlyOwner" };
  if (target.role === "owner" && role !== "owner" && (await ownerCount(ctx)) <= 1) return { error: "lastOwner" };
  const { error } = await ctx.supabase.from("hl_memberships").update({ role }).eq("org_id", ctx.org.id).eq("user_id", userId);
  if (error) return actionError(error, "app/settings");
  await audit(ctx, "membership.role_changed", "membership", userId, { from: target.role, to: role });
  revalidatePath("/app/settings/team");
  return { ok: true };
}

export async function removeMember(userId: string) {
  const ctx = await requireOffice(ADMIN_ROLES);
  const { data: target } = await ctx.supabase
    .from("hl_memberships")
    .select("role")
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .single();
  if (!target) return { error: "notFound" };
  if (target.role === "owner" && ctx.membership.role !== "owner") return { error: "onlyOwner" };
  if (target.role === "owner" && (await ownerCount(ctx)) <= 1) return { error: "lastOwner" };
  const { error } = await ctx.supabase.from("hl_memberships").delete().eq("org_id", ctx.org.id).eq("user_id", userId);
  if (error) return actionError(error, "app/settings");
  // unlink the driver profile so the person loses access to the driver app
  await ctx.supabase.from("hl_drivers").update({ user_id: null }).eq("org_id", ctx.org.id).eq("user_id", userId);
  await audit(ctx, "membership.removed", "membership", userId, { role: target.role });
  revalidatePath("/app/settings/team");
  return { ok: true };
}

/* ---------------------------------------------------------------- GDPR */
export async function deleteOrganization(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOffice(["owner"]);
  if (str(fd, "confirm") !== ctx.org.name) return { error: "confirmMismatch" };

  if (ctx.org.stripe_subscription_id && billingConfigured()) {
    try {
      await getStripe().subscriptions.cancel(ctx.org.stripe_subscription_id);
    } catch {
      /* subscription may already be gone */
    }
  }
  await audit(ctx, "organization.deleted", "organization", ctx.org.id, { name: ctx.org.name });

  const admin = createAdminClient();
  // remember who belonged to the company: their logins are erased afterwards if they have no other company
  const { data: members } = await admin.from("hl_memberships").select("user_id").eq("org_id", ctx.org.id);
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  // Stripe keeps billing history for tax law, but the customer profile (name, email, address) is deleted
  if (ctx.org.stripe_customer_id && billingConfigured()) {
    try {
      await getStripe().customers.del(ctx.org.stripe_customer_id);
    } catch {
      /* already deleted */
    }
  }
  // remove stored files (POD + logos) for this organisation
  for (const bucket of ["hl-pod", "hl-logos"]) {
    const { data: items } = await admin.storage.from(bucket).list(ctx.org.id, { limit: 1000 });
    if (items?.length) {
      // POD objects are nested one level deeper (<org>/<job>/<file>)
      const paths: string[] = [];
      for (const it of items) {
        if (it.id) paths.push(`${ctx.org.id}/${it.name}`);
        else {
          const { data: sub } = await admin.storage.from(bucket).list(`${ctx.org.id}/${it.name}`, { limit: 1000 });
          sub?.forEach((s) => paths.push(`${ctx.org.id}/${it.name}/${s.name}`));
        }
      }
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }
  }
  const { error } = await admin.from("hl_organizations").delete().eq("id", ctx.org.id);
  if (error) return actionError(error, "app/settings");
  await ctx.supabase.auth.signOut();
  await eraseOrphanedUsers(memberIds); // includes the owner, unless they belong to another company
  redirect("/?deleted=1");
}

export async function deleteMyAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOffice();
  if (str(fd, "confirm") !== "DELETE") return { error: "confirmMismatch" };
  if (ctx.membership.role === "owner" && (await ownerCount(ctx)) <= 1) return { error: "lastOwnerAccount" };
  await audit(ctx, "user.deleted", "user", ctx.user.id); // no email: the point is to forget it
  const res = await eraseUserAccount(ctx.user.id, ctx.user.email);
  if ("error" in res) return { error: res.error };
  await ctx.supabase.auth.signOut();
  redirect("/?deleted=1");
}
