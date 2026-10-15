# Spec: RPS1 — Batad Multipurpose Cooperative

Follows the team's user-flow chart (`User-Flow.drawio`). Phase 1 is what we
build now; Phases 2–3 are in `docs/LATER.md`.

Team decision (2026-10-15): this goes beyond the workshop's "one type of
user" rule, on purpose, to follow the flowchart.

## Problem
Batad Multipurpose Cooperative owns a rice mill. Its chairperson (my mother)
has to keep track of every job: who asked for what service, what step it is
at, how much came out, what is stored and when it goes bad, who has paid,
and which grain the co-op bought. Today that lives in a notebook, slips,
memory and messages to staff, and customers have to come by or call to find
out where their palay is.

## Solution
One app, five roles. Customers request a service and follow their job from
their own phone. Co-op staff accept requests, move each job through only its
service's steps, weigh the finished batch, and keep stored grain from
expiring. When the grain is ready, the customer chooses to keep it, sell it
to the co-op, or split it; the co-op approves any purchase and the app works
out the net payout after fees.

## The users (roles)
Everyone signs up as a **Customer**. Only the Chairperson can make someone a
Member or give them a staff role.

| Role | Who |
|---|---|
| Customer | Any farmer who wants palay dried or milled. Members are flagged and listed first. |
| Operator | Mill staff doing harvesting, drying, milling, weighing. |
| Monitor | Staff in charge of monitoring all jobs, requests and payments. |
| Chairperson | Head of the co-op. Everything the Monitor can do, plus buyouts, people and settings. |
| Auditor | Checks the records. Sees everything, changes nothing. |

### Who may do what
| Action | Customer | Operator | Monitor | Chairperson | Auditor |
|---|---|---|---|---|---|
| Request a service | ✅ own | | | | |
| See jobs | own only | all | all | all | all (read-only) |
| Accept / reject requests | | | ✅ | ✅ | |
| Log a walk-in job (no account) | | | ✅ | ✅ | |
| Move steps, weigh batch, store | | ✅ | ✅ | ✅ | |
| Choose keep / sell / split | ✅ own | | ✅ walk-ins | ✅ walk-ins | |
| Record processing payments | | | ✅ | ✅ | |
| Approve or decline a buyout, record payout | | | | ✅ | |
| Delete a mistaken job | | | ✅ | ✅ | |
| Manage people (member flag, roles) | | | | ✅ | |
| Edit settings (farmgate price) | | | | ✅ | |

The database enforces this table (Row Level Security plus checks on which
columns each role may change), not just the screens.

## Services and their steps
| Service | Steps |
|---|---|
| Package Deal | Harvesting → Drying → Milling → Ready → Released |
| Harvesting + Drying | Harvesting → Drying → Ready → Released |
| Drying only | Received → Drying → Ready → Released |
| Milling only | Received → Milling → Ready → Released |

- A request starts as **Pending**; accepted requests start at the first step;
  rejected requests stop, with a reason the customer can read.
- A customer may **cancel** their own request while it is still Pending and
  within the co-op's **cancel window** (default 2 hours, the Chairperson sets
  1–24). The database checks this with its own clock.
- At **Ready** the batch is weighed (output kg). The output is **rice** if the
  service mills, otherwise **palay**.
- Kept grain may be **Stored** at the mill: rice lasts **30 days**, palay
  **3 months**; a warning shows at **14 days** left.

## Keep, sell or split (disposition)
At Ready the customer (or staff, for walk-ins) chooses:
- **Keep 100%** — pay the processing fee, claim or store the grain.
- **Sell 100%** — ask the co-op to buy everything.
- **Split** — keep X%, sell the rest.

For any selling, the Chairperson **approves** (price per kg, pre-filled from
the farmgate reference price) or **declines** (the customer must then claim
all of it). On approval the app shows:

    sale value  = kg sold × price per kg
    net payout  = sale value − processing fee
    (if the fee is bigger than the sale value, the customer still owes the difference)

The Chairperson marks the payout as paid out. Bought grain counts in the
co-op's own **stock**.

## User stories (Phase 1)
1. As a Customer, I want to sign up and request drying, milling or a Package
   Deal, so that I don't have to go to the mill to book.
2. As a Customer, I want to see my request's status and my job's step, so
   that I know when my grain is ready without calling.
3. As a Monitor, I want to see incoming requests, members first, and accept
   or reject them, so that the mill's work is scheduled.
4. As an Operator, I want to move a job through its steps and record the
   output weight, so that the record keeps up with the real work.
