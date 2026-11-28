import "server-only";
import { randomBytes } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { logError } from "@/lib/safe-log";

/**
 * Turn an internal error (database, Supabase, Stripe…) into a safe message for the user.
 *
 * The browser only gets a generic, translated sentence plus a short reference ID; the details
 * (code, message) are written to the server log under the same reference, never sent to the client.
 */
export async function actionError(err: unknown, where: string): Promise<{ error: string }> {
  const ref = randomBytes(4).toString("hex");
  logError(`[action] ${where} ref=${ref}`, err);
  const t = await getTranslations("common");
  return { error: t("errorRef", { ref }) };
}

/** Supabase Auth errors that are safe and useful to show (mapped to i18n keys in auth.errors). */
const AUTH_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "email_exists",
  "weak_password",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "otp_expired",
  "signup_disabled",
  "email_address_invalid",
  "same_password",
]);

/** Map a Supabase Auth error to a known code, or fall back to a generic message with a reference. */
export async function authError(err: { code?: string; message?: string } | null | undefined, where: string) {
  const code = err?.code;
  if (code && AUTH_CODES.has(code)) return { error: code };
  if (err?.message === "Invalid login credentials") return { error: "invalid_credentials" };
  // raised by hl_accept_invitation (our own database function): safe to show
  if (err?.message?.includes("invitation invalid or expired")) return { error: "invite_expired" };
  if (err?.message?.includes("invitation was sent to a different email")) return { error: "invite_email_mismatch" };
  return actionError(err, where);
}
