-- 004 — Batad Multipurpose Cooperative: roles, requests, weighing,
--       keep/sell/split and buyouts (all database changes for Phase 1,
--       tickets 10–17, in one file so it only has to be run once)
--
-- Run this in the Supabase dashboard:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- It is safe to run twice. The current app keeps working afterwards: the
-- chairperson account below still sees every existing job.
--
-- BEFORE RUNNING: check the email in section 3 is the account that should
-- become the Chairperson.

-- 1. Profiles: one row per account, holding the person's role ------

create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  full_name   text        not null default '',
  phone       text        not null default '',
  role        text        not null default 'customer'
              check (role in ('customer', 'operator', 'monitor', 'chairperson', 'auditor')),
  is_member   boolean     not null default false
);

-- Small helpers the security rules use. "security definer" lets them read
-- profiles without tripping over profiles' own security rules.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() in ('operator', 'monitor', 'chairperson', 'auditor'), false) $$;

create or replace function public.can_manage() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() in ('monitor', 'chairperson'), false) $$;

alter table public.profiles enable row level security;

drop policy if exists "read own profile, staff read all" on public.profiles;
create policy "read own profile, staff read all"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.is_staff());

drop policy if exists "edit own name and phone" on public.profiles;
create policy "edit own name and phone"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level permission: people may edit ONLY their name and phone.
-- role and is_member can only change through set_person() below.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

