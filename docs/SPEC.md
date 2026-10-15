# Spec: RPS1

## Problem
As the Monitor of a small family rice mill, I have to keep track of every
palay load: what stage it is at, what price was agreed, and whether the
customer has paid. Today that lives in a notebook, loose slips, my memory
and messages to staff, so checking anything means flipping pages and asking
around — which costs the mill time and money.

## Solution
A simple phone app where the Monitor logs each load when it arrives, taps
it forward through fixed stages as the work happens, and marks it paid. One
list shows every load, its stage, and whether it is paid — no flipping
pages, no asking twice.

## The user
The **Monitor**: the one person who watches every load at the mill, from
arrival through drying and milling to payment. In our mill, that is the
owner-operator. Staff do not use the app; they tell the Monitor, and the
Monitor records it.

## User stories
1. As the Monitor, I want to sign in with my email and password, so that
   only I can see my customers' records.
2. As the Monitor, I want to log a new load (customer, sacks, kilos,
   service type, agreed price), so that it is recorded at intake instead
   of in the notebook.
3. As the Monitor, I want to see all loads in one list with their stage
   and paid status, so that I can monitor the mill at a glance.
4. As the Monitor, I want to move a load to its next stage with one tap,
   so that the record keeps up with the actual work.
5. As the Monitor, I want to move a load back one stage, so that I can fix
   a wrong tap.
6. As the Monitor, I want to mark a load paid with the amount received,
   and undo it if I made a mistake, so that I always know who has paid.
7. As the Monitor, I want to delete a load I entered by mistake, so that
   the list stays accurate.

## Screens
- **Sign in** — the Monitor enters email and password. Nothing else in
  the app is visible without signing in.
- **Loads list** — the home screen, newest first. Each row shows customer,
  sacks, current stage and a Paid / Not paid badge. A big "+ New load"
  button at the top; "Sign out" at the bottom. Tapping a row opens the
  load.
- **New load** — a form: customer name, sacks, kilos, service type (pick
  from a list), agreed price. Saving starts the load at Received and
  returns to the list.
- **Load detail** — all the load's details; a big "Next stage" button
  (e.g. "Move to Drying"); a smaller "Back one stage" button; a payment
  section to enter the amount and "Mark paid" (or "Mark not paid" to
  undo); and a "Delete load" button that asks "Are you sure?" first.

## Data

### Table: `loads`
One row per load.

| Column | Meaning |
|---|---|
| `id` | Unique ID, created automatically |
| `created_at` | When the load was logged, set automatically |
| `owner_id` | The Monitor account the load belongs to, set automatically to whoever is signed in |
| `customer_name` | Text, required |
| `sacks` | Whole number, required, zero or more |
| `kilos` | Number with decimals, required, zero or more |
| `service_type` | One of: `Package Deal`, `Drying only`, `Milling only` |
| `agreed_price` | Pesos, typed by hand, required, zero or more |
| `stage` | One of: `Received`, `Drying`, `Dried`, `Milling`, `Milled`, `Released`. Starts at `Received` |
| `is_paid` | Yes / No. Starts at No |
| `amount_paid` | Pesos. Empty until marked paid |

**Who may read and write (Row Level Security):**
- RLS is ON.
- Signed-in users may **read, add, update and delete only rows where
  `owner_id` is their own account**.
- Visitors who are not signed in may do **nothing**.

## Login
Yes — the data is customers' names and money, so it must be private.
Supabase Auth, email and password.

- **No sign-up screen.** The team creates the Monitor's account once in
  the Supabase dashboard, and public sign-ups are switched off. Even if
  someone did get an account, RLS means they would see only their own
  (empty) list.

## Done for the demo
On the **live URL**, on a phone:
- [ ] Visiting the app while signed out shows only the sign-in screen.
- [ ] The Monitor signs in.
- [ ] The Monitor logs a new load; it appears at the top of the list as
      Received / Not paid.
- [ ] The Monitor taps it through every stage to Released, and back one
      stage once.
- [ ] The Monitor marks it paid with an amount; the list shows Paid.
- [ ] The Monitor deletes a test load.
- [ ] Refreshing the page keeps everything (it is really saved).
- [ ] The Monitor signs out and the list is no longer visible.
- [ ] Supabase Table Editor shows no "RLS disabled" warning on `loads`.

## Out of scope
Everything in `docs/LATER.md`, including: staff accounts, farmer/admin
roles, warehouse storage and expiry, reports, offline support, payment
methods and receipts, automatic pricing, harvesting as a stage, recording
moisture, editing a load's details after saving, and skipping stages
automatically for drying-only or milling-only loads.

## Assumptions to check
These were decided by recommendation, not confirmed by the team. Correct
them before `/implement` reaches the New load ticket.
- The service types are Package Deal, Drying only and Milling only.
- Moisture is not recorded in the MVP.
- Every load follows the same six stages; the Monitor taps past ones that
  don't apply.
