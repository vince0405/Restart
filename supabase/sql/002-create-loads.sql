-- 002 — the loads table (Ticket 02)
--
-- One row per palay load. Run this in the Supabase dashboard:
--   Supabase -> SQL Editor -> New query -> paste -> Run

-- 1. The table ------------------------------------------------------

create table if not exists loads (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- The Monitor who owns this load. Filled in automatically with
  -- whoever is signed in, so the app never has to send it.
  owner_id      uuid        not null default auth.uid()
                            references auth.users (id) on delete cascade,

  customer_name text        not null check (length(trim(customer_name)) > 0),
  sacks         integer     not null check (sacks >= 0),
  kilos         numeric(10, 2) not null check (kilos >= 0),
  service_type  text        not null
                            check (service_type in ('Package Deal', 'Drying only', 'Milling only')),
  agreed_price  numeric(12, 2) not null check (agreed_price >= 0),

  stage         text        not null default 'Received'
                            check (stage in ('Received', 'Drying', 'Dried', 'Milling', 'Milled', 'Released')),

  is_paid       boolean     not null default false,
  amount_paid   numeric(12, 2) check (amount_paid >= 0),

  -- A load that is not paid must not carry an amount.
  check (is_paid or amount_paid is null)
);

-- 2. Row Level Security --------------------------------------------
--
-- The publishable key is visible in the browser, so RLS is the only
-- thing keeping customers' names and money private.

alter table loads enable row level security;

-- Signed-in Monitors may see, add, change and delete ONLY their own loads.

create policy "monitors can read their own loads"
  on loads for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "monitors can add their own loads"
  on loads for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "monitors can update their own loads"
  on loads for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "monitors can delete their own loads"
  on loads for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Deliberately NO policy for `anon` (visitors who are not signed in).
-- No policy means no rows: a signed-out visitor sees 0 loads.

-- 3. Table permissions ----------------------------------------------
--
-- RLS decides WHICH rows; these grants decide whether the API may touch
-- the table at all. Visitors may ask (and get zero rows back, because of
-- RLS above); only signed-in users may write.

grant select on table loads to anon;
grant select, insert, update, delete on table loads to authenticated;
