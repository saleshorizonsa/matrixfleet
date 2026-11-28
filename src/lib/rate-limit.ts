import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/safe-log";

/**
 * Database-backed rate limiting for authentication actions.
 * Limits (per the launch checklist, stricter where it matters):
 *   sign-in        5 / minute per IP, 10 / 15 min per email
 *   sign-up        5 / hour per IP,   3 / hour per email
 *   email link /   3 / hour per email (this is also the password-reset path),
 *   password reset 10 / hour per IP
 *   invitations   10 / hour per IP
 */
export const LIMITS = {
  loginIp: { max: 5, windowSec: 60 },
  loginEmail: { max: 10, windowSec: 15 * 60 },
  signupIp: { max: 5, windowSec: 3600 },
  signupEmail: { max: 3, windowSec: 3600 },
  emailLinkEmail: { max: 3, windowSec: 3600 },
  emailLinkIp: { max: 10, windowSec: 3600 },
  inviteIp: { max: 10, windowSec: 3600 },
} as const;

type Rule = { scope: string; value: string | null | undefined; max: number; windowSec: number };

/** Visitor IP as seen by Vercel (x-real-ip), falling back to the first X-Forwarded-For hop. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const hash = (s: string) => createHash("sha256").update(s.toLowerCase()).digest("hex").slice(0, 32);

/**
 * Count one attempt against every rule. Returns { ok: false, retryAfter } if any is exceeded.
 * Fails open (allows the request) if the counter store is unreachable, and logs it — locking every
 * user out because the database blinked would be worse than a short unprotected window.
 */
export async function rateLimit(rules: Rule[]): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  try {
    const admin = createAdminClient();
    let wait = 0;
    for (const r of rules) {
      if (!r.value) continue;
      const { data, error } = await admin.rpc("hl_rate_limit", {
        p_key: `${r.scope}:${hash(r.value)}`,
        p_max: r.max,
        p_window_seconds: r.windowSec,
      });
      if (error) throw error;
      wait = Math.max(wait, Number(data) || 0);
    }
    return wait > 0 ? { ok: false, retryAfter: wait } : { ok: true };
  } catch (err) {
    logError("[rate-limit] counter unavailable, allowing request", err);
    return { ok: true };
  }
}
