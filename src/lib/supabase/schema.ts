/** Postgres schema that holds all MatrixFleet tables (exposed through the Supabase API). */
export const DB_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "matrixfleet";
