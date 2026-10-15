-- 019 — the co-op's own rice and palay supply (Ticket 37)
-- depends-on: 018
--
-- Run this ONCE, after 018. Safe to run twice.
--
-- The co-op's supply = grain it bought in approved buyouts + palay kept as
-- harvest shares (both worked out from the jobs) + what staff add or take
-- out by hand here. A warning shows when it drops below the co-op's
-- low-supply level (set by the Chairperson in Settings).
--
-- Security:
-- - supply_entries: RLS on. Staff of the co-op read; Operators, Monitors and
--   the Chairperson add entries. Nobody edits or deletes one: a mistake is
--   fixed with an opposite entry, so the record stays honest.
-- - coop_id comes from the database (my_coop()), and who / when are set by
--   the trigger below, never by the form.
-- - Every entry is in the history of changes.

-- 1. The table ------------------------------------------------------------

create table if not exists public.supply_entries (
  id          uuid          primary key default gen_random_uuid(),
  coop_id     uuid          not null default public.my_coop() references public.cooperatives (id),
  product     text          not null check (product in ('rice', 'palay')),
  kg          numeric(12, 2) not null check (kg <> 0 and abs(kg) <= 1000000),
  note        text          check (note is null or length(note) <= 200),
  recorded_by uuid,
  created_at  timestamptz   not null default now()
);

create index if not exists supply_entries_coop_idx on public.supply_entries (coop_id, created_at desc);

alter table public.supply_entries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'supply_entries' and policyname = 'staff read their supply') then
    create policy "staff read their supply"
      on public.supply_entries for select
      to authenticated
      using (public.is_staff() and coop_id = public.my_coop());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'supply_entries' and policyname = 'workers add supply') then
    create policy "workers add supply"
      on public.supply_entries for insert
      to authenticated
      with check (public.my_role() in ('operator', 'monitor', 'chairperson')
                  and coop_id = public.my_coop());
  end if;
end $$;

revoke all on table public.supply_entries from anon, authenticated;
grant select, insert on table public.supply_entries to authenticated;

-- Who and when come from the database.
create or replace function public.supply_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
    new.created_at  := now();
  end if;
  return new;
end $$;

create or replace trigger supply_guard_insert
  before insert on public.supply_entries
  for each row execute function public.supply_before_insert();

create or replace trigger zz_audit
  after insert or update or delete on public.supply_entries
  for each row execute function public.audit_row();

-- 2. Low-supply levels per co-op --------------------------------------------

alter table public.cooperatives
  add column if not exists low_rice_kg  numeric(12, 2) not null default 100,
  add column if not exists low_palay_kg numeric(12, 2) not null default 500;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cooperatives_low_supply_check') then
    alter table public.cooperatives add constraint cooperatives_low_supply_check
      check (low_rice_kg >= 0 and low_palay_kg >= 0);
  end if;
end $$;

-- The Chairperson sets them (same rule as the other settings, 018).
grant update (low_rice_kg, low_palay_kg) on public.cooperatives to authenticated;
