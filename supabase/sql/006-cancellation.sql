  -- 006 — customers can cancel their own pending request (Ticket 18)
  --
  -- Run this ONCE in the Supabase dashboard, AFTER 005:
  --   Supabase -> SQL Editor -> New query -> paste -> Run
  --
  -- Safe to run twice. The cancel rules are enforced HERE, with the
  -- database's own clock (now()), so a phone with the wrong time or a
  -- hand-made request cannot cancel late, cancel someone else's request,
  -- or cancel a job the co-op already accepted.

  -- 1. The co-op's cancel window (hours), set by the Chairperson ------

  alter table public.settings
    add column if not exists cancel_window_hours integer not null default 2;

  alter table public.settings drop constraint if exists settings_cancel_window_hours_check;
  alter table public.settings add constraint settings_cancel_window_hours_check
    check (cancel_window_hours between 1 and 24);

  -- 2. Who cancelled, and when -------------------------------------------

  alter table public.loads add column if not exists cancelled_at timestamptz;
  alter table public.loads add column if not exists cancelled_by uuid
    references public.profiles (id) on delete set null;

  -- 3. A new request status: cancelled ------------------------------------

  alter table public.loads drop constraint if exists loads_request_status_check;
  alter table public.loads add constraint loads_request_status_check
    check (request_status in ('pending', 'accepted', 'rejected', 'cancelled'));

  -- A cancelled request always has a cancel time; nothing else does.
  alter table public.loads drop constraint if exists loads_cancelled_check;
  alter table public.loads add constraint loads_cancelled_check
    check ((request_status = 'cancelled') = (cancelled_at is not null));

  -- 4. Customers cannot choose their own timestamps -------------------------
  --
  -- Found by testing: a customer could send created_at themselves, e.g. three
  -- hours ago (to jump the Requests queue, which is oldest-first) or in 2030
  -- (to keep a request cancellable forever). This is the 005 insert guard
  -- with two more lines: the database sets created_at and owner_id.

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
    return new;
  end $$;

  drop trigger if exists loads_guard_insert on public.loads;
  create trigger loads_guard_insert
    before insert on public.loads
    for each row execute function public.loads_before_insert();

  -- 5. The update guard -----------------------------------------------------
  --
  -- This is the 005 version of loads_before_update (NOT 004's — that would
  -- undo the 005 fixes), with one addition: a customer's cancel path.

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

  -- 6. RLS stays on; signed-out visitors get nothing ----------------------
  --
  -- No new policies: a customer could already update only their own rows
  -- ("workers and the owning customer update"), and the guard above decides
  -- what they may change. Staff permissions are unchanged.

  alter table public.loads    enable row level security;
  alter table public.settings enable row level security;

  revoke all on table public.loads    from anon;
  revoke all on table public.settings from anon;
