-- 005 — tighten the database guards (fixes from the /code-review)
--
-- Run this ONCE in the Supabase dashboard, after 004:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice. It replaces the two loads_guard trigger functions
-- from 004 with stricter versions, adds length limits, and re-asserts
-- that RLS is on and signed-out visitors get nothing.

-- 1. Who may create jobs ---------------------------------------------
--
-- Monitors and the Chairperson create walk-in jobs. Customers create their
-- own pending requests. Operators and Auditors create nothing.

create or replace function public.loads_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.can_manage() then
    return new;
  end if;

  if public.is_staff() then
    raise exception 'Your role cannot create jobs';
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

-- 2. Who may change what ---------------------------------------------

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

  -- Leaving Ready forwards (storing or releasing) needs the customer's
  -- keep / sell / split choice first, and storing needs something kept.
  -- (Going BACK from Ready, to fix a wrong tap, is still allowed.)
  if old.stage = 'Ready' and new.stage in ('Stored', 'Released') then
    if old.disposition is null then
      raise exception 'The customer must choose keep, sell or split first';
    end if;
    if new.stage = 'Stored'
       and coalesce(new.keep_percent, 0) = 0
       and new.buyout_status <> 'declined' then
      raise exception 'Nothing was kept for storage';
    end if;
  end if;

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
    -- A Monitor can only ever move a buyout from none to requested (when
    -- recording a walk-in's choice). Never approve, decline or undo one.
    if 'buyout_status' = any (changed)
       and not (old.buyout_status in ('none', 'requested') and new.buyout_status = 'requested') then
      raise exception 'Only the chairperson can approve, decline or change a buyout';
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

  -- Staff choose keep / sell / split only for walk-ins (no customer
  -- account). A customer with an account chooses for themselves.
  if r in ('monitor', 'chairperson')
     and old.customer_id is not null
     and ('disposition' = any (changed) or 'keep_percent' = any (changed)) then
    raise exception 'Only the customer can choose keep, sell or split for their own job';
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

-- (The triggers from 004 already point at these two functions, so
-- replacing the functions is enough. Re-creating them keeps this file
-- safe to run on its own.)
drop trigger if exists loads_guard_insert on public.loads;
create trigger loads_guard_insert
  before insert on public.loads
  for each row execute function public.loads_before_insert();

drop trigger if exists loads_guard_update on public.loads;
create trigger loads_guard_update
  before update on public.loads
  for each row execute function public.loads_before_update();

-- 3. Length limits -----------------------------------------------------
--
-- The app trims these too, but someone writing straight to the database
-- could otherwise store a novel in a name field.

alter table public.loads drop constraint if exists loads_customer_name_length;
alter table public.loads add constraint loads_customer_name_length
  check (length(customer_name) <= 120);

alter table public.loads drop constraint if exists loads_customer_note_length;
alter table public.loads add constraint loads_customer_note_length
  check (customer_note is null or length(customer_note) <= 1000);

alter table public.loads drop constraint if exists loads_reject_reason_length;
alter table public.loads add constraint loads_reject_reason_length
  check (reject_reason is null or length(reject_reason) <= 300);

alter table public.profiles drop constraint if exists profiles_full_name_length;
alter table public.profiles add constraint profiles_full_name_length
  check (length(full_name) <= 120);

alter table public.profiles drop constraint if exists profiles_phone_length;
alter table public.profiles add constraint profiles_phone_length
  check (length(phone) <= 30);

-- New accounts: cut over-long sign-up details to fit, rather than making
-- the sign-up itself fail.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30)
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 4. RLS stays on; signed-out visitors get nothing ----------------------

alter table public.loads    enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;

revoke all on table public.loads    from anon;
revoke all on table public.profiles from anon;
revoke all on table public.settings from anon;
