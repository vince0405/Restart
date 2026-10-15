-- 018 — more than one cooperative (Ticket 34)
-- depends-on: 017
--
-- Run this ONCE, after 017. Safe to run twice.
--
-- RPS1 can now serve several cooperatives (e.g. one in Batad, one in
-- another town). Each co-op has its own people, jobs, rates, payments,
-- dryer loads, price history and history of changes. A main Admin adds
-- co-ops and their first Chairperson.
--
-- Security (the important part):
-- - Every table has a coop_id, and every RLS policy and guard checks it
--   against the signed-in person's own co-op (my_coop()). A Chairperson of
--   co-op A cannot read or change anything of co-op B.
-- - coop_id comes from the database (column default = my_coop(), checked
--   again by RLS), never from a form. Nobody can move a row to another
--   co-op: coop_id is on no role's list in the loads guard.
-- - Admins are kept in their own table (admins), not as a role. An Admin
--   has no co-op, so every co-op policy gives them nothing: they cannot see
--   any jobs, money or people. They can only add co-ops and make a new
--   account a co-op's first Chairperson.
-- - set_person / set_pay_later now refuse people of another co-op.
-- - The old single settings row is kept but frozen (read-only); each
--   co-op's settings now live on its cooperatives row.
--
-- Nothing is dropped. Batad's existing data is moved into its own co-op
-- (id 00000000-0000-4000-8000-000000000001).

-- 1. Co-ops and admins ------------------------------------------------------

create table if not exists public.cooperatives (
  id                    uuid          primary key default gen_random_uuid(),
  created_at            timestamptz   not null default now(),
  name                  text          not null check (length(trim(name)) between 1 and 120),
  town                  text          not null default '' check (length(town) <= 120),
  farmgate_price_per_kg numeric(10, 2) not null default 0 check (farmgate_price_per_kg >= 0),
  rice_lifeline_days    integer       not null default 30 check (rice_lifeline_days > 0),
  palay_lifeline_days   integer       not null default 90 check (palay_lifeline_days > 0),
  warning_days          integer       not null default 14 check (warning_days >= 0),
  cancel_window_hours   integer       not null default 2 check (cancel_window_hours between 1 and 24),
  harvest_share_percent numeric       not null default 15 check (harvest_share_percent between 0 and 100),
  dryer_load_fee        numeric       not null default 9000 check (dryer_load_fee >= 0),
  dryer_load_max_sacks  integer       not null default 130 check (dryer_load_max_sacks > 0),
  milling_fee_per_sack  numeric       not null default 120 check (milling_fee_per_sack >= 0)
);

