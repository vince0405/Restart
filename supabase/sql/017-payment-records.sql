-- 017 — payment records and receipts (Ticket 31)
-- depends-on: 016
--
-- Run this ONCE, after 016. Safe to run twice.
--
-- A job can have several payments, each with an amount, a date, a method
-- (cash, GCash, Maya, bank) and a reference number. The amount owed is the
-- fee minus all payments. The database keeps loads.amount_paid and
-- loads.is_paid equal to the payments' total, so every screen and rule
-- that used them keeps working.
--
-- The Chairperson can mark a member as "pay later" (trusted): their job
-- may be released while it still owes money.
--
-- Security:
-- - payments: RLS on. Monitors and the Chairperson record and delete
--   payments (to fix a mistake); staff and the Auditor read all; a
--   customer reads only the payments on their own jobs. Nobody edits one.
--   Who recorded it and when come from the database, not the form.
-- - loads.is_paid / amount_paid are now on no role's list: only the
--   payments trigger sets them.
-- - profiles.pay_later: only the Chairperson, through set_pay_later().
-- - Every payment, and every change to pay_later, is in the history.

-- 1. The table ------------------------------------------------------------

create table if not exists public.payments (
  id          uuid          primary key default gen_random_uuid(),
  load_id     uuid          not null references public.loads (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  paid_on     date          not null default ((now() at time zone 'Asia/Manila')::date),
  method      text          not null default 'cash'
                            check (method in ('cash', 'gcash', 'maya', 'bank')),
  reference   text          check (reference is null or length(reference) <= 100),
  recorded_by uuid,
  created_at  timestamptz   not null default now()
);

create index if not exists payments_load_idx on public.payments (load_id);

alter table public.payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'payments' and policyname = 'staff read payments, customers their own') then
    create policy "staff read payments, customers their own"
      on public.payments for select
      to authenticated
      using (public.is_staff()
             or exists (select 1 from public.loads l
                        where l.id = load_id and l.customer_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'payments' and policyname = 'managers record payments') then
    create policy "managers record payments"
      on public.payments for insert
      to authenticated
      with check (public.can_manage());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'payments' and policyname = 'managers delete payments') then
    create policy "managers delete payments"
      on public.payments for delete
      to authenticated
      using (public.can_manage());
  end if;
end $$;

revoke all on table public.payments from anon, authenticated;
grant select, insert, delete on table public.payments to authenticated;

-- Who and when come from the database; only accepted jobs take payments.
create or replace function public.payments_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- the dashboard, or the move of old amounts below
  end if;
  new.recorded_by := auth.uid();
  new.created_at  := now();
  if not exists (select 1 from public.loads l
                 where l.id = new.load_id and l.request_status = 'accepted') then
    raise exception 'Payments can only be recorded on accepted jobs';
  end if;
  return new;
end $$;

create or replace trigger payments_guard_insert
  before insert on public.payments
  for each row execute function public.payments_before_insert();

-- 2. Keep the job's paid total equal to its payments ----------------------

create or replace function public.sync_load_payments() returns trigger
language plpgsql set search_path = public as $$
declare
  job   uuid := coalesce(new.load_id, old.load_id);
  total numeric;
begin
  select coalesce(sum(amount), 0) into total from public.payments where load_id = job;
  update public.loads
  set amount_paid = case when total > 0 then total end,
      is_paid     = total > 0
  where id = job
    and (amount_paid is distinct from case when total > 0 then total end
         or is_paid is distinct from (total > 0));
  return null;
end $$;

create or replace trigger payments_sync
  after insert or delete on public.payments
  for each row execute function public.sync_load_payments();

create or replace trigger zz_audit
  after insert or update or delete on public.payments
  for each row execute function public.audit_row();

-- 3. Move the old "Mark paid" amounts into payments, so no money is lost --

insert into public.payments (load_id, amount, paid_on, method)
select l.id, l.amount_paid, (l.created_at at time zone 'Asia/Manila')::date, 'cash'
from public.loads l
where l.is_paid and coalesce(l.amount_paid, 0) > 0
  and not exists (select 1 from public.payments p where p.load_id = l.id);

-- 4. Trusted members: "pay later" --------------------------------------------

alter table public.profiles
  add column if not exists pay_later boolean not null default false;

