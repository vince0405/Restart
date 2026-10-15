-- 014 — fix a job's details after saving (Ticket 35)
-- depends-on: 009, 012
--
-- Run this ONCE, after 013. Safe to run twice.
--
-- Staff (Monitor and Chairperson) can now correct the farm address and the
-- note, as well as the customer name and service type they could already
-- change. Counts, fees and payments keep their own screens and rules.
--
-- Also a REPAIR: the live database had an older copy of the update guard
-- (from 006), without 008's operator counts or 009's market price and
-- "no release while money is owed". This file puts back the 009 guard,
-- with Ticket 35's changes marked below.
--
-- Security:
-- - harvest_address and customer_note go on the Monitor's and the
--   Chairperson's lists only. Operators, customers and the Auditor still
--   cannot change them.
-- - The service type can only change while the job is at its first step,
--   and the job must move to the new service's first step with it.
-- - Every edit is written to the history of changes by the 011 trigger.

-- 1. The first step of each service (same as firstStage() in src/lib/loads.ts)

create or replace function public.first_stage(service text) returns text
language sql immutable set search_path = public as $$
  select case service
           when 'Package Deal'        then 'Harvesting'
           when 'Harvesting + Drying' then 'Harvesting'
           else 'Received'
         end
$$;

-- 2. The update guard: the 009 version, plus Ticket 35 ------------------

create or replace function public.loads_before_update() returns trigger
language plpgsql set search_path = public as $$
declare
  r        text := public.my_role();
  changed  text[];
  allowed  text[];
  refused  text[];
  window_hours integer;
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

  -- No release until the fee is settled (Ticket 24): paid in cash, or
  -- covered by an approved buyout. Same sum as settlement() in
  -- src/lib/loads.ts.
  if new.stage = 'Released' and old.stage <> 'Released' then
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

  -- Only the customer can cancel, and only through the path below.
  if r in ('operator', 'monitor', 'chairperson', 'auditor')
    and new.request_status = 'cancelled'
    and old.request_status is distinct from 'cancelled' then
    raise exception 'Only the customer can cancel their request';
  end if;

  if r = 'chairperson' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                    'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
                    'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                    'buyout_status', 'price_per_kg', 'payout_done_at',
                    'market_price_per_kg', 'harvest_address', 'customer_note'];
  elsif r = 'monitor' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                    'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
                    'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                    'buyout_status', 'market_price_per_kg', 'harvest_address',
                    'customer_note'];
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
                     'market_price_per_kg'];
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

-- create or replace: swaps the trigger in place, no drop needed.
create or replace trigger loads_guard_update
  before update on public.loads
  for each row execute function public.loads_before_update();

-- 3. The price trigger: the 012 version, plus a new price on a service change

create or replace function public.loads_apply_prices() returns trigger
language plpgsql set search_path = public as $$
declare
  recalc    boolean := false;
  share     numeric := 15;
  load_fee  numeric := 9000;
  max_sacks integer := 130;
  mill_fee  numeric := 120;
  parts     numeric;
begin
  select coalesce(s.harvest_share_percent, 15), coalesce(s.dryer_load_fee, 9000),
         coalesce(s.dryer_load_max_sacks, 130), coalesce(s.milling_fee_per_sack, 120)
    into share, load_fee, max_sacks, mill_fee
  from public.settings s where s.id = 1;

  -- No settings row visible? Keep the defaults above.
  share     := coalesce(share, 15);
  load_fee  := coalesce(load_fee, 9000);
  max_sacks := coalesce(max_sacks, 130);
  mill_fee  := coalesce(mill_fee, 120);

  -- A new job, or staff changed its service before work started
  -- (Ticket 35): price it again from the price list, as at intake.
  if tg_op = 'INSERT' or new.service_type is distinct from old.service_type then
    new.market_price_per_kg := null;
    new.harvest_fee := null;
    new.drying_fee  := null;
    new.milling_fee := null;
    new.fee_adjustment := 0;
    if tg_op = 'UPDATE' then
      new.agreed_price := 0;
    end if;
    -- Drying only and Milling only: the sacks are known now.
    if new.service_type = 'Drying only' then
      new.drying_fee := greatest(1, ceil(new.sacks / max_sacks::numeric)) * load_fee;
    elsif new.service_type = 'Milling only' then
      new.milling_fee := round(new.sacks * mill_fee, 2);
    end if;
    parts := coalesce(new.drying_fee, 0) + coalesce(new.milling_fee, 0);
    -- Keep a price staff typed in; otherwise use the price list.
    if coalesce(new.agreed_price, 0) = 0 then
      new.agreed_price := parts;
    elsif parts > 0 then
      new.fee_adjustment := new.agreed_price - parts;
    end if;
    return new;
  end if;

  -- Harvest counted (Harvesting -> Drying): harvesting and drying fees.
  if old.stage = 'Harvesting' and new.stage = 'Drying' then
    new.harvest_fee := round(new.kilos * share / 100 * coalesce(new.market_price_per_kg, 0), 2);
    new.drying_fee  := greatest(1, ceil(new.sacks / max_sacks::numeric)) * load_fee;
    recalc := true;
  end if;

  -- Counted after drying (Drying -> Milling): the milling fee. Only for
  -- jobs the price list already priced at harvest.
  if old.stage = 'Drying' and new.stage = 'Milling' and old.drying_fee is not null then
    new.milling_fee := round(new.sacks * mill_fee, 2);
    recalc := true;
  end if;

  parts := coalesce(new.harvest_fee, 0) + coalesce(new.drying_fee, 0)
         + coalesce(new.milling_fee, 0);

  if recalc then
    -- The new list total, with the saved discount (or extra charge).
    new.agreed_price := greatest(0, parts + coalesce(new.fee_adjustment, 0));
  elsif new.agreed_price is distinct from old.agreed_price then
    -- Staff changed the fee: remember how far it is from the price list.
    -- Before the first count there is no list price, so nothing to keep.
    new.fee_adjustment := case when parts > 0 then new.agreed_price - parts else 0 end;
  end if;
  return new;
end $$;

alter table public.loads enable row level security;