5. As a Customer, I want to choose to keep, sell or split my grain, so that
   I can turn part of it into cash.
6. As the Chairperson, I want to approve or decline buyouts at a price per
   kg and see the net payout, so that the co-op only buys what it can afford.
7. As a Monitor, I want stored grain to warn me at 14 days left, so that no
   customer's grain goes bad.
8. As an Auditor, I want to see every job, payment and buyout without being
   able to change them, so that I can check the books.

## Screens
- **Sign in / Sign up** — email and password. New accounts are Customers.
- **Customer: My jobs** — a summary at the top (waiting, being processed,
  ready for my choice, stored with soonest expiry, what I owe and will be
  paid), then my requests and jobs with status, step, output
  weight, storage expiry, and what I owe or will be paid.
- **Customer: Request a service** — co-op (Batad Multipurpose Cooperative),
  service cards, sacks, estimated kg, preferred date, note.
- **Customer: Job detail** — timeline; at Ready, the keep / sell / split
  choice; buyout result and payout.
- **Staff: Dashboard** — as now, plus a "Requests" count.
- **Staff: Requests** — pending requests, members first, Accept / Reject
  (with reason).
- **Staff: Jobs, Job detail, New walk-in job, Storage** — as now, plus weigh
  batch, disposition and buyout sections; buttons appear only for roles
  allowed to use them.
- **Chairperson: People** — everyone's name, role and member flag; change
  them. **Settings** — farmgate reference price per kg.
- **Auditor** — the same staff screens, read-only, plus a **Money** summary:
  fees received, payouts made, outstanding balances, co-op stock (kg).

## Data
All tables have Row Level Security ON.

### `profiles` (new) — one row per account
| Column | Meaning |
|---|---|
| `id` | The account (same as the Supabase user) |
| `full_name`, `phone` | Shown to staff |
| `role` | `customer`, `operator`, `monitor`, `chairperson`, `auditor`. Starts as `customer` |
| `is_member` | Co-op member? Starts false |

Who: everyone reads their own row; staff and auditors read all; a user may
edit their own name and phone only; **only the Chairperson changes `role`
and `is_member`**.

### `settings` (new) — one row
`coop_name`, `farmgate_price_per_kg`, `rice_lifeline_days` (30),
`palay_lifeline_days` (90), `warning_days` (14). Everyone signed in reads;
only the Chairperson edits.

### `loads` (existing, extended)
Existing columns stay. New ones:
| Column | Meaning |
|---|---|
| `customer_id` | The customer's account. Empty for walk-ins |
| `request_status` | `pending`, `accepted`, `rejected` |
| `reject_reason` | Shown to the customer |
| `preferred_date`, `customer_note` | From the request |
| `output_kg` | Weighed at Ready |
| `disposition` | `keep`, `sell`, `split` |
| `keep_percent` | 100 for keep, 0 for sell, X for split |
| `buyout_status` | `none`, `requested`, `approved`, `declined` |
| `price_per_kg` | Agreed buyout price |
| `payout_done_at` | When the net payout was handed over |

Who: customers read and create **their own** rows only, and may change only
the disposition of their own Ready job; staff read all; Operators, Monitors
and the Chairperson change only the columns their role allows (see the table
above); Auditors read only. `owner_id` stops being "who can see it" — roles
decide that now.

## Login
Supabase Auth, email and password. **Public sign-ups turn back ON** so
customers can join. Every new account is a Customer; nobody can promote
themselves. The first Chairperson is set once by hand in Supabase.

## Done for the demo
On the live URL, with three phones or browser windows:
- [ ] A new customer signs up and requests a Package Deal.
- [ ] The Monitor sees it under Requests (a member's request listed first)
      and accepts it; a second request is rejected with a reason the
      customer can read.
- [ ] The Operator moves the job to Ready and records the output weight; the
      Operator has no payment or buyout buttons.
- [ ] The customer sees Ready and the weight, and chooses keep 70% / sell 30%.
- [ ] The Chairperson approves the buyout; both see the same net payout.
- [ ] Kept rice is stored and shows "30 days left"; the warning appears at 14.
- [ ] The Auditor sees everything and cannot change anything.
- [ ] A customer cannot see another customer's job, even by typing its address.
- [ ] Supabase shows RLS on for every table.

## Out of scope (Phase 1)
Many cooperatives and admin verification, SMS/push messages, an automatic
daily job, storage bins, reports and charts, payment methods and receipts,
grain grading — see `docs/LATER.md`.
