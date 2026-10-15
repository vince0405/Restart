-- 010 — the Chairperson sets the rates (Ticket 25)
-- depends-on: 009
--
-- Run this ONCE in the Supabase dashboard, after 009:
--   Supabase -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run twice. The price list moves from the code into the settings
-- row. The defaults are today's rates, so nothing changes until the
-- Chairperson edits them.
--
-- Security: settings already has RLS from 004 — everyone signed in reads,
-- only the Chairperson updates. The new columns follow the same policies.

-- 1. The rates ------------------------------------------------------------

alter table public.settings
  add column if not exists harvest_share_percent numeric(5, 2)  not null default 15,
  add column if not exists dryer_load_fee        numeric(12, 2) not null default 9000,
  add column if not exists dryer_load_max_sacks  integer        not null default 130,
  add column if not exists milling_fee_per_sack  numeric(12, 2) not null default 120;

alter table public.settings drop constraint if exists settings_rates_check;
alter table public.settings add constraint settings_rates_check check (
  harvest_share_percent between 0 and 100
  and dryer_load_fee >= 0
  and dryer_load_max_sacks > 0
  and milling_fee_per_sack >= 0
);

-- 2. The price trigger reads the rates ------------------------------------
--
-- The 009 version, with the numbers read from settings instead of typed
-- in. A rate change only affects the NEXT count: fees already worked out
-- are saved on the job and stay as they are.

create or replace function public.loads_apply_prices() returns trigger
language plpgsql set search_path = public as $$
declare
  recalc    boolean := false;
  share     numeric := 15;
  load_fee  numeric := 9000;
  max_sacks integer := 130;
  mill_fee  numeric := 120;
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
    -- Drying only and Milling only: the sacks are known now.
    if new.service_type = 'Drying only' then
      new.drying_fee := greatest(1, ceil(new.sacks / max_sacks::numeric)) * load_fee;
    elsif new.service_type = 'Milling only' then
      new.milling_fee := round(new.sacks * mill_fee, 2);
    end if;
    -- Keep a price staff typed in; otherwise use the price list.
    if coalesce(new.agreed_price, 0) = 0 then
      new.agreed_price := coalesce(new.drying_fee, 0) + coalesce(new.milling_fee, 0);
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

alter table public.settings enable row level security;
alter table public.loads enable row level security;
