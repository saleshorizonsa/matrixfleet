"use client";
import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA } from "./schema";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: DB_SCHEMA }, cookieOptions: AUTH_COOKIE_OPTIONS },
    );
  }
  return client;
}
