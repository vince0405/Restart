-- 013 — a history of market prices (Ticket 28)
-- depends-on: 004 (settings, my_role)
--
-- Run this ONCE in the Supabase dashboard, after 012:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice. Every time the farmgate reference price in Settings
-- changes, the new price is written here with the date and who set it.
--
-- Security:
-- - Only the trigger below writes to price_history. It runs as the
--   table's owner (security definer), so no role gets permission to
--   insert, update or delete rows itself. And only the Chairperson can
--   change settings (004), so only the Chairperson adds prices.
-- - Staff and the Auditor can read it; customers cannot.

-- 1. The table ------------------------------------------------------------

create table if not exists public.price_history (
  id           bigint        generated always as identity primary key,
  price_per_kg numeric(10, 2) not null check (price_per_kg >= 0),
  set_at       timestamptz   not null default now(),
  set_by       uuid          -- empty = the starting price, or set from the dashboard
);

create index if not exists price_history_time_idx on public.price_history (set_at desc);

alter table public.price_history enable row level security;

-- Only created if missing, so running the file twice needs no drop.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'price_history'
      and policyname = 'staff and auditor read prices'
  ) then
    create policy "staff and auditor read prices"
      on public.price_history for select
      to authenticated
      using (public.my_role() in ('operator', 'monitor', 'chairperson', 'auditor'));
  end if;
end $$;

revoke all on table public.price_history from anon, authenticated;
grant select on table public.price_history to authenticated;

-- 2. The starting price: today's price, so the list is never empty ---------

insert into public.price_history (price_per_kg)
select farmgate_price_per_kg from public.settings
where id = 1 and not exists (select 1 from public.price_history);

-- 3. The trigger: a new line whenever the reference price changes ----------

create or replace function public.record_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.farmgate_price_per_kg is distinct from old.farmgate_price_per_kg then
    insert into public.price_history (price_per_kg, set_by)
    values (new.farmgate_price_per_kg, auth.uid());
  end if;
  return null;
end $$;

create or replace trigger price_history
  after update on public.settings
  for each row execute function public.record_price();
