-- 023 — fixes from the security and bug test (Ticket 42)
-- depends-on: 022
--
-- Run this ONCE, after 022. Safe to run twice.
--
-- 1. Payments: never more than what is still owed (no silent overpayment).
-- 2. Payments on a released or paid-out job can't be removed (that quietly
--    undid "no release until paid").
-- 3. Supply: taking out more than the co-op has is refused by the database,
--    not only the app; supply_levels() works the totals out in the database
--    (the app was capped at 1,000 jobs).
-- 4. At most 3 waiting requests per customer (one person could book every
--    day).
-- 5. Closed (rejected / cancelled) requests can't be changed; waiting ones
--    can only be accepted or rejected.
-- 6. The fee can't change after release or payout.
-- 7. A new dryer load is created and joined in one step (no empty loads).
-- 8. The old single settings row is hidden (every co-op could read
--    Batad's old settings; nothing uses it any more).

-- 1. Payments: the insert guard (018 version + the balance check) ----------

create or replace function public.payments_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  fee  numeric;
  paid numeric;
begin
  if auth.uid() is null then
    return new; -- the dashboard, or the move of old amounts below
  end if;
  new.recorded_by := auth.uid();
  new.created_at  := now();
  if not exists (select 1 from public.loads l
                 where l.id = new.load_id and l.request_status = 'accepted'
                   and l.coop_id = new.coop_id) then
    raise exception 'Payments can only be recorded on accepted jobs';
  end if;

  -- Never more than what is still owed (Ticket 42). The job row is locked
  -- so two payments at once can't both slip under the balance.
  select l.agreed_price into fee from public.loads l where l.id = new.load_id for update;
  select coalesce(sum(p.amount), 0) into paid from public.payments p where p.load_id = new.load_id;
  if new.amount > greatest(0, fee - paid) + 0.005 then
    raise exception 'That is more than what is still owed';
  end if;
  return new;
end $$;

-- 2. Payments on a released or paid-out job stay -------------------------------

create or replace function public.payments_before_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Deleting a whole job (cascade) still removes its payments.
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from public.loads l
             where l.id = old.load_id
               and (l.stage = 'Released' or l.payout_done_at is not null)) then
    raise exception 'A payment on a released job cannot be removed';
  end if;
  return old;
end $$;

create or replace trigger payments_guard_delete
  before delete on public.payments
  for each row execute function public.payments_before_delete();

-- 3. Supply levels in the database, and no taking out more than there is ----

-- The co-op's supply (same rule as supplyLevels() in src/lib/supply.ts):
-- bought in approved buyouts + palay kept as harvest shares + hand entries.
create or replace function public.supply_levels()
returns table (product text, bought numeric, harvest_share numeric, manual numeric, total numeric)
language sql stable set search_path = public as $$
  with bought as (
    select case when l.service_type in ('Package Deal', 'Milling only') then 'rice' else 'palay' end as product,
           sum(coalesce(l.output_kg, 0)
               - round(coalesce(l.output_kg, 0) * coalesce(l.keep_percent, 100) / 100, 2)) as kg
    from public.loads l
    where l.coop_id = public.my_coop() and l.request_status = 'accepted' and l.buyout_status = 'approved'
    group by 1
  ),
  harvest as (
    select coalesce(sum(l.harvest_kept_kg), 0) as kg
    from public.loads l
    where l.coop_id = public.my_coop() and l.request_status = 'accepted'
  ),
  manual as (
    select e.product, sum(e.kg) as kg
    from public.supply_entries e
    where e.coop_id = public.my_coop()
    group by e.product
  )
  select p.product,
         round(coalesce(b.kg, 0), 2),
         case when p.product = 'palay' then round(h.kg, 2) else 0 end,
         round(coalesce(m.kg, 0), 2),
         round(coalesce(b.kg, 0) + case when p.product = 'palay' then h.kg else 0 end + coalesce(m.kg, 0), 2)
  from (values ('rice'), ('palay')) as p(product)
  left join bought b on b.product = p.product
  left join manual m on m.product = p.product
  cross join harvest h
$$;

revoke execute on function public.supply_levels() from public, anon;
grant execute on function public.supply_levels() to authenticated;

