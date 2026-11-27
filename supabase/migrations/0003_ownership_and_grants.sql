-- MatrixFleet — ownership and API access for the isolated "matrixfleet" schema.
-- Run as an admin that is a member of the matrixfleet role (postgres or supabase_admin).
--
-- * Tables, sequences and types are owned by the matrixfleet login (direct DB access, backups).
-- * SECURITY DEFINER functions stay owned by postgres, because they read auth.users,
--   which the matrixfleet login is deliberately not allowed to see.
-- * The Supabase API roles get table access; row-level security decides which rows.

set search_path = matrixfleet, public, extensions;

-- ownership ------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'matrixfleet' and c.relkind in ('r', 'p') loop
    execute format('alter table matrixfleet.%I owner to matrixfleet', r.relname);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'matrixfleet' and t.typtype = 'e' loop
    execute format('alter type matrixfleet.%I owner to matrixfleet', r.typname);
  end loop;
end $$;

-- API access -----------------------------------------------------------------
grant usage on schema matrixfleet to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema matrixfleet to authenticated, service_role;
grant usage, select on all sequences in schema matrixfleet to authenticated, service_role;

-- functions: signed-in users and the service role; anonymous visitors only get the
-- two public lookups (consignee tracking page and invitation preview)
revoke execute on all functions in schema matrixfleet from public, anon;
grant execute on all functions in schema matrixfleet to authenticated, service_role;
grant execute on function matrixfleet.hl_get_tracking(text) to anon;
grant execute on function matrixfleet.hl_get_invitation(text) to anon;

-- future objects created by the matrixfleet login get the same API access
alter default privileges for role matrixfleet in schema matrixfleet
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role matrixfleet in schema matrixfleet
  grant usage, select on sequences to authenticated, service_role;
alter default privileges for role matrixfleet in schema matrixfleet
  grant execute on functions to authenticated, service_role;
