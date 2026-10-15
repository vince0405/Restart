-- 024 — more security hardening (Ticket 44)
-- depends-on: 023
--
-- Run this ONCE, after 023. Safe to run twice.
--
-- 1. Signed-out visitors can no longer call the "who am I?" helpers
--    (my_role, is_staff, can_manage) or first_stage. They only ever
--    answered "nobody", but there is no reason to expose them. Signed-in
--    people (whose security rules use them) keep them.
-- 2. People can still edit their own name and mobile number (the 004
--    grant), but now only to sensible values: a name that isn't blank, and
--    a Philippine mobile number in the standard form (+639XXXXXXXXX) or
--    none. Checked only when those fields change, so the 4 older numbers in
--    another format keep working until someone edits them.

-- 1. Helpers: signed-in only ------------------------------------------------

revoke execute on function public.my_role() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.can_manage() from public, anon;
revoke execute on function public.first_stage(text) from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.can_manage() to authenticated;
grant execute on function public.first_stage(text) to authenticated;

-- 2. Own profile edits: sensible values only --------------------------------

create or replace function public.profiles_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.full_name is distinct from old.full_name then
    new.full_name := trim(new.full_name);
    if new.full_name = '' then
      raise exception 'A name cannot be blank';
    end if;
  end if;
  if new.phone is distinct from old.phone then
    new.phone := trim(new.phone);
    if new.phone <> '' and new.phone !~ '^\+639[0-9]{9}$' then
      raise exception 'Enter a Philippine mobile number like +639171234567';
    end if;
  end if;
  return new;
end $$;

create or replace trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();