create or replace function public.supply_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  have numeric;
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
    new.created_at  := now();
  end if;
  -- Taking out: never more than the co-op has. Locked per co-op and product
  -- so two people can't take the last kilos at once.
  if new.kg < 0 and auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended('supply:' || new.coop_id::text || ':' || new.product, 42));
    select s.total into have from public.supply_levels() s where s.product = new.product;
    if coalesce(have, 0) + new.kg < -0.005 then
      raise exception 'That is more than the co-op has';
    end if;
  end if;
  return new;
end $$;

-- 4 to 6. The guards ------------------------------------------------------------

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
  -- pending request that belongs to them, created right now.
  new.created_at     := now();
  new.owner_id       := auth.uid();
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
  new.cancelled_at   := null;
  new.cancelled_by   := null;

  -- At most 3 waiting requests per customer (Ticket 42), so one person
  -- cannot book every day. Locked per customer so a burst can't slip past.
  perform pg_advisory_xact_lock(hashtextextended('requests:' || auth.uid()::text, 42));
  if (select count(*) from public.loads
      where customer_id = auth.uid() and request_status = 'pending') >= 3 then
    raise exception 'You already have 3 requests waiting';
  end if;

  -- The preferred date is a booking (Ticket 41): today or later, and not a
  -- day that is already full. Lock the (co-op, day) first so two requests
  -- at the same moment cannot both take the last place.
  if new.preferred_date is not null then
    if new.preferred_date < (now() at time zone 'Asia/Manila')::date then
      raise exception 'Choose today or a later day';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(public.my_coop()::text || ':' || new.preferred_date::text, 41));
    if public.day_is_full(new.preferred_date) then
      raise exception 'That day is already booked';
    end if;
  end if;

  return new;
end $$;

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

  -- The Auditor only looks (Ticket 38): no change of any kind, not even
  -- as the customer of their own job.
  if r = 'auditor' then
    raise exception 'The auditor can view but not change anything';
  end if;

  -- Which columns are actually different?
  select coalesce(array_agg(n.key), '{}') into changed
  from jsonb_each(to_jsonb(new)) as n
  where n.value is distinct from (to_jsonb(old) -> n.key);

  -- Staff and closed or waiting requests (Ticket 42). A rejected or
  -- cancelled request is closed: nothing changes. A waiting request is only
  -- accepted (with its fee) or rejected (with a reason) — no steps, counts
  -- or payments until it is accepted.
  if r in ('operator', 'monitor', 'chairperson') then
    if old.request_status in ('rejected', 'cancelled') then
      raise exception 'This request is closed and cannot be changed';
    end if;
    if old.request_status = 'pending' and exists (
      select 1 from unnest(changed) as c
      where c not in ('request_status', 'reject_reason', 'agreed_price')
    ) then
      raise exception 'Accept the request first';
    end if;
  end if;

  -- The fee is settled once the job is released or paid out (Ticket 42).
  if new.agreed_price is distinct from old.agreed_price
     and (old.stage = 'Released' or old.payout_done_at is not null) then
    raise exception 'The fee cannot change after release or payout';
  end if;

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
      -- Only a dryer load of the job's own co-op (Ticket 34).
      if not exists (select 1 from public.dryer_loads d
                     where d.id = new.dryer_load_id and d.coop_id = old.coop_id) then
        raise exception 'That dryer load belongs to another cooperative';
      end if;
      select coalesce(c.dryer_load_max_sacks, 130) into max_sacks
      from public.cooperatives c where c.id = old.coop_id;
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
      select coalesce(c.cancel_window_hours, 2) into window_hours
      from public.cooperatives c where c.id = old.coop_id;

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

-- 7. Start a dryer load and put a job in it, in one step -----------------------

-- Runs with the caller's own rights: RLS and the guards still decide. If
-- the job can't join, the new dryer load is rolled back with it.
create or replace function public.join_new_dryer_load(job uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  dl uuid;
begin
  insert into public.dryer_loads (created_by) values (auth.uid()) returning id into dl;
  update public.loads set dryer_load_id = dl where id = job and stage = 'Drying';
  if not found then
    raise exception 'A job joins or leaves a dryer load only while drying';
  end if;
  return dl;
end $$;

revoke execute on function public.join_new_dryer_load(uuid) from public, anon;
grant execute on function public.join_new_dryer_load(uuid) to authenticated;

-- 8. Hide the old single settings row ------------------------------------------

alter policy "signed-in users read settings" on public.settings using (false);

alter table public.loads enable row level security;
