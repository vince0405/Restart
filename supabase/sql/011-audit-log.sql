-- 011 — history of changes: the audit log (Ticket 26)
-- depends-on: 004 (my_role), 010
--
-- Run this ONCE in the Supabase dashboard, after 010:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice. Every new, changed or deleted job, person (profile)
-- and settings row writes one line here: who, when, and each column's
-- value before and after.
--
-- Security:
-- - Only the triggers below write to audit_log. They run as the table's
--   owner (security definer), so no role needs — or gets — permission to
--   insert, update or delete rows itself. The log cannot be edited.
-- - Only the Chairperson and the Auditor can read it.
-- - Starts from today: changes made before 011 are not in it.

-- 1. The table ------------------------------------------------------------

create table if not exists public.audit_log (
  id          bigint      generated always as identity primary key,
  table_name  text        not null,
  row_id      text        not null,
  action      text        not null check (action in ('insert', 'update', 'delete')),
  changed_by  uuid,       -- empty = changed from the Supabase dashboard
  changed_at  timestamptz not null default now(),
  -- { "column": { "from": old value, "to": new value }, ... }
  changes     jsonb       not null default '{}'
);

create index if not exists audit_log_row_idx  on public.audit_log (table_name, row_id, changed_at desc);
create index if not exists audit_log_time_idx on public.audit_log (changed_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "chairperson and auditor read the log" on public.audit_log;
create policy "chairperson and auditor read the log"
  on public.audit_log for select
  to authenticated
  using (public.my_role() in ('chairperson', 'auditor'));

revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

-- 2. The trigger function -------------------------------------------------

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o    jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n    jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  diff jsonb;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('from', o -> k, 'to', n -> k)), '{}')
    into diff
  from (
    select jsonb_object_keys(coalesce(n, o)) as k
  ) keys
  where (o -> k) is distinct from (n -> k)
    and k <> 'id';

  -- An update that changed nothing is not worth a line.
  if tg_op = 'UPDATE' and diff = '{}' then
    return null;
  end if;

  insert into public.audit_log (table_name, row_id, action, changed_by, changes)
  values (tg_table_name, coalesce(n, o) ->> 'id', lower(tg_op), auth.uid(), diff);
  return null;
end $$;

-- (A trigger function cannot be called directly, only by the triggers.)

-- 3. The triggers (AFTER, so they record the final values) ----------------

drop trigger if exists zz_audit on public.loads;
create trigger zz_audit
  after insert or update or delete on public.loads
  for each row execute function public.audit_row();

drop trigger if exists zz_audit on public.profiles;
create trigger zz_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row();

drop trigger if exists zz_audit on public.settings;
create trigger zz_audit
  after insert or update or delete on public.settings
  for each row execute function public.audit_row();
