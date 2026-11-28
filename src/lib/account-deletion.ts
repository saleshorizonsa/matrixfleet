import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/safe-log";

/**
 * Right to erasure for one person (GDPR Art. 17).
 *
 * 1. hl_forget_user (database): removes the person from the audit trail (keeps the event,
 *    drops the email), deletes their GPS history and live position, unlinks their driver
 *    profile, deletes open invitations to their email, their memberships, and Supabase
 *    Auth's activity log entries (email + IP address).
 * 2. Deletes the login itself, which also removes their sessions (IP address, browser),
 *    refresh tokens, identities and profile metadata (name, company, country).
 *
 * Business records the company must keep (jobs, invoices, the driver's employment record)
 * stay with the company but are no longer linked to the person's login.
 */
export async function eraseUserAccount(userId: string, email: string | null) {
  const admin = createAdminClient();
  const { error: forgetError } = await admin.rpc("hl_forget_user", { p_user: userId, p_email: email });
  if (forgetError) {
    logError("[privacy] hl_forget_user failed", forgetError);
    return { error: "erase_failed" as const };
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    logError("[privacy] auth deleteUser failed", error);
    return { error: "erase_failed" as const };
  }
  return { ok: true as const };
}

/** Logins that no longer belong to any organisation (used after an organisation is deleted). */
export async function eraseOrphanedUsers(userIds: string[]) {
  if (!userIds.length) return 0;
  const admin = createAdminClient();
  const { data: still } = await admin.from("hl_memberships").select("user_id").in("user_id", userIds);
  const keep = new Set((still ?? []).map((m) => m.user_id as string));
  let erased = 0;
  for (const id of userIds) {
    if (keep.has(id)) continue; // member of another organisation: keep their login
    const { data } = await admin.auth.admin.getUserById(id);
    const res = await eraseUserAccount(id, data.user?.email ?? null);
    if ("ok" in res) erased++;
  }
  return erased;
}
