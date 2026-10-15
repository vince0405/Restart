-- 003 — four services, each with its own steps (Ticket 06)
--
-- Run this in the Supabase dashboard:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- It changes the existing `loads` table. Row Level Security and its
-- policies from 002 stay exactly as they are.
--
-- The steps of each service:
--   Package Deal         Harvesting -> Drying -> Milling -> Ready -> Released
--   Harvesting + Drying  Harvesting -> Drying -> Ready -> Released
--   Drying only          Received -> Drying -> Ready -> Released
--   Milling only         Received -> Milling -> Ready -> Released
-- (Stored is added now so Ticket 07 needs no database change.)

-- 1. Remove the old rules so existing rows can be moved -------------

alter table loads drop constraint if exists loads_service_type_check;
alter table loads drop constraint if exists loads_stage_check;
alter table loads drop constraint if exists loads_stored_at_check;

-- The app now always says which step a load starts at, because it
-- depends on the service.
alter table loads alter column stage drop default;

-- 2. Remember when a load was stored (used by Ticket 07) ------------

alter table loads add column if not exists stored_at timestamptz;

-- 3. Move any existing loads to the nearest new step ----------------
--
-- Old steps were Received, Drying, Dried, Milling, Milled, Released.

update loads set stage = case
  when stage = 'Released' then 'Released'
  when stage = 'Milled' then 'Ready'
  when stage = 'Dried' and service_type = 'Package Deal' then 'Milling'
  when stage = 'Dried' then 'Ready'
  when stage = 'Received' and service_type = 'Package Deal' then 'Harvesting'
  when stage = 'Milling' and service_type = 'Drying only' then 'Ready'
  when stage = 'Drying' and service_type = 'Milling only' then 'Received'
  else stage
end;

-- 4. The new rules --------------------------------------------------

alter table loads add constraint loads_service_type_check
  check (service_type in ('Package Deal', 'Harvesting + Drying', 'Drying only', 'Milling only'));

-- A load may only be at a step its service actually has.
alter table loads add constraint loads_stage_check check (
  (service_type = 'Package Deal'
    and stage in ('Harvesting', 'Drying', 'Milling', 'Ready', 'Stored', 'Released'))
  or (service_type = 'Harvesting + Drying'
    and stage in ('Harvesting', 'Drying', 'Ready', 'Stored', 'Released'))
  or (service_type = 'Drying only'
    and stage in ('Received', 'Drying', 'Ready', 'Stored', 'Released'))
  or (service_type = 'Milling only'
    and stage in ('Received', 'Milling', 'Ready', 'Stored', 'Released'))
);

-- A stored load must say when it was stored.
alter table loads add constraint loads_stored_at_check
  check (stage <> 'Stored' or stored_at is not null);
