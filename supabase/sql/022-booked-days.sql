-- 022 — a day that is already booked cannot be booked again (Ticket 41)
-- depends-on: 021
--
-- Run this ONCE, after 021. Safe to run twice.
--
-- A customer's preferred date is a booking. Each co-op takes a number of
-- bookings per day (bookings_per_day, set by the Chairperson; default 1).
-- Once a day has that many pending or accepted requests, nobody else can
-- request it. Rejected and cancelled requests free the day again.
--
-- Security:
-- - The rule is checked by the database when the request is saved, so a
--   tampered form cannot skip it. A short lock on (co-op, day) stops two
--   customers taking the last place at the same moment.
-- - Customers cannot read each other's requests (RLS). full_days() tells
--   them only WHICH dates are full in their own co-op: no names, no jobs.
-- - bookings_per_day: the Chairperson only (the 018 rule for co-op
--   settings).

-- 1. Bookings per day ----------------------------------------------------------

alter table public.cooperatives
  add column if not exists bookings_per_day integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cooperatives_bookings_per_day_check') then
    alter table public.cooperatives add constraint cooperatives_bookings_per_day_check
      check (bookings_per_day between 1 and 50);
  end if;
end $$;

grant update (bookings_per_day) on public.cooperatives to authenticated;

create index if not exists loads_booking_idx
  on public.loads (coop_id, preferred_date)
  where preferred_date is not null;

-- 2. Which days are full (dates only) ------------------------------------------

-- Is this day full in MY co-op? Used by the insert guard below.
create or replace function public.day_is_full(day date) returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) >= coalesce(max(c.bookings_per_day), 1)
  from public.cooperatives c
  left join public.loads l
    on l.coop_id = c.id
   and l.preferred_date = day
   and l.request_status in ('pending', 'accepted')
  where c.id = public.my_coop()
    and l.id is not null
$$;

-- The full days in MY co-op between two dates (at most a year), for the
-- request form. Returns dates only.
create or replace function public.full_days(from_date date, to_date date)
returns setof date
language sql stable security definer set search_path = public as $$
  select l.preferred_date
  from public.loads l
  join public.cooperatives c on c.id = l.coop_id
  where l.coop_id = public.my_coop()
    and l.preferred_date between from_date and least(to_date, from_date + 366)
    and l.request_status in ('pending', 'accepted')
  group by l.preferred_date, c.bookings_per_day
  having count(*) >= c.bookings_per_day
  order by 1
$$;

revoke execute on function public.day_is_full(date) from public, anon;
revoke execute on function public.full_days(date, date) from public, anon;
grant execute on function public.day_is_full(date) to authenticated;
grant execute on function public.full_days(date, date) to authenticated;

-- 3. The insert guard: the 006 version, plus the booking rule ------------------

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
