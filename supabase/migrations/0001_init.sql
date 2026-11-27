-- Haulora — core schema (multi-tenant, RLS on every table)
-- Powered by Matrix Infotech Ltd
-- Safe to run on a self-hosted Supabase instance. All objects are prefixed
-- with the "hl_" naming convention where a clash with another app is likely.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type hl_role as enum ('owner','admin','dispatcher','driver','accountant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type hl_job_status as enum ('quote','booked','assigned','in_transit','delivered','invoiced','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type hl_invoice_status as enum ('draft','sent','paid','overdue','void');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Organisations (tenants)
-- ---------------------------------------------------------------------------
create table if not exists hl_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  country char(2) not null default 'GB',           -- ISO 3166-1 alpha-2
  currency char(3) not null default 'GBP',          -- ISO 4217
  distance_unit text not null default 'mi' check (distance_unit in ('km','mi')),
  locale text not null default 'en',
  vat_number text,
  company_number text,
  address_line1 text, address_line2 text, city text, postcode text,
  email text, phone text, website text,
  logo_url text,
  bank_name text, bank_iban text, bank_bic text, bank_sort_code text, bank_account text,
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  next_job_number integer not null default 1,
  payment_terms_days integer not null default 30,
  default_vat_rate numeric(5,2) not null default 20.00,
  pricing jsonb not null default '{"base_fee":35,"rate_per_distance":1.6,"fuel_surcharge_pct":8,"adr_surcharge":45,"per_pallet":4}'::jsonb,
  plan text not null default 'trial' check (plan in ('trial','starter','growth','pro')),
  subscription_status text not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hl_memberships (
  org_id uuid not null references hl_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role hl_role not null default 'dispatcher',
  full_name text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists hl_memberships_user_idx on hl_memberships(user_id);

create table if not exists hl_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  email text not null,
  role hl_role not null default 'dispatcher',
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies stay cheap)
-- ---------------------------------------------------------------------------
create or replace function hl_is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hl_memberships m where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function hl_has_role(p_org uuid, p_roles hl_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hl_memberships m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.role = any(p_roles));
$$;

-- office = everybody except drivers
create or replace function hl_is_office(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select hl_has_role(p_org, array['owner','admin','dispatcher','accountant']::hl_role[]);
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists hl_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'business' check (kind in ('business','individual')),
  vat_number text,
  vat_verified boolean not null default false,
  vat_verified_at timestamptz,
  country char(2) not null default 'GB',
  address_line1 text, address_line2 text, city text, postcode text,
  contact_name text, email text, phone text,
  payment_terms_days integer,
  rate_per_distance numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists hl_customers_org_idx on hl_customers(org_id);

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
create table if not exists hl_drivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text, phone text,
  licence_number text,
  licence_categories text,
  licence_expiry date,
  cpc_expiry date,
  tacho_card_expiry date,
  status text not null default 'active' check (status in ('active','off','inactive')),
  colour text not null default '#5B5BF7',
  last_lat double precision, last_lng double precision,
  last_speed double precision, last_heading double precision,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hl_drivers_org_idx on hl_drivers(org_id);
create index if not exists hl_drivers_user_idx on hl_drivers(user_id);

create table if not exists hl_vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  registration text not null,
  make text, model text,
  kind text not null default 'van' check (kind in ('van','luton','rigid','artic','trailer','car','other')),
  capacity_kg integer, pallets integer,
  mot_expiry date, insurance_expiry date, tax_expiry date,
  tacho_calibration_expiry date, next_service_date date,
  odometer integer,
  status text not null default 'available' check (status in ('available','in_use','maintenance','off_road')),
  default_driver_id uuid references hl_drivers(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hl_vehicles_org_idx on hl_vehicles(org_id);

-- the driver record of the signed-in user
create or replace function hl_my_driver_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select d.id from hl_drivers d where d.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Invoices (declared before jobs so jobs can reference them)
-- ---------------------------------------------------------------------------
create table if not exists hl_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  customer_id uuid references hl_customers(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  supply_date date,
  due_date date not null,
  currency char(3) not null,
  status hl_invoice_status not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  vat_treatment text not null default 'standard'
    check (vat_treatment in ('standard','reverse_charge','zero_rated','outside_scope','exempt')),
  vat_note text,
  -- snapshot of parties at time of issue (legal requirement — invoice must not change later)
  seller_snapshot jsonb not null default '{}'::jsonb,
  buyer_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, number)
);
create index if not exists hl_invoices_org_idx on hl_invoices(org_id);

create table if not exists hl_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  invoice_id uuid not null references hl_invoices(id) on delete cascade,
  job_id uuid,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  position integer not null default 0
);
create index if not exists hl_invoice_lines_inv_idx on hl_invoice_lines(invoice_id);

-- ---------------------------------------------------------------------------
-- Jobs (consignments)
-- ---------------------------------------------------------------------------
create table if not exists hl_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  reference text not null,
  customer_id uuid references hl_customers(id) on delete set null,
  customer_ref text,                           -- customer's PO / order number
  status hl_job_status not null default 'booked',

  pickup_name text, pickup_address text, pickup_city text, pickup_postcode text,
  pickup_country char(2) default 'GB',
  pickup_lat double precision, pickup_lng double precision,
  pickup_from timestamptz, pickup_to timestamptz,
  pickup_contact text, pickup_phone text,

  delivery_name text, delivery_address text, delivery_city text, delivery_postcode text,
  delivery_country char(2) default 'GB',
  delivery_lat double precision, delivery_lng double precision,
  delivery_from timestamptz, delivery_to timestamptz,
  delivery_contact text, delivery_phone text,

  goods_description text,
  weight_kg numeric(10,2),
  pallets integer,
  volume_m3 numeric(10,2),
  adr boolean not null default false,          -- dangerous goods
  adr_un_number text,
  temperature_controlled boolean not null default false,

  distance_km numeric(10,1),
  duration_min integer,
  price_net numeric(12,2),
  cost_estimate numeric(12,2),
  currency char(3) not null default 'GBP',

  scheduled_date date,
  driver_id uuid references hl_drivers(id) on delete set null,
  vehicle_id uuid references hl_vehicles(id) on delete set null,
  sort_order integer not null default 0,

  tracking_token text not null unique default encode(gen_random_bytes(12),'hex'),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  pod_signed_by text,
  pod_signature_path text,
  pod_photo_paths text[] not null default '{}',
  pod_notes text,
  pod_lat double precision, pod_lng double precision,

  invoice_id uuid references hl_invoices(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, reference)
);
create index if not exists hl_jobs_org_status_idx on hl_jobs(org_id, status);
create index if not exists hl_jobs_org_date_idx on hl_jobs(org_id, scheduled_date);
create index if not exists hl_jobs_driver_idx on hl_jobs(driver_id);

