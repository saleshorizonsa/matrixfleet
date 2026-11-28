"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { country } from "@/lib/countries";
import { str } from "@/lib/utils";
import { getLocale } from "next-intl/server";
import { actionError, authError } from "@/lib/action-error";
import { LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string; message?: string } | undefined;

/** Base URL for links in emails. Always the configured address — never derived from the request's
 *  Host header, which a client can spoof to point confirmation links at another site. */
async function origin() {
  return process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "");
}

/** Response when an attempt limit is hit (the message asks the user to wait a few minutes). */
const limited = (): AuthState => ({ error: "rate_limited" });

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!email || !password) return { error: "missing" };
  const rl = await rateLimit([
    { scope: "login:ip", value: await clientIp(), ...LIMITS.loginIp },
    { scope: "login:email", value: email, ...LIMITS.loginEmail },
  ]);
  if (!rl.ok) return limited();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return authError(error, "(auth)");
  redirect(safeNext(str(fd, "next")));
}

export async function sendMagicLink(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = str(fd, "email");
  if (!email) return { error: "missing" };
  // the email link is also how users get back in after forgetting their password
  const rl = await rateLimit([
    { scope: "link:email", value: email, ...LIMITS.emailLinkEmail },
    { scope: "link:ip", value: await clientIp(), ...LIMITS.emailLinkIp },
  ]);
  if (!rl.ok) return limited();
  const next = safeNext(str(fd, "next"));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false },
  });
  if (error) return authError(error, "(auth)");
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
  const rl = await rateLimit([
    { scope: "signup:ip", value: await clientIp(), ...LIMITS.signupIp },
    { scope: "signup:email", value: email, ...LIMITS.signupEmail },
  ]);
  if (!rl.ok) return limited();

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
  if (error) return authError(error, "(auth)");

  // If email confirmation is disabled the user is signed in straight away.
  if (data.session) {
    const { error: orgError } = await supabase.rpc("hl_create_organization", {
      p_name: company,
      p_country: countryCode,
      p_currency: currency,
      p_full_name: fullName,
      p_locale: locale,
    });
    if (orgError) return actionError(orgError, "(auth)");
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
  if (error) return authError(error, "(auth)");
  redirect("/app?welcome=1");
}

export async function acceptInvitation(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const token = str(fd, "token");
  const fullName = str(fd, "full_name");
  if (!token || !fullName) return { error: "missing" };
  const rl = await rateLimit([{ scope: "invite:ip", value: await clientIp(), ...LIMITS.inviteIp }]);
  if (!rl.ok) return limited();
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
    if (error) return authError(error, "(auth)");
    if (!data.session) return { message: "confirmEmail" };
  }

  const { error } = await supabase.rpc("hl_accept_invitation", { p_token: token, p_full_name: fullName });
  if (error) return authError(error, "(auth)");
  const { data: m } = await supabase.from("hl_memberships").select("role").eq("user_id", (await supabase.auth.getUser()).data.user!.id).limit(1).maybeSingle();
  redirect(m?.role === "driver" ? "/driver" : "/app?welcome=1");
}
