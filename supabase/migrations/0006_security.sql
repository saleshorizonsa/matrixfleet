-- MatrixFleet — fixes from the attacker-perspective review (28 Nov 2026).
-- Run as supabase_admin (superuser) after 0005. Guards apply to requests made with a user's own
-- token (current_user = 'authenticated'); trusted paths — SECURITY DEFINER functions (postgres) and
-- the service role used by the app's server — are not affected.
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;

-- ===========================================================================
-- Helpers
-- ===========================================================================
create or replace function hl_caller_is_user() returns boolean language sql stable as $$
  select current_user = 'authenticated';
$$;

-- Is the company allowed to create new records? (trial running, or a live subscription)
create or replace function hl_org_active(p_org uuid) returns boolean
language sql stable security definer set search_path = matrixfleet, public, extensions as $$
  select exists (
    select 1 from hl_organizations o where o.id = p_org and (
      (o.plan = 'trial' and o.trial_ends_at > now())
      or (o.plan <> 'trial' and o.subscription_status in ('active', 'trialing', 'past_due'))
    ));
$$;

-- ===========================================================================
-- 1. Owner count: members only (was readable for any company)
-- ===========================================================================
create or replace function hl_owner_count(p_org uuid)
returns integer language sql stable security definer set search_path = matrixfleet, public, extensions as $$
  select case when hl_is_member(p_org)
    then (select count(*)::int from hl_memberships where org_id = p_org and role = 'owner') end;
$$;

-- ===========================================================================
-- 2. Memberships: only owners may create/alter/remove owners; never remove the last owner;
--    memberships are only created through invitations / company creation.
-- ===========================================================================
create or replace function hl_guard_memberships() returns trigger language plpgsql as $$
declare
  v_org uuid := coalesce(new.org_id, old.org_id);
  v_caller hl_role;
  v_owners int;
begin
  if not hl_caller_is_user() then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    raise exception 'memberships are created through invitations' using errcode = '42501';
  end if;
  select role into v_caller from hl_memberships where org_id = v_org and user_id = auth.uid();
  if tg_op = 'UPDATE' and (new.org_id <> old.org_id or new.user_id <> old.user_id) then
    raise exception 'membership company/user cannot change' using errcode = '42501';
  end if;
  if (old.role = 'owner' or (tg_op = 'UPDATE' and new.role = 'owner')) and v_caller is distinct from 'owner' then
    raise exception 'only an owner can add, change or remove an owner' using errcode = '42501';
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into v_owners from hl_memberships where org_id = old.org_id and role = 'owner';
    if v_owners <= 1 then raise exception 'a company must keep at least one owner' using errcode = '42501'; end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists hl_memberships_guard on hl_memberships;
create trigger hl_memberships_guard before insert or update or delete on hl_memberships
  for each row execute function hl_guard_memberships();

-- ===========================================================================
-- 3. Invitations: owner invitations only by owners; plan user limits enforced in the database
-- ===========================================================================
-- seats in use (members + open invitations), counted with full visibility
create or replace function hl_seats_used(p_org uuid) returns int
language sql stable security definer set search_path = matrixfleet, public, extensions as $$
  select (select count(*) from hl_memberships where org_id = p_org)::int
       + (select count(*) from hl_invitations where org_id = p_org and accepted_at is null and expires_at > now())::int;
$$;
revoke all on function hl_seats_used(uuid) from public, anon;

create or replace function hl_guard_invitations() returns trigger language plpgsql as $$
declare v_caller hl_role; v_plan text; v_limit int; v_used int;
begin
  if not hl_caller_is_user() then return new; end if;
  select role into v_caller from hl_memberships where org_id = new.org_id and user_id = auth.uid();
  if new.role = 'owner' and v_caller is distinct from 'owner' then
    raise exception 'only an owner can invite an owner' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select plan into v_plan from hl_organizations where id = new.org_id;
    v_limit := case v_plan when 'starter' then 3 when 'pro' then null else 10 end;
    if v_limit is not null then
      v_used := hl_seats_used(new.org_id);
      if v_used >= v_limit then raise exception 'plan user limit reached' using errcode = '42501'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists hl_invitations_guard on hl_invitations;
create trigger hl_invitations_guard before insert or update on hl_invitations
  for each row execute function hl_guard_invitations();

-- ===========================================================================
-- 4. Audit log: entries are always attributed to the real caller (no forging)
-- ===========================================================================
create or replace function hl_stamp_audit() returns trigger language plpgsql as $$
begin
  if hl_caller_is_user() then
    new.user_id := auth.uid();
    new.actor_email := auth.jwt() ->> 'email';
  end if;
  return new;
end $$;
drop trigger if exists hl_audit_stamp on hl_audit_logs;
create trigger hl_audit_stamp before insert on hl_audit_logs for each row execute function hl_stamp_audit();

