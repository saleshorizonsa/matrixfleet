-- MatrixFleet — privacy hardening (GDPR data minimisation, storage limitation, erasure)
-- Run as postgres (or supabase_admin with `set role postgres`), after 0003.
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;

-- ---------------------------------------------------------------------------
-- 1. GPS history retention: keep 90 days of breadcrumbs per driver.
--    Purged on every ping for that driver (cheap: indexed on driver_id, recorded_at).
-- ---------------------------------------------------------------------------
create or replace function hl_driver_ping(p_lat double precision, p_lng double precision,
  p_speed double precision default null, p_heading double precision default null, p_accuracy double precision default null)
returns void language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
declare d hl_drivers;
begin
  select * into d from hl_drivers where user_id = auth.uid() limit 1;
  if d.id is null then raise exception 'not a driver'; end if;
  update hl_drivers set last_lat = p_lat, last_lng = p_lng, last_speed = p_speed,
    last_heading = p_heading, last_seen_at = now() where id = d.id;
  insert into hl_driver_locations(org_id, driver_id, lat, lng, speed, heading, accuracy)
    values (d.org_id, d.id, p_lat, p_lng, p_speed, p_heading, p_accuracy);
  delete from hl_driver_locations where driver_id = d.id and recorded_at < now() - interval '90 days';
end $$;

-- one-off clean-up of anything already older than 90 days
delete from hl_driver_locations where recorded_at < now() - interval '90 days';

-- ---------------------------------------------------------------------------
-- 2. Public tracking page: return only what a consignee needs.
--    The person who signed for the delivery is shown by first name only.
-- ---------------------------------------------------------------------------
create or replace function hl_get_tracking(p_token text)
returns jsonb language sql stable security definer set search_path = matrixfleet, public, extensions as $$
  select jsonb_build_object(
    'reference', j.reference,
    'status', j.status,
    'company', o.name,
    'company_logo', o.logo_url,
    'company_phone', o.phone,
    'pickup_city', j.pickup_city, 'pickup_country', j.pickup_country,
    'delivery_city', j.delivery_city, 'delivery_country', j.delivery_country,
    'delivery_postcode', j.delivery_postcode,
    'delivery_lat', j.delivery_lat, 'delivery_lng', j.delivery_lng,
    'pickup_lat', j.pickup_lat, 'pickup_lng', j.pickup_lng,
    'scheduled_date', j.scheduled_date,
    'delivery_from', j.delivery_from, 'delivery_to', j.delivery_to,
    'picked_up_at', j.picked_up_at, 'delivered_at', j.delivered_at,
    'pod_signed_by', nullif(split_part(trim(coalesce(j.pod_signed_by, '')), ' ', 1), ''),
    'driver_first_name', split_part(d.full_name, ' ', 1),
    'driver_lat', case when j.status = 'in_transit' then d.last_lat end,
    'driver_lng', case when j.status = 'in_transit' then d.last_lng end,
    'driver_seen_at', case when j.status = 'in_transit' then d.last_seen_at end,
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'status', e.status, 'at', e.created_at) order by e.created_at)
                        from hl_job_events e where e.job_id = j.id and e.kind in ('created','status')), '[]'::jsonb)
  )
  from hl_jobs j
  join hl_organizations o on o.id = j.org_id
  left join hl_drivers d on d.id = j.driver_id
  where j.tracking_token = p_token and j.status <> 'quote';
$$;
grant execute on function hl_get_tracking(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Right to erasure: remove a person's data before their login is deleted.
--    Called by the app (service role) from "Delete my account", the driver app and
--    "Delete organisation". Business records owned by the company (jobs, invoices,
--    the driver's employment record) stay with the company, but are unlinked from the
--    person's login; personal tracking data and identifiers are removed.
-- ---------------------------------------------------------------------------
create or replace function hl_forget_user(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
begin
  -- audit trail: keep what happened, drop who it was
  update hl_audit_logs
     set actor_email = null,
         details = details - 'email'
   where user_id = p_user or (p_email is not null and lower(actor_email) = lower(p_email));

  -- driver profile linked to this login: delete GPS history and live position, unlink
  delete from hl_driver_locations where driver_id in (select id from hl_drivers where user_id = p_user);
  update hl_drivers
     set last_lat = null, last_lng = null, last_speed = null, last_heading = null, last_seen_at = null, user_id = null
   where user_id = p_user;

  -- open invitations addressed to this person
  delete from hl_invitations where p_email is not null and lower(email) = lower(p_email) and accepted_at is null;

  -- memberships
  delete from hl_memberships where user_id = p_user;

  -- Supabase Auth's own activity log (email + IP address)
  delete from auth.audit_log_entries
   where payload->>'actor_id' = p_user::text
      or (p_email is not null and lower(payload->>'actor_username') = lower(p_email));
end $$;

revoke all on function hl_forget_user(uuid, text) from public, anon, authenticated;
grant execute on function hl_forget_user(uuid, text) to service_role;
