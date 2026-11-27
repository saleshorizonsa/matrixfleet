import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "./schema";

/** Service-role client. Bypasses RLS — only use in trusted server code (webhooks, GDPR erasure). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