create table if not exists public.admins (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cooperatives enable row level security;
alter table public.admins enable row level security;

-- Batad: its settings move from the old settings row.
insert into public.cooperatives (id, name, town, farmgate_price_per_kg, rice_lifeline_days,
  palay_lifeline_days, warning_days, cancel_window_hours, harvest_share_percent,
  dryer_load_fee, dryer_load_max_sacks, milling_fee_per_sack)
select '00000000-0000-4000-8000-000000000001', s.coop_name, 'Batad', s.farmgate_price_per_kg, s.rice_lifeline_days,
  s.palay_lifeline_days, s.warning_days, s.cancel_window_hours, s.harvest_share_percent,
  s.dryer_load_fee, s.dryer_load_max_sacks, s.milling_fee_per_sack
from public.settings s
where s.id = 1
on conflict (id) do nothing;

-- 2. A co-op link on every table, Batad for everything that exists --------

alter table public.profiles      add column if not exists coop_id uuid references public.cooperatives (id);
alter table public.loads         add column if not exists coop_id uuid references public.cooperatives (id);
alter table public.dryer_loads   add column if not exists coop_id uuid references public.cooperatives (id);
alter table public.payments      add column if not exists coop_id uuid references public.cooperatives (id);
alter table public.price_history add column if not exists coop_id uuid references public.cooperatives (id);
alter table public.audit_log     add column if not exists coop_id uuid references public.cooperatives (id);

-- Who am I? (after the columns it reads) -------------------------------------------------------------

create or replace function public.my_coop() returns uuid
language sql stable security definer set search_path = public as $$
  select coop_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

update public.profiles      set coop_id = '00000000-0000-4000-8000-000000000001'
where coop_id is null and not exists (select 1 from public.admins a where a.user_id = profiles.id);
update public.loads         set coop_id = '00000000-0000-4000-8000-000000000001' where coop_id is null;
update public.dryer_loads   set coop_id = '00000000-0000-4000-8000-000000000001' where coop_id is null;
update public.payments      set coop_id = '00000000-0000-4000-8000-000000000001' where coop_id is null;
update public.price_history set coop_id = '00000000-0000-4000-8000-000000000001' where coop_id is null;
update public.audit_log     set coop_id = '00000000-0000-4000-8000-000000000001' where coop_id is null;

-- New rows belong to the co-op of whoever adds them.
alter table public.loads         alter column coop_id set default public.my_coop();
alter table public.dryer_loads   alter column coop_id set default public.my_coop();
alter table public.payments      alter column coop_id set default public.my_coop();

alter table public.loads         alter column coop_id set not null;
alter table public.dryer_loads   alter column coop_id set not null;
alter table public.payments      alter column coop_id set not null;
alter table public.price_history alter column coop_id set not null;

create index if not exists profiles_coop_idx      on public.profiles (coop_id);
create index if not exists loads_coop_idx         on public.loads (coop_id);
create index if not exists dryer_loads_coop_idx   on public.dryer_loads (coop_id);
create index if not exists payments_coop_idx      on public.payments (coop_id);
create index if not exists price_history_coop_idx on public.price_history (coop_id);
create index if not exists audit_log_coop_idx     on public.audit_log (coop_id);

-- 4. Every policy checks the co-op ------------------------------------------

alter policy "staff read all, customers their own" on public.loads
  using ((public.is_staff() and coop_id = public.my_coop())
         or customer_id = (select auth.uid()));
alter policy "managers add jobs, customers add requests" on public.loads
  with check (coop_id = public.my_coop()
              and (public.can_manage()
                   or (customer_id = (select auth.uid()) and request_status = 'pending')));
alter policy "workers and the owning customer update" on public.loads
  using ((public.my_role() in ('operator', 'monitor', 'chairperson') and coop_id = public.my_coop())
         or customer_id = (select auth.uid()))
  with check ((public.my_role() in ('operator', 'monitor', 'chairperson') and coop_id = public.my_coop())
              or customer_id = (select auth.uid()));
alter policy "managers delete" on public.loads
  using (public.can_manage() and coop_id = public.my_coop());

alter policy "read own profile, staff read all" on public.profiles
  using (id = (select auth.uid()) or (public.is_staff() and coop_id = public.my_coop()));

alter policy "chairperson and auditor read the log" on public.audit_log
  using (public.my_role() in ('chairperson', 'auditor') and coop_id = public.my_coop());

alter policy "staff and auditor read prices" on public.price_history
  using (public.my_role() in ('operator', 'monitor', 'chairperson', 'auditor')
         and coop_id = public.my_coop());

alter policy "staff read dryer loads" on public.dryer_loads
  using (public.is_staff() and coop_id = public.my_coop());
alter policy "workers start dryer loads" on public.dryer_loads
  with check (public.my_role() in ('operator', 'monitor', 'chairperson')
              and created_by = (select auth.uid())
              and coop_id = public.my_coop());

alter policy "staff read payments, customers their own" on public.payments
  using ((public.is_staff() and coop_id = public.my_coop())
         or exists (select 1 from public.loads l
                    where l.id = load_id and l.customer_id = (select auth.uid())));
alter policy "managers record payments" on public.payments
  with check (public.can_manage() and coop_id = public.my_coop());
alter policy "managers delete payments" on public.payments
  using (public.can_manage() and coop_id = public.my_coop());

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'cooperatives' and policyname = 'members read their co-op, admins all') then
    create policy "members read their co-op, admins all"
      on public.cooperatives for select
      to authenticated
      using (id = public.my_coop() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'cooperatives' and policyname = 'chairperson edits their co-op') then
    create policy "chairperson edits their co-op"
      on public.cooperatives for update
      to authenticated
      using (id = public.my_coop() and public.my_role() = 'chairperson')
      with check (id = public.my_coop() and public.my_role() = 'chairperson');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'cooperatives' and policyname = 'admins add co-ops') then
    create policy "admins add co-ops"
      on public.cooperatives for insert
      to authenticated
      with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'admins' and policyname = 'admins see themselves') then
    create policy "admins see themselves"
      on public.admins for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
end $$;

revoke all on table public.cooperatives from anon, authenticated;
grant select, insert on table public.cooperatives to authenticated;
-- The Chairperson changes their co-op's settings, never its id.
grant update (name, town, farmgate_price_per_kg, rice_lifeline_days, palay_lifeline_days,
              warning_days, cancel_window_hours, harvest_share_percent, dryer_load_fee,
              dryer_load_max_sacks, milling_fee_per_sack)
  on public.cooperatives to authenticated;
revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

-- The old single settings row is now read-only.
revoke update on table public.settings from authenticated;

-- 5. Guards, prices and dryer loads use the job's own co-op ----------------

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
  from public.cooperatives s where s.id = new.coop_id;

  -- No co-op row visible? Keep the defaults above.
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
  select c.dryer_load_fee into fee
  from public.dryer_loads d join public.cooperatives c on c.id = d.coop_id
  where d.id = dl;
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

