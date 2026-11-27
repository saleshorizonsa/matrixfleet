import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Driver, Membership, Organization, Role } from "@/lib/types";

export interface AppContext {
  user: { id: string; email: string };
  membership: Membership;
  org: Organization;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/** Signed-in user (or null). Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/**
 * Current user + organisation. Redirects to /login when signed out and to
 * /onboarding when the user has no organisation yet. Cached per request.
 */
export const getContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("hl_memberships")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();
  if (!membership) redirect("/onboarding");

  const { data: org } = await supabase
    .from("hl_organizations")
    .select("*")
    .eq("id", membership.org_id)
    .single<Organization>();
  if (!org) redirect("/onboarding");

  return { user: { id: auth.user.id, email: auth.user.email ?? "" }, membership, org, supabase };
});

export const OFFICE_ROLES: Role[] = ["owner", "admin", "dispatcher", "accountant"];
export const ADMIN_ROLES: Role[] = ["owner", "admin"];

/** For office pages. Drivers are sent to the driver app. */
export async function requireOffice(roles: Role[] = OFFICE_ROLES) {
  const ctx = await getContext();
  if (ctx.membership.role === "driver") redirect("/driver");
  if (!roles.includes(ctx.membership.role)) redirect("/app?denied=1");
  return ctx;
}

/** For the driver PWA. Returns the driver record linked to the signed-in user. */
export async function requireDriver() {
  const ctx = await getContext();
  const { data: driver } = await ctx.supabase
    .from("hl_drivers")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("org_id", ctx.org.id)
    .maybeSingle<Driver>();
  if (!driver) {
    if (ctx.membership.role === "driver") redirect("/login?error=no-driver");
    redirect("/app?denied=driver");
  }
  return { ...ctx, driver };
}

export function canManage(role: Role) {
  return ADMIN_ROLES.includes(role);
}
