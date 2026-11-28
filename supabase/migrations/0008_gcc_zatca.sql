-- MatrixFleet — GCC countries and Saudi e-invoicing (ZATCA Phase 2). Run as supabase_admin.
-- Additive only: existing UK/EU companies are unaffected.
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;

-- 1. Money with 3 decimals (KWD, BHD, OMR). numeric(14,3) holds every 2-decimal value unchanged.
alter table hl_invoices
  alter column subtotal type numeric(14,3),
  alter column vat_amount type numeric(14,3),
  alter column total type numeric(14,3);
alter table hl_invoice_lines
  alter column unit_price type numeric(14,3),
  alter column amount type numeric(14,3);

-- 2. Address and identity fields used by GCC invoices (Saudi "National Address").
alter table hl_organizations
  add column if not exists legal_name_ar text,
  add column if not exists building_number text,
  add column if not exists district text,
  add column if not exists additional_number text;

alter table hl_customers
  add column if not exists name_ar text,
  add column if not exists building_number text,
  add column if not exists district text,
  add column if not exists additional_number text,
  -- buyer identification when there is no VAT number (ZATCA scheme: CRN, MOM, MLS, 700, SAG, NAT, GCC, IQA, PAS, OTH)
  add column if not exists id_scheme text,
  add column if not exists id_value text;

alter table hl_customers drop constraint if exists hl_customers_id_scheme_chk;
alter table hl_customers add constraint hl_customers_id_scheme_chk
  check (id_scheme is null or id_scheme in ('CRN','MOM','MLS','700','SAG','NAT','GCC','IQA','PAS','OTH'));

-- 3. Credit notes + e-invoicing state on invoices.
alter table hl_invoices
  add column if not exists doc_type text not null default 'invoice',
  add column if not exists original_invoice_id uuid references hl_invoices(id) on delete set null,
  add column if not exists adjustment_reason text,
  add column if not exists zatca_kind text,            -- standard (B2B, clearance) | simplified (B2C, reporting)
  add column if not exists zatca_status text,          -- pending | cleared | reported | warning | rejected | failed
  add column if not exists zatca_uuid uuid,
  add column if not exists zatca_icv bigint,
  add column if not exists zatca_hash text,
  add column if not exists zatca_pih text,
  add column if not exists zatca_qr text,
  add column if not exists zatca_xml text,             -- signed (simplified) or ZATCA-cleared (standard) XML
  add column if not exists zatca_messages jsonb,
  add column if not exists zatca_env text,
  add column if not exists zatca_issued_at timestamptz,
  add column if not exists zatca_submitted_at timestamptz;

alter table hl_invoices drop constraint if exists hl_invoices_doc_type_chk;
alter table hl_invoices add constraint hl_invoices_doc_type_chk check (doc_type in ('invoice','credit_note','debit_note'));
alter table hl_invoices drop constraint if exists hl_invoices_zatca_chk;
alter table hl_invoices add constraint hl_invoices_zatca_chk check (
  (zatca_kind is null or zatca_kind in ('standard','simplified')) and
  (zatca_status is null or zatca_status in ('pending','cleared','reported','warning','rejected','failed'))
);
create index if not exists hl_invoices_zatca_pending_idx on hl_invoices(zatca_status) where zatca_status in ('pending','failed');

-- Signed-in users can never write e-invoicing fields or change a submitted invoice;
-- only the server (service role) does that after talking to ZATCA.
create or replace function hl_guard_invoice_zatca() returns trigger
language plpgsql set search_path = matrixfleet, public, extensions as $$
begin
  if not hl_caller_is_user() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.zatca_status is not null then raise exception 'e-invoice cannot be deleted' using errcode = '42501'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.zatca_status is not null or new.zatca_uuid is not null or new.zatca_icv is not null or new.zatca_hash is not null
       or new.zatca_xml is not null or new.zatca_qr is not null then
      raise exception 'e-invoicing fields are server-managed' using errcode = '42501';
    end if;
    return new;
  end if;
  -- UPDATE
  if (new.zatca_kind, new.zatca_status, new.zatca_uuid, new.zatca_icv, new.zatca_hash, new.zatca_pih, new.zatca_qr,
      new.zatca_xml, new.zatca_messages, new.zatca_env, new.zatca_issued_at, new.zatca_submitted_at)
     is distinct from
     (old.zatca_kind, old.zatca_status, old.zatca_uuid, old.zatca_icv, old.zatca_hash, old.zatca_pih, old.zatca_qr,
      old.zatca_xml, old.zatca_messages, old.zatca_env, old.zatca_issued_at, old.zatca_submitted_at) then
    raise exception 'e-invoicing fields are server-managed' using errcode = '42501';
  end if;
  if old.zatca_status in ('pending','cleared','reported','warning') then
    -- a submitted e-invoice is final: only payment status may change (corrections need a credit note)
    if new.status not in ('sent','paid','overdue') or old.status = 'void'
       or (new.subtotal, new.vat_amount, new.total, new.vat_rate, new.vat_treatment, new.currency, new.number,
           new.issue_date, new.customer_id, new.buyer_snapshot, new.seller_snapshot, new.doc_type)
          is distinct from
          (old.subtotal, old.vat_amount, old.total, old.vat_rate, old.vat_treatment, old.currency, old.number,
           old.issue_date, old.customer_id, old.buyer_snapshot, old.seller_snapshot, old.doc_type) then
      raise exception 'submitted e-invoice is final — issue a credit note instead' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists hl_guard_invoice_zatca on hl_invoices;
