"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { country } from "@/lib/countries";
import { str } from "@/lib/utils";
import { getLocale } from "next-intl/server";

export type AuthState = { error?: string; message?: string } | undefined;

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!email || !password) return { error: "missing" };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(safeNext(str(fd, "next")));
}

export async function sendMagicLink(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = str(fd, "email");
  if (!email) return { error: "missing" };
  const next = safeNext(str(fd, "next"));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false },
  });
  if (error) return { error: error.message };
  return { message: "magicSent" };
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = str(fd, "email");
  const password = str(fd, "password");
  const fullName = str(fd, "full_name");
  const company = str(fd, "company");
  const countryCode = str(fd, "country") ?? "GB";
  if (!email || !password || !fullName || !company) return { error: "missing" };
  if (password.length < 8) return { error: "passwordShort" };
  if (fd.get("terms") !== "on") return { error: "terms" };

  const currency = country(countryCode)?.currency === "GBP" ? "GBP" : country(countryCode)?.currency ?? "EUR";
  const locale = await getLocale();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding`,
      data: { full_name: fullName, company, country: countryCode, currency, locale, terms_accepted_at: new Date().toISOString() },
    },
  });
  if (error) return { error: error.message };

  // If email confirmation is disabled the user is signed in straight away.
  if (data.session) {
    const { error: orgError } = await supabase.rpc("hl_create_organization", {
      p_name: company,
      p_country: countryCode,
      p_currency: currency,
      p_full_name: fullName,
      p_locale: locale,
    });
    if (orgError) return { error: orgError.message };
    redirect("/app?welcome=1");
  }
  return { message: "confirmEmail" };
}

export async function createOrganization(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const company = str(fd, "company");
  const fullName = str(fd, "full_name");
  const countryCode = str(fd, "country") ?? "GB";
  const currency = str(fd, "currency") ?? country(countryCode)?.currency ?? "EUR";
  if (!company || !fullName) return { error: "missing" };
  const { error } = await supabase.rpc("hl_create_organization", {
    p_name: company,
    p_country: countryCode,
    p_currency: currency,
    p_full_name: fullName,
    p_locale: await getLocale(),
  });
  if (error) return { error: error.message };
  redirect("/app?welcome=1");
}

export async function acceptInvitation(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const token = str(fd, "token");
  const fullName = str(fd, "full_name");
  if (!token || !fullName) return { error: "missing" };
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    // New user: create the account first.
    const email = str(fd, "email");
    const password = str(fd, "password");
    if (!email || !password) return { error: "missing" };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${await origin()}/auth/callback?next=/invite/${token}`,
        data: { full_name: fullName },
      },
    });
    if (error) return { error: error.message };
    if (!data.session) return { message: "confirmEmail" };
  }

  const { error } = await supabase.rpc("hl_accept_invitation", { p_token: token, p_full_name: fullName });
  if (error) return { error: error.message };
  const { data: m } = await supabase.from("hl_memberships").select("role").eq("user_id", (await supabase.auth.getUser()).data.user!.id).limit(1).maybeSingle();
  redirect(m?.role === "driver" ? "/driver" : "/app?welcome=1");
}
