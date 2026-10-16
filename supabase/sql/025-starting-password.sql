-- 025 — a starting password must be changed (security review, fix 3)
-- depends-on: 024
--
-- Run this ONCE, after 024. Safe to run twice.
--
-- When a Chairperson (or the Admin) makes an account, they choose its
-- starting password and pass it on — often by chat. Until the person picks
-- their own, anyone who saw that message can sign in as them.
--
-- 1. profiles.must_change_password: true for an account made by someone
--    else. The app sends that person to /change-password until it is done.
--    People cannot set or clear it themselves (they may only edit their
--    name and phone, see 004).
-- 2. mark_starting_password(target): the Chairperson of the person's co-op,
--    or the Admin, raises the flag — only on an account made in the last
--    10 minutes, so it cannot be used to annoy existing members.
-- 3. The flag goes down by itself when the password really changes (a
--    trigger on Supabase's own users table), whichever way it is changed:
--    the Account page, the forced page, or a reset link. Nobody can lower
--    it without choosing a new password.

-- 1. The flag ---------------------------------------------------------------

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- 2. Raise it, for a brand-new account -------------------------------------

create or replace function public.mark_starting_password(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin()
          or (public.my_role() = 'chairperson'
              and exists (select 1 from public.profiles
                          where id = target and coop_id = public.my_coop()))) then
    raise exception 'Only the chairperson or the admin can do that';
  end if;
  if not exists (select 1 from auth.users
                 where id = target and created_at > now() - interval '10 minutes') then
    raise exception 'Only a new account gets a starting password';
  end if;
  update public.profiles set must_change_password = true where id = target;
end $$;

revoke execute on function public.mark_starting_password(uuid) from public, anon;
grant execute on function public.mark_starting_password(uuid) to authenticated;

-- 3. Lower it when the password changes ------------------------------------

create or replace function public.password_was_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set must_change_password = false
  where id = new.id and must_change_password;
  return null;
end $$;

revoke execute on function public.password_was_changed() from public, anon, authenticated;

create or replace trigger on_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (new.encrypted_password is distinct from old.encrypted_password)
  execute function public.password_was_changed();
