# Spec: RPS1

## Problem
As the Monitor of a small family rice mill, I have to keep track of every
load: which service the customer chose, what step it is at, whether it is
being stored and when that stored palay or rice will go bad, and whether
the customer has paid. Today that lives in a notebook, loose slips, my
memory and messages to staff, so checking anything means flipping pages
and asking around — which costs the mill time and money.

## Solution
A simple phone app where the Monitor logs each load with its service, and
the app shows only the steps that service actually has. The Monitor taps
the load forward as the work happens, can mark finished palay or rice as
stored at the mill, and gets a warning before stored grain expires. One
list shows every load, its step, whether it is paid, and what is about to
expire.

## The user
The **Monitor**: the one person who watches every load at the mill, from
the start of the service to payment. In our mill, that is the
owner-operator. Operators and customers do not use the app in the MVP;
operators tell the Monitor, and the Monitor records it. Operator and
customer logins are the planned next step (see `docs/LATER.md`).

## Services and their steps
Each load follows only the steps of its service:

| Service | Steps |
|---|---|
| Package Deal | Harvesting → Drying → Milling → Ready → Released |
| Harvesting + Drying | Harvesting → Drying → Ready → Released |
| Drying only | Received → Drying → Ready → Released |
| Milling only | Received → Milling → Ready → Released |

- **Ready** means the work is finished and the grain is waiting for the
  customer.
- From **Ready**, the Monitor can either release it, or **store it at the
  mill**. A stored load moves to **Stored**, and later to **Released**.
- What is stored is **rice** if the service includes Milling (Package Deal,
  Milling only), otherwise **palay**.
- **Palay keeps for 3 months. Rice keeps for 1 month**, counted from the
  day it was stored.

## User stories
1. As the Monitor, I want to sign in with my email and password, so that
   only I can see my customers' records.
2. As the Monitor, I want to log a new load (customer, sacks, kilos,
   service, agreed price), so that it is recorded when the job starts
   instead of in the notebook.
3. As the Monitor, I want to see all loads in one list with their step,
   paid status and any expiry warning, so that I can monitor the mill at a
   glance.
4. As the Monitor, I want to move a load to its next step with one tap,
   following only the steps of its service, so that the record keeps up
   with the actual work.
5. As the Monitor, I want to move a load back one step, so that I can fix
   a wrong tap.
6. As the Monitor, I want to mark a Ready load as stored and see when it
   expires, so that no customer's palay or rice goes bad in storage.
7. As the Monitor, I want to mark a load paid with the amount received,
   and undo it if I made a mistake, so that I always know who has paid.
8. As the Monitor, I want to delete a load I entered by mistake, so that
   the list stays accurate.

## Screens
- **Sign in** — the Monitor enters email and password. Nothing else in
  the app is visible without signing in.
- **Loads list** — the home screen, newest first. Each row shows customer,
  sacks, service, current step and a Paid / Not paid badge. Stored loads
  show "Expires in N days", highlighted when 7 days or fewer are left, and
  "Expired" once past. A big "+ New load" button at the top; "Sign out" at
  the bottom. Tapping a row opens the load.
- **New load** — a form: customer name, sacks, kilos, service (pick from
  the four), agreed price. Saving starts the load at the first step of its
  service and returns to the list.
- **Load detail** — all the load's details; the steps of its service with
  the current one highlighted; a big "Move to <next step>" button; a
  smaller "Back one step" button; at Ready, a choice of "Release" or
  "Store at the mill"; when stored, the date stored and the expiry date; a
  payment section to enter the amount and "Mark paid" (or "Mark not paid"
  to undo); and a "Delete load" button that asks "Are you sure?" first.

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
| `service_type` | One of: `Package Deal`, `Harvesting + Drying`, `Drying only`, `Milling only` |
| `agreed_price` | Pesos, typed by hand, required, zero or more. Includes any storage charge for now |
| `stage` | One of: `Received`, `Harvesting`, `Drying`, `Milling`, `Ready`, `Stored`, `Released`. Starts at the first step of the service |
| `stored_at` | When the load was stored at the mill. Empty unless it has been stored |
| `is_paid` | Yes / No. Starts at No |
| `amount_paid` | Pesos. Empty until marked paid |

The expiry date is not stored; it is worked out from `stored_at` plus 3
months (palay) or 1 month (rice).

**Who may read and write (Row Level Security):**
- RLS is ON.
- Signed-in users may **read, add, update and delete only rows where
  `owner_id` is their own account**.
- Visitors who are not signed in may do **nothing**.

## Login
Yes — the data is customers' names and money, so it must be private.
Supabase Auth, email and password.

- **One login type: the Monitor.** The team creates the Monitor's account
  once in the Supabase dashboard, and public sign-ups are switched off.
  Even if someone did get an account, RLS means they would see only their
  own (empty) list.

## Done for the demo
On the **live URL**, on a phone:
- [ ] Visiting the app while signed out shows only the sign-in screen.
- [ ] The Monitor signs in.
- [ ] The Monitor logs a Package Deal load; it appears at the top of the
      list at Harvesting / Not paid.
- [ ] The Monitor taps it through Harvesting → Drying → Milling → Ready,
      and back one step once.
- [ ] A Drying only load never shows Harvesting or Milling.
- [ ] The Monitor stores a Ready load; the list shows "Expires in 30 days"
      for rice (or about 90 days for palay).
- [ ] The Monitor marks a load paid with an amount; the list shows Paid.
- [ ] The Monitor deletes a test load.
- [ ] Refreshing the page keeps everything (it is really saved).
- [ ] The Monitor signs out and the list is no longer visible.
- [ ] Supabase Table Editor shows no "RLS disabled" warning on `loads`.

## Out of scope
Everything in `docs/LATER.md`, including: operator and customer logins,
storage locations and capacity, a separate storage fee, storing between
steps (for example dried palay waiting to be milled), reports, offline
support, payment methods and receipts, automatic pricing, recording
moisture, and editing a load's details after saving.

## Assumptions to check
Decided by recommendation, not yet confirmed by the team:
- Storage only happens once the work is finished (at Ready), not between
  steps.
- "1 month" and "3 months" are calendar months from the day stored.
- Any storage charge is included in the hand-typed agreed price.
- Real evidence still missing from `docs/PROBLEM.md`: how many loads a
  busy day has, and when a load, payment or stored grain last slipped
  through. Ask the Monitor.
