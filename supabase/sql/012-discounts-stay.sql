-- 012 — a discount stays after the next count (Ticket 27)
-- depends-on: 010, 011
--
-- Run this ONCE in the Supabase dashboard, after 011:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice.
--
-- When staff change a job's fee, the database saves the difference from
-- the price list as fee_adjustment (negative = discount). The next count
-- works out the new list total and adds the same adjustment, instead of
-- wiping it.
--
-- Security: fee_adjustment is on no role's list of changeable columns in
-- loads_before_update, so nobody can type it in. Only the price trigger
-- below sets it, from the fee staff were already allowed to change.

-- 1. The column -----------------------------------------------------------

alter table public.loads
  add column if not exists fee_adjustment numeric(12, 2) not null default 0;

-- 2. The price trigger (the 010 version, plus the adjustment) -------------

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

  if tg_op = 'INSERT' then
    new.market_price_per_kg := null;
    new.harvest_fee := null;
    new.drying_fee  := null;
    new.milling_fee := null;
    new.fee_adjustment := 0;
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

-- create or replace: swaps the 010 trigger in place, no drop needed.
create or replace trigger loads_price
  before insert or update on public.loads
  for each row execute function public.loads_apply_prices();

-- 3. Jobs that already have a changed fee keep it -------------------------

update public.loads
set fee_adjustment = agreed_price
  - (coalesce(harvest_fee, 0) + coalesce(drying_fee, 0) + coalesce(milling_fee, 0))
where fee_adjustment = 0
  and coalesce(harvest_fee, 0) + coalesce(drying_fee, 0) + coalesce(milling_fee, 0) > 0
  and agreed_price <> coalesce(harvest_fee, 0) + coalesce(drying_fee, 0) + coalesce(milling_fee, 0);

alter table public.loads enable row level security;
