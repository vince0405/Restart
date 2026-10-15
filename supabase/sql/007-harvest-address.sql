-- 007 — where to harvest (Ticket 20) and sign-in by mobile number (Ticket 21)
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

-- ---------------------------------------------------------------------------
-- Ticket 21: sign in with a mobile number + password; email optional.
--
-- New accounts sign in with an internal name made from their mobile number
-- (e.g. 639171234567@phone.rps1.invalid — ".invalid" can never be a real
-- address). Their real email, if they give one, is kept here for contact
-- only. People can see their own; staff can see everyone's (the existing
-- profiles rules), and nobody else.

alter table public.profiles add column if not exists contact_email text;

alter table public.profiles drop constraint if exists profiles_contact_email_length;
alter table public.profiles add constraint profiles_contact_email_length
  check (contact_email is null or length(contact_email) <= 254);

-- New accounts: copy name, phone and the optional contact email from the
-- sign-up details (trimmed to fit). The role is still never read from them.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, contact_email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'contact_email', ''), 254), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
