-- MatrixFleet — follow-up to 0006 after re-testing (28 Nov 2026). Run as supabase_admin.
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;

-- 1. Seat counter: callable by signed-in users (the invitation trigger runs as the caller),
--    but it only answers for the caller's own company.
create or replace function hl_seats_used(p_org uuid) returns int
language sql stable security definer set search_path = matrixfleet, public, extensions as $$
  select case when hl_is_member(p_org) then
    (select count(*) from hl_memberships where org_id = p_org)::int
  + (select count(*) from hl_invitations where org_id = p_org and accepted_at is null and expires_at > now())::int
  end;
$$;
revoke all on function hl_seats_used(uuid) from public, anon;
grant execute on function hl_seats_used(uuid) to authenticated, service_role;

-- 2. Drivers: customer NAME for their assigned jobs only (no direct access to customer records,
--    which hold email, phone, VAT and address).
drop policy if exists driver_customers on hl_customers;

create or replace function hl_my_job_customer_name(p_job uuid) returns text
language sql stable security definer set search_path = matrixfleet, public, extensions as $$
  select c.name
    from hl_jobs j join hl_customers c on c.id = j.customer_id
   where j.id = p_job and j.driver_id in (select hl_my_driver_ids());
$$;
revoke all on function hl_my_job_customer_name(uuid) from public, anon;
grant execute on function hl_my_job_customer_name(uuid) to authenticated;

alter function hl_seats_used(uuid) owner to postgres;
alter function hl_my_job_customer_name(uuid) owner to postgres;