create or replace function public.set_pay_later(target uuid, trusted boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'chairperson' then
    raise exception 'Only the chairperson can mark someone as pay later';
  end if;
  update public.profiles set pay_later = trusted where id = target;
end $$;

revoke execute on function public.set_pay_later(uuid, boolean) from public, anon;
grant execute on function public.set_pay_later(uuid, boolean) to authenticated;

-- 5. The update guard: the 016 version, plus Ticket 31 ------------------

create or replace function public.loads_before_update() returns trigger
language plpgsql set search_path = public as $$
declare
  r        text := public.my_role();
  changed  text[];
  allowed  text[];
  refused  text[];
  window_hours integer;
  others    integer;
  max_sacks integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Updates made BY the database's own triggers (sharing a dryer load's fee
  -- between its jobs, Ticket 29) have already been checked: the person's
  -- own change passed this guard first. People cannot reach this depth.
  if pg_trigger_depth() > 1 then
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

  -- No release until the fee is settled (Ticket 24): paid, or covered by
  -- an approved buyout. Same sum as settlement() in src/lib/loads.ts.
  -- A member the Chairperson trusts to pay later may be released while
  -- still owing (Ticket 31).
  if new.stage = 'Released' and old.stage <> 'Released'
     and not exists (select 1 from public.profiles p
                     where p.id = old.customer_id and p.pay_later) then
    declare
      kept_pct numeric := case when old.buyout_status = 'declined' then 100
                               else coalesce(old.keep_percent, 100) end;
      sold_kg  numeric := coalesce(old.output_kg, 0)
                        - round(coalesce(old.output_kg, 0) * kept_pct / 100, 2);
      sale     numeric := case when old.buyout_status = 'approved'
                               then round(sold_kg * coalesce(old.price_per_kg, 0), 2) else 0 end;
      paid     numeric := case when old.is_paid then coalesce(old.amount_paid, 0) else 0 end;
    begin
      if greatest(0, old.agreed_price - paid) - sale > 0 then
        raise exception 'The customer must pay before release';
      end if;
    end;
  end if;

  -- A job's service can only change while it is still at its first step
  -- (Ticket 35): later, the steps done and the fee would no longer match.
  -- The job moves to the new service's first step at the same time.
  if new.service_type is distinct from old.service_type then
    if old.stage <> public.first_stage(old.service_type)
       or new.stage <> public.first_stage(new.service_type)
       or old.stored_at is not null or old.output_kg is not null then
      raise exception 'The service can only be changed before work starts';
    end if;
  end if;

  -- Pesos or palay is chosen with the harvest count (Ticket 30), and
  -- only then: the price trigger works out the kilos kept at that moment.
  if new.harvest_fee_in is distinct from old.harvest_fee_in
     and not (old.stage = 'Harvesting' and new.stage = 'Drying') then
    raise exception 'The harvest share is chosen at the harvest count';
  end if;

  -- Dryer loads (Ticket 29): a job joins or leaves one only while it is
  -- drying, needs its sacks counted, and a load never holds more sacks
  -- than the maximum in Settings.
  if new.dryer_load_id is distinct from old.dryer_load_id then
    if old.stage <> 'Drying' or new.stage <> 'Drying' then
      raise exception 'A job joins or leaves a dryer load only while drying';
    end if;
    if new.dryer_load_id is not null then
      if new.sacks <= 0 then
        raise exception 'Count the sacks before adding the job to a dryer load';
      end if;
      select coalesce(s.dryer_load_max_sacks, 130) into max_sacks
      from public.settings s where s.id = 1;
      select coalesce(sum(l.sacks), 0) into others
      from public.loads l
      where l.dryer_load_id = new.dryer_load_id and l.id <> new.id;
      if others + new.sacks > coalesce(max_sacks, 130) then
        raise exception 'That dryer load is full';
      end if;
    end if;
  end if;

  -- Only the customer can cancel, and only through the path below.
  if r in ('operator', 'monitor', 'chairperson', 'auditor')
    and new.request_status = 'cancelled'
    and old.request_status is distinct from 'cancelled' then
    raise exception 'Only the customer can cancel their request';
  end if;

  if r = 'chairperson' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                    'stage', 'stored_at', 'request_status',
                    'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                    'buyout_status', 'price_per_kg', 'payout_done_at',
                    'market_price_per_kg', 'harvest_address', 'customer_note',
                    'harvest_fee_in', 'dryer_load_id'];
  elsif r = 'monitor' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                    'stage', 'stored_at', 'request_status',
                    'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                    'buyout_status', 'market_price_per_kg', 'harvest_address',
                    'customer_note', 'harvest_fee_in', 'dryer_load_id'];
    -- A Monitor can only ever move a buyout from none to requested (when
    -- recording a walk-in's choice). Never approve, decline or undo one.
    if 'buyout_status' = any (changed)
      and not (old.buyout_status in ('none', 'requested') and new.buyout_status = 'requested') then
      raise exception 'Only the chairperson can approve, decline or change a buyout';
    end if;
  elsif r = 'operator' then
    -- Operators also record the new sacks and weight after harvesting and
    -- after drying (Ticket 22), and the day's palay price with the harvest
    -- count (Ticket 24).
    allowed := array['stage', 'stored_at', 'output_kg', 'sacks', 'kilos',
                     'market_price_per_kg', 'harvest_fee_in', 'dryer_load_id'];
  elsif old.customer_id = auth.uid() then
    if 'request_status' = any (changed) then
      -- Cancel path: their own request, still pending, inside the co-op's
      -- window — measured with the database's clock, never the phone's.
      select coalesce(cancel_window_hours, 2) into window_hours
      from public.settings where id = 1;

      if old.request_status <> 'pending'
        or new.request_status <> 'cancelled'
        or old.created_at <= now() - make_interval(hours => coalesce(window_hours, 2)) then
        raise exception 'This request can no longer be cancelled';
      end if;

      -- Who and when come from the database, not from the form.
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
      allowed := array['request_status', 'cancelled_at', 'cancelled_by'];
    else
      -- Keep / sell / split: one choice, on their own accepted, weighed,
      -- Ready job.
      if old.request_status <> 'accepted' or old.stage <> 'Ready'
        or old.output_kg is null or old.disposition is not null then
        raise exception 'You can choose keep, sell or split once, after your batch is weighed';
      end if;
      if new.buyout_status not in ('none', 'requested') then
        raise exception 'Only the chairperson can approve or decline a buyout';
      end if;
      allowed := array['disposition', 'keep_percent', 'buyout_status'];
    end if;
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

alter table public.loads enable row level security;
