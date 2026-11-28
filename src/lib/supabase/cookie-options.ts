/**
 * Options for the Supabase session cookies (replaces the library defaults: no Secure flag, 400 days).
 *
 * - secure:   only sent over HTTPS (on whenever the app runs on an https:// address)
 * - sameSite: "lax" — not sent on cross-site sub-requests (CSRF protection), still works for normal links
 * - maxAge:   30 days, renewed while the user is active
 *
 * httpOnly stays false: the browser-side Supabase client needs the session for realtime updates
 * (dispatch board, live map), photo/signature uploads and driver GPS. The access token inside expires
 * after 1 hour. XSS is the risk this leaves, so never render untrusted HTML.
 */
const https = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: https,
  maxAge: 60 * 60 * 24 * 30,
};
