-- MatrixFleet — rate limiting for authentication (sign-in, sign-up, email links, invitations).
-- Shared by all app servers (Vercel runs many instances, so in-memory counters would not work).
-- Keys are SHA-256 hashes made by the app ("login:ip:<hash>") — no raw IPs or emails are stored.
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;

create table if not exists hl_rate_limits (
  key text primary key,
  window_started timestamptz not null default now(),
  hits integer not null default 0
);
alter table hl_rate_limits enable row level security;   -- no policies: only the function below touches it
revoke all on hl_rate_limits from anon, authenticated;

-- Fixed-window counter. Returns the number of seconds to wait (0 = allowed).
create or replace function hl_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns integer language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
declare r hl_rate_limits;
begin
  insert into hl_rate_limits as t (key, window_started, hits) values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when t.window_started < now() - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end,
        window_started = case when t.window_started < now() - make_interval(secs => p_window_seconds) then now() else t.window_started end
  returning * into r;

  -- housekeeping: forget counters idle for a day (about 1 in 50 calls)
  if random() < 0.02 then
    delete from hl_rate_limits where window_started < now() - interval '1 day';
  end if;

  if r.hits > p_max then
    return greatest(1, ceil(extract(epoch from (r.window_started + make_interval(secs => p_window_seconds) - now())))::integer);
  end if;
  return 0;
end $$;

revoke all on function hl_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function hl_rate_limit(text, integer, integer) to service_role;

-- The table is handed to the matrixfleet login (0003 convention); the SECURITY DEFINER function
-- above runs as postgres, which therefore needs explicit access to it.
grant select, insert, update, delete on hl_rate_limits to postgres;
