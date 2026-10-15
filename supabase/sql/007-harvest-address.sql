-- 007 — where to harvest (Ticket 20)
--
-- Run this ONCE in the Supabase dashboard, after 006:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice. Adds the farm address for services that include
-- harvesting (Package Deal, Harvesting + Drying).
--
-- No security changes are needed:
-- - Customers set it only when they create their own request (the 006
--   insert guard keeps it, and still forces everything else).
-- - Afterwards nobody can change it: it is not on any role's list of
--   changeable columns in the 006 update guard.
-- - Who can SEE it follows the existing rules: the customer sees their own,
--   staff see all, signed-out visitors see nothing.

alter table public.loads add column if not exists harvest_address text;

alter table public.loads drop constraint if exists loads_harvest_address_length;
alter table public.loads add constraint loads_harvest_address_length
  check (harvest_address is null or length(harvest_address) <= 300);
