/**
 * Content-Security-Policy for every page (set by src/proxy.ts with a fresh nonce per request).
 *
 * - script-src: only scripts carrying this request's nonce (Next.js adds it to its own scripts),
 *   plus what they load ('strict-dynamic'). Injected <script> tags and inline handlers are blocked.
 * - style-src 'unsafe-inline': required for style attributes used by React/Leaflet/Recharts.
 *   Styles cannot run code, so this does not weaken script protection.
 * - img-src: our domain (map tiles are proxied) + Supabase storage (logos, signed POD images).
 * - connect-src: our API + Supabase REST/Auth/Storage and its realtime websocket; data: for the
 *   signature pad (canvas → blob).
 * - form-action: our domain + Stripe Checkout / Customer Portal (we redirect there after a POST).
 * - frame-ancestors 'none': nobody may embed the app (clickjacking).
 */
export function buildCsp(nonce: string, isDev: boolean) {
  const supabase = safeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : "";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabase, supabaseWs, "data:", ...(isDev ? ["ws:"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    // in-app PDF preview/print: a blob: URL created by our own page (no third-party frames)
    "frame-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://checkout.stripe.com", "https://billing.stripe.com"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.filter(Boolean).join(" ")}`);
  if (!isDev && (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://")) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

function safeOrigin(u: string | undefined) {
  try {
    return u ? new URL(u).origin : "";
  } catch {
    return "";
  }
}
