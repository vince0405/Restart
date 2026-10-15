# 29 — Farmers share one dryer load

**What to build:** Staff can put several jobs into one dryer load. The
₱9,000 load fee (or the current rate from Settings) is split between the
jobs by how many sacks each one has, so a farmer with 40 of the 130 sacks
pays 40/130 of the load, not a whole load.

**Blocked by:** 24, 25

**Status:** built — 016 run in Supabase; check on the live URL

## How it works

Example: a dryer load holds Job A (90 sacks) and Job B (40 sacks).
- Job A drying fee: 90/130 × ₱9,000 = ₱6,230.77
- Job B drying fee: 40/130 × ₱9,000 = ₱2,769.23

A job alone in the dryer is charged as today.

## Checklist

- [x] SQL file adds a `dryer_loads` table and a link from each job to its
      dryer load; RLS on, with policies (staff and Operators can create
      and fill a load, customers only see their own job's share)
- [x] A dryer load cannot hold more sacks than the maximum in Settings
- [x] The split rule lives in `src/lib/pricing.ts`, with unit tests
      (including rounding so the parts add up to the full fee)
- [x] The database price trigger uses the split, not a full load per job
- [x] The job screen says "Shared dryer load with 1 other job" and shows
      this job's share
- [x] The team has run the SQL in Supabase
- [ ] Works on the live URL, on a phone

## Notes

- A job joins or leaves a dryer load only while it is at the Drying step.
  Going back to fix the harvest count takes it out of the load.
- The fee is split by the sacks of the jobs in the load (not by the
  maximum), so the co-op always gets one full load fee per load.
- The split is worked out again when a job joins or leaves, not when the
  sacks are recounted after drying.
- Tested in a rolled-back transaction: 90 + 40 sacks gave P6,230.77 and
  P2,769.23; a full load, a job that is not drying and a direct call of
  share_dryer_load() were refused; a customer saw no dryer loads.

## Not in this ticket

- Scheduling the dryer (which load goes in when)
- Showing a customer the names of the other farmers in the load