-- ===========================================================================
-- 5. Drivers may only move their job forward and record proof of delivery
-- ===========================================================================
create or replace function hl_guard_driver_job_update() returns trigger language plpgsql as $$
declare
  allowed text[] := array['status','picked_up_at','delivered_at','pod_signed_by','pod_signature_path',
                          'pod_photo_paths','pod_notes','pod_lat','pod_lng','updated_at'];
  rank_old int; rank_new int;
begin
  if not hl_caller_is_user() or hl_is_office(old.org_id) then return new; end if;
  -- caller is a driver (RLS already limits them to jobs assigned to them)
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'drivers can only update the delivery progress of a job' using errcode = '42501';
  end if;
  rank_old := array_position(array['quote','booked','assigned','in_transit','delivered'], old.status::text);
  rank_new := array_position(array['quote','booked','assigned','in_transit','delivered'], new.status::text);
  if new.status is distinct from old.status and (rank_new is null or rank_old is null or rank_new < rank_old) then
    raise exception 'invalid status change' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists hl_jobs_driver_guard on hl_jobs;
create trigger hl_jobs_driver_guard before update on hl_jobs for each row execute function hl_guard_driver_job_update();

-- ===========================================================================
-- 6. Row-level security: split "office can do everything" into per-action policies.
--    Deleting is reserved to owners/admins (matches the app). The job timeline and GPS
--    history can't be edited or deleted by users at all. New records need an active company.
-- ===========================================================================
do $$
declare t text;
begin
  -- main business tables
  foreach t in array array['hl_customers','hl_vehicles','hl_drivers','hl_jobs','hl_invoices'] loop
    execute format('drop policy if exists office_all on %I', t);
    execute format('drop policy if exists office_select on %I', t);
    execute format('drop policy if exists office_insert on %I', t);
    execute format('drop policy if exists office_update on %I', t);
    execute format('drop policy if exists office_delete on %I', t);
    execute format('create policy office_select on %I for select using (hl_is_office(org_id))', t);
    execute format('create policy office_insert on %I for insert with check (hl_is_office(org_id) and hl_org_active(org_id))', t);
    execute format('create policy office_update on %I for update using (hl_is_office(org_id)) with check (hl_is_office(org_id))', t);
    execute format($p$create policy office_delete on %I for delete using (hl_has_role(org_id, array['owner','admin']::hl_role[]))$p$, t);
  end loop;
  -- supporting tables: office full access except delete (owner/admin)
  foreach t in array array['hl_vehicle_checks','hl_driver_shifts'] loop
    execute format('drop policy if exists office_all on %I', t);
    execute format('drop policy if exists office_rw on %I', t);
    execute format('drop policy if exists office_del on %I', t);
    execute format('create policy office_rw on %I for select using (hl_is_office(org_id))', t);
    execute format('create policy office_ins on %I for insert with check (hl_is_office(org_id))', t);
    execute format('create policy office_upd on %I for update using (hl_is_office(org_id)) with check (hl_is_office(org_id))', t);
    execute format($p$create policy office_del on %I for delete using (hl_has_role(org_id, array['owner','admin']::hl_role[]))$p$, t);
  end loop;
end $$;

-- invoice lines follow their (draft) invoice: office may edit and remove lines
drop policy if exists office_all on hl_invoice_lines;
create policy office_all on hl_invoice_lines for all using (hl_is_office(org_id)) with check (hl_is_office(org_id));

-- job timeline: read + append only (evidence)
drop policy if exists office_all on hl_job_events;
drop policy if exists office_read on hl_job_events;
drop policy if exists office_append on hl_job_events;
create policy office_read on hl_job_events for select using (hl_is_office(org_id));
create policy office_append on hl_job_events for insert with check (hl_is_office(org_id));
drop policy if exists driver_events on hl_job_events;
drop policy if exists driver_events_read on hl_job_events;
drop policy if exists driver_events_append on hl_job_events;
create policy driver_events_read on hl_job_events for select
  using (job_id in (select id from hl_jobs where driver_id in (select hl_my_driver_ids())));
create policy driver_events_append on hl_job_events for insert
  with check (job_id in (select id from hl_jobs where driver_id in (select hl_my_driver_ids())) and hl_is_member(org_id));

-- GPS history: office may read; writes only through hl_driver_ping / erasure functions
drop policy if exists office_all on hl_driver_locations;
drop policy if exists office_read on hl_driver_locations;
create policy office_read on hl_driver_locations for select using (hl_is_office(org_id));

-- memberships: owners/admins may update or remove (guarded above); never insert directly
drop policy if exists mem_admin on hl_memberships;
drop policy if exists mem_admin_update on hl_memberships;
drop policy if exists mem_admin_delete on hl_memberships;
create policy mem_admin_update on hl_memberships for update
  using (hl_has_role(org_id, array['owner','admin']::hl_role[])) with check (hl_has_role(org_id, array['owner','admin']::hl_role[]));