alter table hl_invoice_lines drop constraint if exists hl_invoice_lines_job_fk;
alter table hl_invoice_lines add constraint hl_invoice_lines_job_fk
  foreign key (job_id) references hl_jobs(id) on delete set null;

create table if not exists hl_job_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  job_id uuid not null references hl_jobs(id) on delete cascade,
  kind text not null,             -- created, status, assigned, note, pod, location
  status hl_job_status,
  message text,
  lat double precision, lng double precision,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists hl_job_events_job_idx on hl_job_events(job_id, created_at);

-- ---------------------------------------------------------------------------
-- Driver operations
-- ---------------------------------------------------------------------------
create table if not exists hl_driver_locations (
  id bigint generated always as identity primary key,
  org_id uuid not null references hl_organizations(id) on delete cascade,
  driver_id uuid not null references hl_drivers(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  speed double precision, heading double precision, accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists hl_driver_locations_idx on hl_driver_locations(driver_id, recorded_at desc);

create table if not exists hl_vehicle_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  vehicle_id uuid not null references hl_vehicles(id) on delete cascade,
  driver_id uuid references hl_drivers(id) on delete set null,
  odometer integer,
  items jsonb not null default '{}'::jsonb,     -- {"tyres":"ok","lights":"defect",...}
  defects text,
  passed boolean not null default true,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hl_vehicle_checks_org_idx on hl_vehicle_checks(org_id, created_at desc);

create table if not exists hl_driver_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references hl_organizations(id) on delete cascade,
  driver_id uuid not null references hl_drivers(id) on delete cascade,
  vehicle_id uuid references hl_vehicles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  break_minutes integer not null default 0,
  on_break_since timestamptz,
  notes text
);
create index if not exists hl_driver_shifts_idx on hl_driver_shifts(driver_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Audit log (GDPR accountability)
-- ---------------------------------------------------------------------------
create table if not exists hl_audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid not null references hl_organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hl_audit_logs_org_idx on hl_audit_logs(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function hl_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists hl_jobs_touch on hl_jobs;
create trigger hl_jobs_touch before update on hl_jobs
  for each row execute function hl_touch_updated_at();

-- auto job reference JOB-000001 per organisation
create or replace function hl_assign_job_reference() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if new.reference is null or new.reference = '' then
    update hl_organizations set next_job_number = next_job_number + 1
      where id = new.org_id returning next_job_number - 1 into n;
    new.reference := 'JOB-' || lpad(n::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists hl_jobs_reference on hl_jobs;
create trigger hl_jobs_reference before insert on hl_jobs
  for each row execute function hl_assign_job_reference();

-- write a timeline event whenever status / assignment changes
create or replace function hl_job_event_on_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into hl_job_events(org_id, job_id, kind, status, message, created_by)
      values (new.org_id, new.id, 'created', new.status, null, auth.uid());
  elsif new.status is distinct from old.status then
    insert into hl_job_events(org_id, job_id, kind, status, created_by)
      values (new.org_id, new.id, 'status', new.status, auth.uid());
  elsif new.driver_id is distinct from old.driver_id and new.driver_id is not null then
    insert into hl_job_events(org_id, job_id, kind, message, created_by)
      values (new.org_id, new.id, 'assigned',
        (select full_name from hl_drivers where id = new.driver_id), auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists hl_jobs_events on hl_jobs;
create trigger hl_jobs_events after insert or update on hl_jobs
  for each row execute function hl_job_event_on_change();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Called right after sign-up: creates the tenant and makes the caller its owner.
create or replace function hl_create_organization(
  p_name text, p_country char(2), p_currency char(3), p_full_name text, p_locale text default 'en'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_unit text; v_vat numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_unit := case when upper(p_country) = 'GB' then 'mi' else 'km' end;
  v_vat := case upper(p_country)
    when 'GB' then 20 when 'IE' then 23 when 'DE' then 19 when 'FR' then 20 when 'ES' then 21
    when 'IT' then 22 when 'NL' then 21 when 'BE' then 21 when 'PL' then 23 when 'PT' then 23
    when 'AT' then 20 when 'SE' then 25 when 'DK' then 25 when 'FI' then 25.5 when 'CZ' then 21
    when 'RO' then 21 when 'HU' then 27 when 'GR' then 24 when 'SK' then 23 when 'BG' then 20
    when 'HR' then 25 when 'SI' then 22 when 'LT' then 21 when 'LV' then 21 when 'EE' then 24
    when 'LU' then 17 when 'CY' then 19 when 'MT' then 18 else 20 end;
  insert into hl_organizations(name, country, currency, distance_unit, default_vat_rate, locale, email)
    values (p_name, upper(p_country), upper(p_currency), v_unit, v_vat, coalesce(p_locale,'en'),
            (select email from auth.users where id = auth.uid()))
    returning id into v_org;
  insert into hl_memberships(org_id, user_id, role, full_name) values (v_org, auth.uid(), 'owner', p_full_name);
  insert into hl_audit_logs(org_id, user_id, action, entity, entity_id)
    values (v_org, auth.uid(), 'organization.created', 'organization', v_org::text);
  return v_org;
end $$;

-- Accept an invitation (the signed-in user's email must match).
create or replace function hl_accept_invitation(p_token text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv hl_invitations; v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  select * into v_inv from hl_invitations
    where token = p_token and accepted_at is null and expires_at > now();
  if v_inv.id is null then raise exception 'invitation invalid or expired'; end if;
  if lower(v_inv.email) <> lower(v_email) then raise exception 'invitation was sent to a different email'; end if;
  insert into hl_memberships(org_id, user_id, role, full_name)
    values (v_inv.org_id, auth.uid(), v_inv.role, p_full_name)
    on conflict (org_id, user_id) do update set role = excluded.role;
  if v_inv.role = 'driver' then
    update hl_drivers set user_id = auth.uid()
      where org_id = v_inv.org_id and lower(email) = lower(v_email) and user_id is null;
    if not found then
      insert into hl_drivers(org_id, user_id, full_name, email) values (v_inv.org_id, auth.uid(), p_full_name, v_email);
    end if;
  end if;
  update hl_invitations set accepted_at = now() where id = v_inv.id;
  insert into hl_audit_logs(org_id, user_id, actor_email, action, entity, entity_id)
    values (v_inv.org_id, auth.uid(), v_email, 'invitation.accepted', 'membership', auth.uid()::text);
  return v_inv.org_id;
end $$;

-- Atomically allocate the next invoice number, e.g. INV-2026-0001
create or replace function hl_next_invoice_number(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare n integer; v_prefix text;
begin
  if not hl_is_office(p_org) then raise exception 'forbidden'; end if;
  update hl_organizations set next_invoice_number = next_invoice_number + 1
    where id = p_org returning next_invoice_number - 1, invoice_prefix into n, v_prefix;
  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end $$;

-- Public tracking page (no login) — returns only what a consignee should see.
create or replace function hl_get_tracking(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
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
    'pod_signed_by', j.pod_signed_by,
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

-- Invitation preview for the /invite/<token> page (no login needed)
create or replace function hl_get_invitation(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('email', i.email, 'role', i.role, 'org_name', o.name, 'expired', i.expires_at < now(), 'accepted', i.accepted_at is not null)
  from hl_invitations i join hl_organizations o on o.id = i.org_id
  where i.token = p_token;
$$;
grant execute on function hl_get_invitation(text) to anon, authenticated;

grant execute on function hl_get_tracking(text) to anon, authenticated;
grant execute on function hl_create_organization(text, char, char, text, text) to authenticated;
grant execute on function hl_accept_invitation(text, text) to authenticated;
grant execute on function hl_next_invoice_number(uuid) to authenticated;

-- Driver: post a GPS fix (updates latest position + history)
create or replace function hl_driver_ping(p_lat double precision, p_lng double precision,
  p_speed double precision default null, p_heading double precision default null, p_accuracy double precision default null)
returns void language plpgsql security definer set search_path = public as $$
declare d hl_drivers;
begin
  select * into d from hl_drivers where user_id = auth.uid() limit 1;
  if d.id is null then raise exception 'not a driver'; end if;
  update hl_drivers set last_lat = p_lat, last_lng = p_lng, last_speed = p_speed,
    last_heading = p_heading, last_seen_at = now() where id = d.id;
  insert into hl_driver_locations(org_id, driver_id, lat, lng, speed, heading, accuracy)
    values (d.org_id, d.id, p_lat, p_lng, p_speed, p_heading, p_accuracy);
end $$;
grant execute on function hl_driver_ping(double precision, double precision, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table hl_organizations   enable row level security;
alter table hl_memberships     enable row level security;
alter table hl_invitations     enable row level security;
alter table hl_customers       enable row level security;
alter table hl_drivers         enable row level security;
alter table hl_vehicles        enable row level security;
alter table hl_invoices        enable row level security;
alter table hl_invoice_lines   enable row level security;
alter table hl_jobs            enable row level security;
alter table hl_job_events      enable row level security;
alter table hl_driver_locations enable row level security;
alter table hl_vehicle_checks  enable row level security;
alter table hl_driver_shifts   enable row level security;
alter table hl_audit_logs      enable row level security;

-- organisations
drop policy if exists org_select on hl_organizations;
create policy org_select on hl_organizations for select using (hl_is_member(id));
drop policy if exists org_update on hl_organizations;
create policy org_update on hl_organizations for update
  using (hl_has_role(id, array['owner','admin']::hl_role[]));

-- memberships
drop policy if exists mem_select on hl_memberships;
create policy mem_select on hl_memberships for select using (hl_is_member(org_id));
drop policy if exists mem_admin on hl_memberships;
create policy mem_admin on hl_memberships for all
  using (hl_has_role(org_id, array['owner','admin']::hl_role[]))
  with check (hl_has_role(org_id, array['owner','admin']::hl_role[]));

-- invitations
drop policy if exists inv_admin on hl_invitations;
create policy inv_admin on hl_invitations for all
  using (hl_has_role(org_id, array['owner','admin']::hl_role[]))
  with check (hl_has_role(org_id, array['owner','admin']::hl_role[]));

-- generic "office staff can do everything in their org" tables
do $$
declare t text;
begin
  foreach t in array array['hl_customers','hl_vehicles','hl_invoices','hl_invoice_lines','hl_vehicle_checks','hl_driver_shifts','hl_drivers','hl_jobs','hl_job_events','hl_driver_locations']
  loop
    execute format('drop policy if exists office_all on %I', t);
    execute format('create policy office_all on %I for all using (hl_is_office(org_id)) with check (hl_is_office(org_id))', t);
  end loop;
end $$;

-- drivers: see their own record and the vehicles of their org
drop policy if exists driver_self on hl_drivers;
create policy driver_self on hl_drivers for select using (user_id = auth.uid());
drop policy if exists driver_vehicles on hl_vehicles;
create policy driver_vehicles on hl_vehicles for select using (hl_is_member(org_id));

-- drivers: read + update the jobs assigned to them
drop policy if exists driver_jobs_select on hl_jobs;
create policy driver_jobs_select on hl_jobs for select using (driver_id in (select hl_my_driver_ids()));
drop policy if exists driver_jobs_update on hl_jobs;
create policy driver_jobs_update on hl_jobs for update
  using (driver_id in (select hl_my_driver_ids()))
  with check (driver_id in (select hl_my_driver_ids()));

drop policy if exists driver_events on hl_job_events;
create policy driver_events on hl_job_events for all
  using (job_id in (select id from hl_jobs where driver_id in (select hl_my_driver_ids())))
  with check (job_id in (select id from hl_jobs where driver_id in (select hl_my_driver_ids())));

-- drivers: their own checks and shifts
drop policy if exists driver_checks on hl_vehicle_checks;
create policy driver_checks on hl_vehicle_checks for all
  using (driver_id in (select hl_my_driver_ids()))
  with check (driver_id in (select hl_my_driver_ids()) and hl_is_member(org_id));
drop policy if exists driver_shifts on hl_driver_shifts;
create policy driver_shifts on hl_driver_shifts for all
  using (driver_id in (select hl_my_driver_ids()))
  with check (driver_id in (select hl_my_driver_ids()) and hl_is_member(org_id));

-- customers: drivers may read names for their jobs
drop policy if exists driver_customers on hl_customers;
create policy driver_customers on hl_customers for select
  using (id in (select customer_id from hl_jobs where driver_id in (select hl_my_driver_ids())));

-- audit log: office read, members insert
drop policy if exists audit_select on hl_audit_logs;
create policy audit_select on hl_audit_logs for select using (hl_has_role(org_id, array['owner','admin']::hl_role[]));
drop policy if exists audit_insert on hl_audit_logs;
create policy audit_insert on hl_audit_logs for insert with check (hl_is_member(org_id));

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('hl-pod', 'hl-pod', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('hl-logos', 'hl-logos', true)
  on conflict (id) do nothing;

-- objects are stored as "<org_id>/<...>"
drop policy if exists hl_pod_rw on storage.objects;
create policy hl_pod_rw on storage.objects for all to authenticated
  using (bucket_id = 'hl-pod' and hl_is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'hl-pod' and hl_is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists hl_logos_write on storage.objects;
create policy hl_logos_write on storage.objects for all to authenticated
  using (bucket_id = 'hl-logos' and hl_has_role(((storage.foldername(name))[1])::uuid, array['owner','admin']::hl_role[]))
  with check (bucket_id = 'hl-logos' and hl_has_role(((storage.foldername(name))[1])::uuid, array['owner','admin']::hl_role[]));

-- ---------------------------------------------------------------------------
-- Realtime (live map + dispatch board)
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table hl_drivers;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table hl_jobs;
exception when others then null; end $$;