create trigger hl_guard_invoice_zatca before insert or update or delete on hl_invoices
  for each row execute function hl_guard_invoice_zatca();

-- lines of a submitted e-invoice are final too
create or replace function hl_guard_invoice_lines_zatca() returns trigger
language plpgsql set search_path = matrixfleet, public, extensions as $$
declare v_status text;
begin
  if not hl_caller_is_user() then return coalesce(new, old); end if;
  select zatca_status into v_status from hl_invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status in ('pending','cleared','reported','warning') then
    raise exception 'submitted e-invoice is final' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists hl_guard_invoice_lines_zatca on hl_invoice_lines;
create trigger hl_guard_invoice_lines_zatca before insert or update or delete on hl_invoice_lines
  for each row execute function hl_guard_invoice_lines_zatca();

-- 4. ZATCA e-invoicing unit (EGS) per company. Holds the encrypted signing key and ZATCA credentials:
--    RLS on with NO policies, so only the server (service role) can read or write it.
create table if not exists hl_zatca_units (
  org_id uuid primary key references hl_organizations(id) on delete cascade,
  environment text not null default 'sandbox' check (environment in ('sandbox','simulation','production')),
  status text not null default 'not_started' check (status in ('not_started','compliance','active','failed')),
  egs_serial text not null,                 -- 1-MatrixFleet|2-<version>|3-<uuid>
  common_name text not null,
  org_unit text not null,
  invoice_types text not null default '1100',
  location text,
  industry text not null default 'Transportation',
  private_key_enc text,                     -- AES-256-GCM (ZATCA_ENCRYPTION_KEY)
  csr text,
  compliance_token text,                    -- binarySecurityToken (public certificate)
  compliance_secret_enc text,
  compliance_request_id text,
  production_token text,
  production_secret_enc text,
  certificate_expires_at timestamptz,
  checks jsonb,                             -- results of the 6 compliance documents
  icv bigint not null default 0,            -- invoice counter value of the last e-invoice
  last_hash text not null default 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
  pending_icv bigint,                       -- reservation while an invoice is being signed
  pending_since timestamptz,
  last_error text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table hl_zatca_units enable row level security;
revoke all on hl_zatca_units from anon, authenticated;
grant all on hl_zatca_units to service_role;

-- Reserve the next counter value and the previous invoice hash. One invoice at a time per company,
-- so the hash chain stays unbroken; a stale reservation (crash) is released after 2 minutes.
create or replace function hl_zatca_reserve(p_org uuid)
returns table(icv bigint, pih text)
language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
declare u hl_zatca_units;
begin
  select * into u from hl_zatca_units where org_id = p_org for update;
  if not found then raise exception 'zatca_not_onboarded'; end if;
  if u.pending_icv is not null and u.pending_since > now() - interval '2 minutes' then
    raise exception 'zatca_busy';
  end if;
  update hl_zatca_units set pending_icv = u.icv + 1, pending_since = now(), updated_at = now() where org_id = p_org;
  return query select u.icv + 1, u.last_hash;
end $$;

-- Commit the signed invoice into the chain (even if ZATCA later rejects it, it stays in the chain).
create or replace function hl_zatca_commit(p_org uuid, p_icv bigint, p_hash text)
returns void
language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
begin
  update hl_zatca_units
     set icv = p_icv, last_hash = p_hash, pending_icv = null, pending_since = null, updated_at = now()
   where org_id = p_org and pending_icv = p_icv;
  if not found then raise exception 'zatca_chain_conflict'; end if;
end $$;

-- Release a reservation when signing failed before anything was stored.
create or replace function hl_zatca_release(p_org uuid, p_icv bigint)
returns void
language plpgsql security definer set search_path = matrixfleet, public, extensions as $$
begin
  update hl_zatca_units set pending_icv = null, pending_since = null, updated_at = now()
   where org_id = p_org and pending_icv = p_icv;
end $$;

revoke all on function hl_zatca_reserve(uuid) from public, anon, authenticated;
revoke all on function hl_zatca_commit(uuid, bigint, text) from public, anon, authenticated;
revoke all on function hl_zatca_release(uuid, bigint) from public, anon, authenticated;
grant execute on function hl_zatca_reserve(uuid) to service_role;
grant execute on function hl_zatca_commit(uuid, bigint, text) to service_role;
grant execute on function hl_zatca_release(uuid, bigint) to service_role;

alter table hl_zatca_units owner to matrixfleet;
alter function hl_zatca_reserve(uuid) owner to postgres;
alter function hl_zatca_commit(uuid, bigint, text) owner to postgres;
alter function hl_zatca_release(uuid, bigint) owner to postgres;
alter function hl_guard_invoice_zatca() owner to postgres;
alter function hl_guard_invoice_lines_zatca() owner to postgres;
