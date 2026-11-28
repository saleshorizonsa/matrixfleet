import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase emails (sign-up confirmation, magic link).
 *
 * Supabase verifies the token *before* redirecting here and only adds `?code=` when that
 * succeeded. Exchanging the code for a session additionally needs a verifier cookie set in the
 * browser that started the flow, so it fails when the email is opened on another device or
 * browser (e.g. webmail on a phone). In that case the email IS confirmed — send the user to
 * sign in instead of showing an "invalid link" error.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));

    const login = new URL("/login", url.origin);
    login.searchParams.set("confirmed", "1");
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  // No code: Supabase rejected the token (expired or already used) and passed error_* params.
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
