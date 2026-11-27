-- Haulora — settings / billing hardening
-- Owners/admins may update their organisation row (RLS org_update), but billing
-- columns must only ever be changed by the service role (Stripe webhook).

create or replace function hl_protect_billing_columns() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), auth.role()) is distinct from 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.trial_ends_at := old.trial_ends_at;
    new.current_period_end := old.current_period_end;
    new.next_invoice_number := case when new.next_invoice_number < old.next_invoice_number
                                    then old.next_invoice_number else new.next_invoice_number end;
  end if;
  return new;
end $$;

drop trigger if exists hl_org_protect_billing on hl_organizations;
create trigger hl_org_protect_billing before update on hl_organizations
  for each row execute function hl_protect_billing_columns();

-- Members can leave / owners can see who else is owner: count owners helper
create or replace function hl_owner_count(p_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from hl_memberships where org_id = p_org and role = 'owner';
$$;
grant execute on function hl_owner_count(uuid) to authenticated;
