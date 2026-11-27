-- One-off: remove the first MatrixFleet install from the "public" schema after moving
-- to the isolated "matrixfleet" schema. Only touches objects named hl_*.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'hl\_%' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'hl\_%' loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typname like 'hl\_%' and t.typtype = 'e' loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;
-- storage policies that called the old public functions
drop policy if exists hl_pod_rw on storage.objects;
drop policy if exists hl_logos_write on storage.objects;
