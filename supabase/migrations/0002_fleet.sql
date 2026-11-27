-- MatrixFleet — fleet module additions
-- Dispatchers may invite drivers (but not office staff) to the driver app.
-- Objects live in the isolated "matrixfleet" schema (owned by the matrixfleet login).
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;

drop policy if exists inv_dispatcher_drivers on hl_invitations;
create policy inv_dispatcher_drivers on hl_invitations for all
  using (role = 'driver' and hl_has_role(org_id, array['dispatcher']::hl_role[]))
  with check (role = 'driver' and hl_has_role(org_id, array['dispatcher']::hl_role[]));
