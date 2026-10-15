-- 021 — a contact number on each service request (Ticket 40)
-- depends-on: 020
--
-- Run this ONCE, after 020. Safe to run twice.
--
-- Customers now give a name and a mobile number with every request (filled
-- in from their account, and they can change it, e.g. when a relative
-- meets the harvest team). Staff see the number on Requests and the job.
--
-- Security: no new rules needed.
-- - A customer sets it only when creating their own request (the insert
--   guard keeps it, like the farm address; RLS still forces their own
--   co-op and their own account).
-- - Afterwards nobody can change it: it is on no role's list in the update
--   guard.
-- - Who can SEE it follows the job: the customer sees their own, staff of
--   the co-op see all, nobody else.

alter table public.loads add column if not exists contact_phone text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'loads_contact_phone_length') then
    alter table public.loads add constraint loads_contact_phone_length
      check (contact_phone is null or length(contact_phone) <= 20);
  end if;
end $$;
