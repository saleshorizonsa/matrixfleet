import "server-only";
import type { AppContext } from "@/lib/auth";

/** Append to the organisation's audit log. Never throws — auditing must not break the action. */
export async function audit(
  ctx: Pick<AppContext, "supabase" | "org" | "user">,
  action: string,
  entity?: string,
  entityId?: string,
  details: Record<string, unknown> = {},
) {
  try {
    await ctx.supabase.from("hl_audit_logs").insert({
      org_id: ctx.org.id,
      user_id: ctx.user.id,
      actor_email: ctx.user.email,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      details,
    });
  } catch {
    /* ignore */
  }
}
