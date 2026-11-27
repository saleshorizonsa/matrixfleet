-- MatrixFleet — driver app additions (additive, safe to re-run)
-- Objects live in the isolated "matrixfleet" schema (owned by the matrixfleet login).
create schema if not exists matrixfleet;
set search_path = matrixfleet, public, extensions;


-- when the current break ended, for "continuous work since last break" guidance
alter table hl_driver_shifts add column if not exists last_break_end_at timestamptz;

-- optional photos attached to a walkaround check (paths in bucket hl-pod: "<org_id>/checks/<file>")
alter table hl_vehicle_checks add column if not exists photo_paths text[] not null default '{}';
