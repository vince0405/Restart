# 27 — A discount stays after the next count

**What to build:** When staff change a job's fee (a discount, or an extra
charge), the change survives the next count. Before, the harvest or drying
count worked the fee out again from the price list and wiped the discount.

**Blocked by:** 25

**Status:** built — waiting for 012 to be run in Supabase

## How it works

The database saves the difference between the fee staff typed and the
price list so far, as `fee_adjustment` (negative = discount).

Example: after the harvest count the price list says ₱27,000. Staff change
the fee to ₱26,000, so the adjustment is −₱1,000. After drying, milling adds
₱11,400: the list total is ₱38,400 and the fee is **₱37,400**, so the
discount is kept.

- Only the database sets `fee_adjustment`; no role can type it in.
- Changing the fee again replaces the adjustment.
- The fee never goes below ₱0.
- Before the harvest count there is no list price yet, so a fee typed for
  a harvesting job is still replaced at the count (as today).
- The audit log (Ticket 26) already records every fee change: that is the
  discount history.

## Checklist

- [x] `fee_adjustment` column and the price trigger keep it (012)
- [x] Jobs that already have a changed fee keep it (012 fills in their
      adjustment)
- [x] Tested rule in `src/lib/pricing.ts`
- [x] The job screen shows "Discount" or "Extra charge"
- [ ] The team has run 012 in Supabase
- [ ] Works on the live URL, on a phone
