import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DB_SCHEMA } from "./schema";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: DB_SCHEMA },
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — the proxy refreshes the session instead
          }
        },
      },
    },
  );
}