-- Every new account gets a profile automatically, always as a customer.
-- (The role is never read from sign-up data, so nobody can sign up as staff.)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the Chairperson can change someone's role or member flag.
create or replace function public.set_person(target uuid, new_role text, new_is_member boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'chairperson' then
    raise exception 'Only the chairperson can change roles and members';
  end if;
  if target = auth.uid() and new_role <> 'chairperson' then
    raise exception 'You cannot remove your own chairperson role';
  end if;
  update public.profiles set role = new_role, is_member = new_is_member where id = target;
end $$;

revoke execute on function public.set_person(uuid, text, boolean) from public, anon;
grant execute on function public.set_person(uuid, text, boolean) to authenticated;

-- 2. Settings: one row for the co-op -------------------------------

create table if not exists public.settings (
  id                     integer       primary key default 1 check (id = 1),
  coop_name              text          not null default 'Batad Multipurpose Cooperative',
  farmgate_price_per_kg  numeric(10, 2) not null default 0 check (farmgate_price_per_kg >= 0),
  rice_lifeline_days     integer       not null default 30 check (rice_lifeline_days > 0),
  palay_lifeline_days    integer       not null default 90 check (palay_lifeline_days > 0),
  warning_days           integer       not null default 14 check (warning_days >= 0)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "signed-in users read settings" on public.settings;
create policy "signed-in users read settings"
  on public.settings for select
  to authenticated
  using (true);

drop policy if exists "chairperson edits settings" on public.settings;
create policy "chairperson edits settings"
  on public.settings for update
  to authenticated
  using (public.my_role() = 'chairperson')
  with check (public.my_role() = 'chairperson');

revoke all on table public.settings from anon, authenticated;
grant select, update on table public.settings to authenticated;

-- 3. Existing accounts get profiles; set the first Chairperson ------

insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

update public.profiles
set role = 'chairperson',
    full_name = case when full_name = '' then 'Chairperson' else full_name end
where id = (select id from auth.users where email = 'beldadjo@gmail.com');

-- 4. New columns on loads ------------------------------------------

alter table public.loads
  add column if not exists customer_id    uuid references public.profiles (id) on delete set null,
  add column if not exists request_status text not null default 'accepted',
  add column if not exists reject_reason  text,
  add column if not exists preferred_date date,
  add column if not exists customer_note  text,
  add column if not exists output_kg      numeric(10, 2),
  add column if not exists disposition    text,
  add column if not exists keep_percent   integer,
  add column if not exists buyout_status  text not null default 'none',
  add column if not exists price_per_kg   numeric(12, 2),
  add column if not exists payout_done_at timestamptz;

-- Customers do not know the price when they ask; staff set it on accepting.
alter table public.loads alter column agreed_price set default 0;

create index if not exists loads_customer_id_idx on public.loads (customer_id);

alter table public.loads drop constraint if exists loads_request_status_check;
alter table public.loads add constraint loads_request_status_check
  check (request_status in ('pending', 'accepted', 'rejected'));

alter table public.loads drop constraint if exists loads_output_kg_check;
alter table public.loads add constraint loads_output_kg_check
  check (output_kg is null or output_kg >= 0);

-- keep = keep 100%, sell = keep 0%, split = keep 1–99%.
alter table public.loads drop constraint if exists loads_disposition_check;
alter table public.loads add constraint loads_disposition_check check (
  (disposition is null and keep_percent is null)
  or (disposition = 'keep' and keep_percent = 100)
  or (disposition = 'sell' and keep_percent = 0)
  or (disposition = 'split' and keep_percent between 1 and 99)
);

-- A buyout exists exactly when the customer chose to sell some grain.
alter table public.loads drop constraint if exists loads_buyout_status_check;
alter table public.loads add constraint loads_buyout_status_check check (
  buyout_status in ('none', 'requested', 'approved', 'declined')
  and (buyout_status = 'none') = (coalesce(disposition, 'keep') = 'keep')
);

alter table public.loads drop constraint if exists loads_price_per_kg_check;
alter table public.loads add constraint loads_price_per_kg_check
  check (price_per_kg is null or price_per_kg >= 0);

alter table public.loads drop constraint if exists loads_payout_check;
alter table public.loads add constraint loads_payout_check
  check (payout_done_at is null or buyout_status = 'approved');

-- 5. New security rules for loads ----------------------------------
--
-- Before: each Monitor saw only rows they created.
-- Now: staff (operator, monitor, chairperson, auditor) see every job;
-- a customer sees only jobs where they are the customer.

drop policy if exists "monitors can read their own loads"   on public.loads;
drop policy if exists "monitors can add their own loads"    on public.loads;
drop policy if exists "monitors can update their own loads" on public.loads;
drop policy if exists "monitors can delete their own loads" on public.loads;

drop policy if exists "staff read all, customers their own" on public.loads;
create policy "staff read all, customers their own"
  on public.loads for select
  to authenticated
  using (public.is_staff() or customer_id = (select auth.uid()));

drop policy if exists "managers add jobs, customers add requests" on public.loads;
create policy "managers add jobs, customers add requests"
  on public.loads for insert
  to authenticated
  with check (
    public.can_manage()
    or (customer_id = (select auth.uid()) and request_status = 'pending')
  );

drop policy if exists "workers and the owning customer update" on public.loads;
create policy "workers and the owning customer update"
  on public.loads for update
  to authenticated
  using (
    public.my_role() in ('operator', 'monitor', 'chairperson')
    or customer_id = (select auth.uid())
  )
  with check (
    public.my_role() in ('operator', 'monitor', 'chairperson')
    or customer_id = (select auth.uid())
  );

drop policy if exists "managers delete" on public.loads;
create policy "managers delete"
  on public.loads for delete
  to authenticated
  using (public.can_manage());

-- Signed-out visitors get nothing at all now.
revoke all on table public.loads from anon;
grant select, insert, update, delete on table public.loads to authenticated;

-- 6. Which columns each role may change ----------------------------
--
-- RLS decides WHICH rows someone may touch. These triggers decide WHAT
-- they may change in them, so an Operator cannot mark a job paid even by
-- calling the database directly. (Changes made in the Supabase dashboard
-- itself have no signed-in user and are not checked.)

create or replace function public.loads_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.can_manage() then
    return new;
  end if;

  -- Everyone else is a customer asking for a service: force a clean,
  -- pending request that belongs to them.
  new.customer_id    := auth.uid();
  new.request_status := 'pending';
  new.stage := case new.service_type
                 when 'Package Deal'        then 'Harvesting'
                 when 'Harvesting + Drying' then 'Harvesting'
                 else 'Received'
               end;
  new.agreed_price   := 0;
  new.is_paid        := false;
  new.amount_paid    := null;
  new.stored_at      := null;
  new.reject_reason  := null;
  new.output_kg      := null;
  new.disposition    := null;
  new.keep_percent   := null;
  new.buyout_status  := 'none';
  new.price_per_kg   := null;
  new.payout_done_at := null;
  return new;
end $$;

create or replace function public.loads_before_update() returns trigger
language plpgsql set search_path = public as $$
declare
  r        text := public.my_role();
  changed  text[];
  allowed  text[];
  refused  text[];
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Which columns are actually different?
  select coalesce(array_agg(n.key), '{}') into changed
  from jsonb_each(to_jsonb(new)) as n
  where n.value is distinct from (to_jsonb(old) -> n.key);

  if r = 'chairperson' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                     'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
                     'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                     'buyout_status', 'price_per_kg', 'payout_done_at'];
  elsif r = 'monitor' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                     'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
                     'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                     'buyout_status'];
    if new.buyout_status in ('approved', 'declined')
       and new.buyout_status is distinct from old.buyout_status then
      raise exception 'Only the chairperson can approve or decline a buyout';
    end if;
  elsif r = 'operator' then
    allowed := array['stage', 'stored_at', 'output_kg'];
  elsif old.customer_id = auth.uid() then
    -- A customer makes one choice, on their own accepted, weighed, Ready job.
    if old.request_status <> 'accepted' or old.stage <> 'Ready'
       or old.output_kg is null or old.disposition is not null then
      raise exception 'You can choose keep, sell or split once, after your batch is weighed';
    end if;
    if new.buyout_status not in ('none', 'requested') then
      raise exception 'Only the chairperson can approve or decline a buyout';
    end if;
    allowed := array['disposition', 'keep_percent', 'buyout_status'];
  else
    raise exception 'Your role cannot change jobs';
  end if;

  select coalesce(array_agg(c), '{}') into refused
  from unnest(changed) as c
  where c <> all (allowed);

  if array_length(refused, 1) > 0 then
    raise exception 'Your role (%) cannot change: %',
      coalesce(r, 'none'), array_to_string(refused, ', ');
  end if;

  return new;
end $$;

drop trigger if exists loads_guard_insert on public.loads;
create trigger loads_guard_insert
  before insert on public.loads
  for each row execute function public.loads_before_insert();

drop trigger if exists loads_guard_update on public.loads;
create trigger loads_guard_update
  before update on public.loads
  for each row execute function public.loads_before_update();

-- 7. Check it worked ------------------------------------------------
--
-- Table Editor: profiles, settings and loads must show no "RLS disabled"
-- warning. Table Editor -> profiles: your account's role is 'chairperson'.
