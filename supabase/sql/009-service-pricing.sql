-- 009 — the price list: the database works out the fee (Ticket 24)
--
-- Run this ONCE in the Supabase dashboard, after 008:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice. The rules (the same as src/lib/pricing.ts — change
-- both together):
--   harvesting = 15% of the harvested kg x market price of palay per kg
--   drying     = P9,000 per dryer load of up to 130 sacks (at least 1 load)
--   milling    = P120 per sack, counted after drying
--
-- Security:
-- - Nobody can type the fee parts in by hand: they are on no role's list
--   of changeable columns, and the price trigger below sets them itself.
-- - Staff can still change the total (agreed_price), as before, for a
--   discount. The next count re-applies the price list.
-- - Operators may set market_price_per_kg (they record the harvest count).
-- - A job cannot be Released while the customer still owes money.

-- 1. The new columns ------------------------------------------------------

alter table public.loads
  add column if not exists market_price_per_kg numeric(12, 2),
  add column if not exists harvest_fee         numeric(12, 2),
  add column if not exists drying_fee          numeric(12, 2),
  add column if not exists milling_fee         numeric(12, 2);

alter table public.loads drop constraint if exists loads_market_price_check;
alter table public.loads add constraint loads_market_price_check
  check (market_price_per_kg is null or market_price_per_kg >= 0);

-- 2. The price trigger ----------------------------------------------------
--
-- Named loads_price so it runs AFTER the loads_guard_* triggers (Postgres
-- runs them in name order): the guard checks what the person sent, then
-- this fills in the fee.

create or replace function public.loads_apply_prices() returns trigger
language plpgsql set search_path = public as $$
declare
  recalc boolean := false;
begin
  if tg_op = 'INSERT' then
    new.market_price_per_kg := null;
    new.harvest_fee := null;
    new.drying_fee  := null;
    new.milling_fee := null;
    -- Drying only and Milling only: the sacks are known now.
    if new.service_type = 'Drying only' then
      new.drying_fee := greatest(1, ceil(new.sacks / 130.0)) * 9000;
    elsif new.service_type = 'Milling only' then
      new.milling_fee := new.sacks * 120;
    end if;
    -- Keep a price staff typed in; otherwise use the price list.
    if coalesce(new.agreed_price, 0) = 0 then
      new.agreed_price := coalesce(new.drying_fee, 0) + coalesce(new.milling_fee, 0);
    end if;
    return new;
  end if;

  -- Harvest counted (Harvesting -> Drying): harvesting and drying fees.
  if old.stage = 'Harvesting' and new.stage = 'Drying' then
    new.harvest_fee := round(new.kilos * 0.15 * coalesce(new.market_price_per_kg, 0), 2);
    new.drying_fee  := greatest(1, ceil(new.sacks / 130.0)) * 9000;
    recalc := true;
  end if;

  -- Counted after drying (Drying -> Milling): the milling fee. Only for
  -- jobs the price list already priced at harvest, so a job from before
  -- 009 keeps the fee staff typed in.
  if old.stage = 'Drying' and new.stage = 'Milling' and old.drying_fee is not null then
    new.milling_fee := new.sacks * 120;
    recalc := true;
  end if;

  if recalc then
    new.agreed_price := coalesce(new.harvest_fee, 0) + coalesce(new.drying_fee, 0)
                      + coalesce(new.milling_fee, 0);
  end if;
  return new;
end $$;

drop trigger if exists loads_price on public.loads;
create trigger loads_price
  before insert or update on public.loads
  for each row execute function public.loads_apply_prices();

-- 3. The update guard -----------------------------------------------------
--
-- The 008 version with TWO changes: market_price_per_kg is on the lists
-- for the Chairperson, Monitors and Operators, and a job cannot be
-- released while the customer still owes money.

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
                    'market_price_per_kg'];
  elsif r = 'monitor' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                    'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
                    'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                    'buyout_status', 'market_price_per_kg'];
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

drop trigger if exists loads_guard_update on public.loads;
create trigger loads_guard_update
  before update on public.loads
  for each row execute function public.loads_before_update();

alter table public.loads enable row level security;