create or replace function public.payments_before_insert() returns trigger
language plpgsql set search_path = public as $$
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
  return new;
end $$;

-- 6. Price history per co-op (replaces the 013 trigger on settings) -------

create or replace function public.record_coop_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.farmgate_price_per_kg is distinct from old.farmgate_price_per_kg then
    insert into public.price_history (price_per_kg, set_by, coop_id)
    values (new.farmgate_price_per_kg, auth.uid(), new.id);
  end if;
  return null;
end $$;

create or replace trigger price_history
  after insert or update on public.cooperatives
  for each row execute function public.record_coop_price();

-- 7. The history of changes knows the co-op --------------------------------

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o    jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n    jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  diff jsonb;
  coop uuid;
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

  -- Whose history this belongs to (Ticket 34).
  coop := case when tg_table_name = 'cooperatives'
               then (coalesce(n, o) ->> 'id')::uuid
               else (coalesce(n, o) ->> 'coop_id')::uuid end;

  insert into public.audit_log (table_name, row_id, action, changed_by, changes, coop_id)
  values (tg_table_name, coalesce(n, o) ->> 'id', lower(tg_op), auth.uid(), diff, coop);
  return null;
end $$;

create or replace trigger zz_audit
  after insert or update or delete on public.cooperatives
  for each row execute function public.audit_row();

-- 8. People: new accounts join a co-op; roles stay inside it ---------------

-- Sign-up sends the chosen co-op (and the Chairperson's "Add a person"
-- sends theirs). Only a real co-op id is kept; the role is never read.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := new.raw_user_meta_data ->> 'coop_id';
  coop   uuid;
begin
  if wanted ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    select id into coop from public.cooperatives where id = wanted::uuid;
  end if;
  insert into public.profiles (id, full_name, phone, contact_email, coop_id)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'contact_email', ''), 254), ''),
    coop
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.set_person(target uuid, new_role text, new_is_member boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'chairperson' then
    raise exception 'Only the chairperson can change roles and members';
  end if;
  if not exists (select 1 from public.profiles where id = target and coop_id = public.my_coop()) then
    raise exception 'That person is not in your cooperative';
  end if;
  if target = auth.uid() and new_role <> 'chairperson' then
    raise exception 'You cannot remove your own chairperson role';
  end if;
  update public.profiles set role = new_role, is_member = new_is_member where id = target;
end $$;

create or replace function public.set_pay_later(target uuid, trusted boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'chairperson' then
    raise exception 'Only the chairperson can mark someone as pay later';
  end if;
  if not exists (select 1 from public.profiles where id = target and coop_id = public.my_coop()) then
    raise exception 'That person is not in your cooperative';
  end if;
  update public.profiles set pay_later = trusted where id = target;
end $$;

-- 9. The main Admin ---------------------------------------------------------

-- The co-ops people can choose from when they sign up (names only).
create or replace function public.list_cooperatives()
returns table (id uuid, name text, town text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.town from public.cooperatives c order by c.name
$$;

grant execute on function public.list_cooperatives() to anon, authenticated;

-- Admin only: every co-op with its Chairperson(s) — no jobs, no money.
create or replace function public.admin_list_cooperatives()
returns table (id uuid, name text, town text, created_at timestamptz,
               chairpersons text, people bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can list cooperatives';
  end if;
  return query
    select c.id, c.name, c.town, c.created_at,
           coalesce(string_agg(p.full_name, ', ') filter (where p.role = 'chairperson'), ''),
           count(p.id)
    from public.cooperatives c
    left join public.profiles p on p.coop_id = c.id
    group by c.id
    order by c.created_at;
end $$;

-- Admin only: make a brand-new account the first Chairperson of a co-op.
create or replace function public.admin_make_chairperson(target uuid, coop uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can add a chairperson';
  end if;
  if not exists (select 1 from public.cooperatives where id = coop) then
    raise exception 'No such cooperative';
  end if;
  update public.profiles set role = 'chairperson', coop_id = coop
  where id = target and coop_id is not distinct from coop and role = 'customer';
  if not found then
    raise exception 'Only a new account of that cooperative can be made its chairperson';
  end if;
end $$;

revoke execute on function public.admin_list_cooperatives() from public, anon;
revoke execute on function public.admin_make_chairperson(uuid, uuid) from public, anon;
revoke execute on function public.my_coop() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.my_coop() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list_cooperatives() to authenticated;
grant execute on function public.admin_make_chairperson(uuid, uuid) to authenticated;

alter table public.loads enable row level security;
alter table public.profiles enable row level security;
