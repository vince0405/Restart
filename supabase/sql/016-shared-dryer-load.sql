-- 016 — farmers share one dryer load (Ticket 29)
-- depends-on: 015
--
-- Run this ONCE, after 015. Safe to run twice.
--
-- Staff put several drying jobs into one dryer load. The load fee (from
-- Settings) is split between the jobs by their sacks:
--   90 + 40 sacks: 90/130 x P9,000 = P6,230.77 and P2,769.23
-- A job alone in the dryer is charged as before.
--
-- Security:
-- - dryer_loads: RLS on. Staff (and the Auditor) read; Operators, Monitors
--   and the Chairperson start a load. Nobody updates or deletes one.
--   Customers cannot read it: they only see their own job's fee.
-- - loads.dryer_load_id: Operators, Monitors and the Chairperson, only
--   while the job is drying, never over the maximum sacks.
-- - The shared fees are written by share_dryer_load(), called only from the
--   trigger below. It runs with the caller's own rights (not security
--   definer); called directly, the guard refuses it like any other change.

-- 1. The table ------------------------------------------------------------

create table if not exists public.dryer_loads (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid        default auth.uid()
);

alter table public.dryer_loads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'dryer_loads' and policyname = 'staff read dryer loads') then
    create policy "staff read dryer loads"
      on public.dryer_loads for select
      to authenticated
      using (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'dryer_loads' and policyname = 'workers start dryer loads') then
    create policy "workers start dryer loads"
      on public.dryer_loads for insert
      to authenticated
      with check (public.my_role() in ('operator', 'monitor', 'chairperson')
                  and created_by = (select auth.uid()));
  end if;
end $$;

revoke all on table public.dryer_loads from anon, authenticated;
grant select, insert on table public.dryer_loads to authenticated;

alter table public.loads
  add column if not exists dryer_load_id uuid references public.dryer_loads (id);

create index if not exists loads_dryer_load_idx on public.loads (dryer_load_id);

-- 2. The split (same rule as splitDryerLoad() in src/lib/pricing.ts) -----
--
-- Each job pays fee x its sacks / all sacks, rounded to the centavo; the
-- job with the fewest sacks gets what is left, so the parts add up to the
-- full fee exactly.

create or replace function public.share_dryer_load(dl uuid) returns void
language plpgsql set search_path = public as $$
declare
  fee   numeric;
  total numeric;
  n     integer;
  i     integer := 0;
  given numeric := 0;
  part  numeric;
  rec   record;
begin
  select s.dryer_load_fee into fee from public.settings s where s.id = 1;
  fee := coalesce(fee, 9000);
  select coalesce(sum(sacks), 0), count(*) into total, n
  from public.loads where dryer_load_id = dl;

  for rec in
    select id, sacks from public.loads where dryer_load_id = dl order by sacks desc, id
  loop
    i := i + 1;
    if i = n then
      part := fee - given;
    elsif total > 0 then
      part := round(fee * rec.sacks / total, 2);
    else
      part := round(fee / n, 2);
    end if;
    given := given + part;
    update public.loads
    set drying_fee   = part,
        agreed_price = greatest(0, coalesce(harvest_fee, 0) + part
                                   + coalesce(milling_fee, 0) + fee_adjustment)
    where id = rec.id;
  end loop;
end $$;

revoke execute on function public.share_dryer_load(uuid) from public, anon;

-- 3. Share again whenever a load's jobs change -----------------------------

create or replace function public.loads_after_dryer_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.dryer_load_id is not null then
      perform public.share_dryer_load(old.dryer_load_id);
    end if;
    return null;
  end if;
  if new.dryer_load_id is distinct from old.dryer_load_id then
    if old.dryer_load_id is not null then
      perform public.share_dryer_load(old.dryer_load_id);
    end if;
    if new.dryer_load_id is not null then
      perform public.share_dryer_load(new.dryer_load_id);
    end if;
  end if;
  return null;
end $$;

create or replace trigger loads_dryer_share
  after update or delete on public.loads
  for each row execute function public.loads_after_dryer_change();

-- 4. The update guard: the 015 version, plus Ticket 29 ------------------

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
                    'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
                    'reject_reason', 'output_kg', 'disposition', 'keep_percent',
                    'buyout_status', 'price_per_kg', 'payout_done_at',
                    'market_price_per_kg', 'harvest_address', 'customer_note',
                    'harvest_fee_in', 'dryer_load_id'];
  elsif r = 'monitor' then
    allowed := array['customer_name', 'sacks', 'kilos', 'service_type', 'agreed_price',
                    'stage', 'stored_at', 'is_paid', 'amount_paid', 'request_status',
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

-- 5. The price trigger: the 015 version, plus leaving a dryer load -------

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
    new.harvest_fee_in := 'pesos';
    new.harvest_kept_kg := null;
    new.dryer_load_id := null;
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

  -- Going back from Drying to fix a count: out of its dryer load (the
  -- next count works the drying fee out again).
  if old.stage = 'Drying' and new.stage in ('Harvesting', 'Received') then
    new.dryer_load_id := null;
  end if;

  -- Taken out of a shared dryer load while drying (Ticket 29): a full load
  -- again, as if alone. (Joining is priced by share_dryer_load below.)
  if old.dryer_load_id is not null and new.dryer_load_id is null
     and new.stage = 'Drying' and new.drying_fee is not null then
    new.drying_fee := greatest(1, ceil(new.sacks / max_sacks::numeric)) * load_fee;
    recalc := true;
  end if;

  -- Harvest counted (Harvesting -> Drying): harvesting and drying fees.
  if old.stage = 'Harvesting' and new.stage = 'Drying' then
    if new.harvest_fee_in = 'palay' then
      -- Paid in palay (Ticket 30): the co-op keeps the share of the kilos
      -- (and the same share of the sacks); the farmer's grain is the rest,
      -- and drying and milling are worked out on that. Same rule as
      -- harvestShareInPalay() in src/lib/pricing.ts.
      new.harvest_kept_kg := round(new.kilos * share / 100, 2);
      new.kilos := new.kilos - new.harvest_kept_kg;
      new.sacks := new.sacks - round(new.sacks * share / 100)::integer;
      new.harvest_fee := 0;
    else
      new.harvest_kept_kg := null;
      new.harvest_fee := round(new.kilos * share / 100 * coalesce(new.market_price_per_kg, 0), 2);
    end if;
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
