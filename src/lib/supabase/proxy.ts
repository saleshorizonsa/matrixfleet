import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DB_SCHEMA } from "./schema";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

const PROTECTED = ["/app", "/driver", "/onboarding"];

/**
 * Refresh the Supabase session cookie and guard private areas.
 * `requestHeaders` carries extra request headers for the page render (CSP nonce).
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers = new Headers(request.headers)) {
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  let response = next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    db: { schema: DB_SCHEMA },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // keep the refreshed cookies on the request the page is rendered with
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }
  return response;
}
