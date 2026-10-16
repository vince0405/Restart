-- 026 — choosing a cooperative is optional at sign-up
-- depends-on: 025
--
-- Run this ONCE, after 025. Safe to run twice.
--
-- Sign-up no longer requires a co-op. Someone who skips it signs in to the
-- "not linked to a cooperative" page (/no-coop), which now lets them pick
-- one: the same choice the sign-up form offers, nothing more:
--
-- join_cooperative(coop): only for the signed-in person's OWN account, only
-- while it has no co-op yet, only as a Customer, and only a co-op that
-- exists (never the Admin, who has no co-op on purpose). Once chosen, it
-- cannot be changed this way.

create or replace function public.join_cooperative(coop uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    raise exception 'Only a customer account can choose a cooperative';
  end if;
  if not exists (select 1 from public.cooperatives where id = coop) then
    raise exception 'No such cooperative';
  end if;
  update public.profiles set coop_id = coop
  where id = auth.uid() and coop_id is null and role = 'customer';
  if not found then
    raise exception 'Your account already has a cooperative';
  end if;
end $$;

revoke execute on function public.join_cooperative(uuid) from public, anon;
grant execute on function public.join_cooperative(uuid) to authenticated;
