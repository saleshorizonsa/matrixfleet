import "server-only";

/**
 * Startup check for environment variables (run once from src/instrumentation.ts).
 *
 * Critical variables missing or malformed → the server refuses to start, with a message naming
 * the variable (never its value). Optional features (billing) must be configured completely or
 * not at all.
 */
type Rule = { name: string; required: boolean; check?: (v: string) => string | null; hint: string };

const url = (v: string) => (/^https?:\/\/[^\s]+$/.test(v) ? null : "must be an http(s) URL");
const httpsInProd = (v: string) =>
  process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production" && !v.startsWith("https://")
    ? "must use https:// in production"
    : null;
const jwt = (v: string) => (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v) ? null : "must be a Supabase JWT key");

const RULES: Rule[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, check: (v) => url(v) ?? httpsInProd(v), hint: "Supabase API address, e.g. https://api.your-domain" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, check: jwt, hint: "Supabase anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, check: jwt, hint: "Supabase service role key (server only)" },
  { name: "NEXT_PUBLIC_APP_URL", required: true, check: (v) => url(v) ?? httpsInProd(v), hint: "public address of this app" },
  { name: "SUPABASE_AUTH_GATEWAY_KEY", required: true, check: (v) => (v.length >= 32 ? null : "must be at least 32 characters"), hint: "shared secret the API gateway requires for sign-in/sign-up calls (server only)" },
  { name: "NEXT_PUBLIC_SUPABASE_SCHEMA", required: false, check: (v) => (/^[a-z_][a-z0-9_]*$/.test(v) ? null : "invalid schema name"), hint: "defaults to matrixfleet" },
  { name: "OSRM_URL", required: false, check: url, hint: "routing service" },
  { name: "NOMINATIM_URL", required: false, check: url, hint: "address search service" },
  { name: "SMTP_HOST", required: false, hint: "SMTP server for document emails, e.g. smtp.zoho.com (with SMTP_PORT, SMTP_USER, SMTP_PASS)" },
  { name: "SMTP_PORT", required: false, check: (v) => (/^\d{2,5}$/.test(v) ? null : "must be a port number"), hint: "587 (STARTTLS) or 465 (TLS)" },
  { name: "SMTP_USER", required: false, check: (v) => (/^[^@\s]+@[^@\s]+$/.test(v) ? null : "must be the mailbox address"), hint: "sending mailbox, e.g. info@your-domain" },
  { name: "SMTP_PASS", required: false, hint: "SMTP / app password (server only)" },
  { name: "ZATCA_ENCRYPTION_KEY", required: false, check: (v) => (/^[0-9a-f]{64}$/i.test(v) ? null : "must be 64 hex characters (32 bytes)"), hint: "encrypts Saudi e-invoicing signing keys at rest (server only); without it ZATCA connection is disabled" },
  { name: "MAP_TILE_URL", required: false, check: (v) => (/^https:\/\/.+\{z\}.+\{x\}.+\{y\}/.test(v) ? null : "must be https and contain {z}, {x}, {y}"), hint: "map tile template" },
];

const STRIPE_PRICES = [
  "STRIPE_PRICE_STARTER_GBP", "STRIPE_PRICE_STARTER_EUR", "STRIPE_PRICE_GROWTH_GBP", "STRIPE_PRICE_GROWTH_EUR",
  "STRIPE_PRICE_PRO_GBP", "STRIPE_PRICE_PRO_EUR", "STRIPE_PRICE_GROWTH_EXTRA_VEHICLE_GBP", "STRIPE_PRICE_GROWTH_EXTRA_VEHICLE_EUR",
  "STRIPE_PRICE_PRO_EXTRA_VEHICLE_GBP", "STRIPE_PRICE_PRO_EXTRA_VEHICLE_EUR",
];

export function validateEnv(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const get = (n: string) => process.env[n]?.trim() || "";

  for (const r of RULES) {
    const v = get(r.name);
    if (!v) {
      if (r.required) errors.push(`${r.name} is not set (${r.hint})`);
      continue;
    }
    const problem = r.check?.(v);
    if (problem) errors.push(`${r.name} ${problem}`);
  }

  // Billing: all-or-nothing. Without STRIPE_SECRET_KEY billing is switched off (clear notice in the app).
  if (get("STRIPE_SECRET_KEY")) {
    if (!/^sk_(live|test)_/.test(get("STRIPE_SECRET_KEY")) && !/^rk_(live|test)_/.test(get("STRIPE_SECRET_KEY")))
      errors.push("STRIPE_SECRET_KEY must start with sk_live_/sk_test_ (or a restricted rk_ key)");
    if (!get("STRIPE_WEBHOOK_SECRET").startsWith("whsec_")) errors.push("STRIPE_WEBHOOK_SECRET is not set or invalid (required when Stripe is enabled)");
    for (const p of STRIPE_PRICES) {
      const v = get(p);
      if (!v) warnings.push(`${p} is not set — that plan/option is unavailable`);
      else if (!v.startsWith("price_")) errors.push(`${p} must be a Stripe price id (price_…)`);
    }
  } else {
    warnings.push("STRIPE_SECRET_KEY is not set — online billing is disabled");
  }

  // daily billing reconciliation needs a secret whenever billing is on
  if (get("STRIPE_SECRET_KEY") && get("CRON_SECRET").length < 32) errors.push("CRON_SECRET must be set (32+ characters) when Stripe is enabled");

  if (get("NEXT_PUBLIC_DEBUG") === "1" || get("DEBUG") === "1") warnings.push("a DEBUG flag is set — remove it in production");
  return { errors, warnings };
}

/** Throws (so the server refuses to start) when a critical variable is missing or invalid. */
export function assertEnv() {
  const { errors, warnings } = validateEnv();
  for (const w of warnings) console.warn(`[env] ${w}`);
  if (errors.length) {
    const msg = `[env] Refusing to start — fix these environment variables:\n  - ${errors.join("\n  - ")}`;
    console.error(msg);
    throw new Error(msg);
  }
}
