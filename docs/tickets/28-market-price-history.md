# 28 — A history of market prices

**What to build:** Every time the Chairperson changes the farmgate
reference price in Settings, the old price is kept with the date it
applied. Staff and the Auditor can see a simple list ("₱24.00 from 3 Oct,
₱25.50 from 12 Oct"), and each harvest count shows which reference price
it started from.

**Blocked by:** 25, 26

**Status:** built — 013 run in Supabase; check on the live URL

- [x] SQL file adds a `price_history` table (price, from date, set by);
      RLS on, with policies: staff and Auditor can read, only the
      Chairperson can add
- [x] Changing the reference price in Settings adds a row to the history
- [x] Settings shows the price history, newest first; so does the Money
      page, for the Monitor and the Auditor
- [x] The harvest count still starts filled in with today's reference
      price, and can still be changed by hand
- [x] The team has run the SQL in Supabase
- [ ] Works on the live URL, on a phone

## Not in this ticket

- Looking up palay prices from the internet automatically. There is no
  free, reliable public source for local palay prices, and it would need
  a new service. Talk to the team first.
- A chart of prices over time