create policy mem_admin_delete on hl_memberships for delete
  using (hl_has_role(org_id, array['owner','admin']::hl_role[]));

-- ===========================================================================
-- 7. Plan limits in the database (no bypass through the API)
-- ===========================================================================
create or replace function hl_guard_vehicle_limit() returns trigger language plpgsql as $$
declare v_plan text; v_limit int; v_count int;
begin
  if not hl_caller_is_user() then return new; end if;
  select plan into v_plan from hl_organizations where id = new.org_id;
  v_limit := case v_plan when 'trial' then 30 when 'starter' then 3 else null end;  -- growth/pro: extras are billed
  if v_limit is not null then
    select count(*) into v_count from hl_vehicles where org_id = new.org_id;
    if v_count >= v_limit then raise exception 'plan vehicle limit reached' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists hl_vehicles_limit on hl_vehicles;
create trigger hl_vehicles_limit before insert on hl_vehicles for each row execute function hl_guard_vehicle_limit();

-- ===========================================================================
-- 8. One company per login, one free trial per email address
--    (a one-way SHA-256 fingerprint of the email is kept to stop repeated trials)
-- ===========================================================================
create table if not exists hl_trial_claims (
  email_hash text primary key,
  claimed_at timestamptz not null default now()
);
alter table hl_trial_claims enable row level security;
revoke all on hl_trial_claims from anon, authenticated;

create or replace function hl_create_organization(
  p_name text, p_country char(2), p_currency char(3), p_full_name text, p_locale text default 'en'
) returns uuid language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
declare v_org uuid; v_unit text; v_vat numeric; v_email text; v_hash text; v_trial_end timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from hl_memberships where user_id = auth.uid()) then
    raise exception 'this login already belongs to a company' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  v_hash := encode(digest(lower(coalesce(v_email, auth.uid()::text)), 'sha256'), 'hex');
  if exists (select 1 from hl_trial_claims where email_hash = v_hash) then
    v_trial_end := now();                      -- free trial already used: choose a plan straight away
  else
    v_trial_end := now() + interval '14 days';
    insert into hl_trial_claims(email_hash) values (v_hash);
  end if;
  v_unit := case when upper(p_country) = 'GB' then 'mi' else 'km' end;
  v_vat := case upper(p_country)
    when 'GB' then 20 when 'IE' then 23 when 'DE' then 19 when 'FR' then 20 when 'ES' then 21
    when 'IT' then 22 when 'NL' then 21 when 'BE' then 21 when 'PL' then 23 when 'PT' then 23
    when 'AT' then 20 when 'SE' then 25 when 'DK' then 25 when 'FI' then 25.5 when 'CZ' then 21
    when 'RO' then 21 when 'HU' then 27 when 'GR' then 24 when 'SK' then 23 when 'BG' then 20
    when 'HR' then 25 when 'SI' then 22 when 'LT' then 21 when 'LV' then 21 when 'EE' then 24
    when 'LU' then 17 when 'CY' then 19 when 'MT' then 18 else 20 end;
  insert into hl_organizations(name, country, currency, distance_unit, default_vat_rate, locale, email, trial_ends_at)
    values (left(p_name, 200), upper(p_country), upper(p_currency), v_unit, v_vat, coalesce(p_locale,'en'), v_email, v_trial_end)
    returning id into v_org;
  insert into hl_memberships(org_id, user_id, role, full_name) values (v_org, auth.uid(), 'owner', left(p_full_name, 200));
  insert into hl_audit_logs(org_id, user_id, action, entity, entity_id)
    values (v_org, auth.uid(), 'organization.created', 'organization', v_org::text);
  return v_org;
end $$;

-- ===========================================================================
-- 9. Data validity
-- ===========================================================================
alter table hl_drivers drop constraint if exists hl_drivers_colour_hex;
alter table hl_drivers add constraint hl_drivers_colour_hex check (colour ~ '^#[0-9A-Fa-f]{6}$') not valid;
alter table hl_invoices drop constraint if exists hl_invoices_non_negative;
alter table hl_invoices add constraint hl_invoices_non_negative check (subtotal >= 0 and total >= 0 and vat_amount >= 0) not valid;

-- ===========================================================================
-- 10. Storage: size and type limits (no HTML/SVG in the public logo bucket)
-- ===========================================================================
update storage.buckets set file_size_limit = 2 * 1024 * 1024, allowed_mime_types = array['image/png','image/jpeg','image/webp']
  where id = 'hl-logos';
update storage.buckets set file_size_limit = 10 * 1024 * 1024, allowed_mime_types = array['image/png','image/jpeg']
  where id = 'hl-pod';
