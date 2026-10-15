# 20 — Where to harvest (farm address)

**What to build:** For services that include Harvesting (Package Deal,
Harvesting + Drying), the customer — or a Monitor for a walk-in — gives the
farm address. Staff see it on Requests and the job page with an "Open in
Maps" link; the customer sees it on their own job.

**Blocked by:** 11

**Status:** todo

- [x] SQL 007 adds `harvest_address` (max 300 characters)
- [ ] The team has run 007 in Supabase
- [x] Required for harvesting services, ignored for drying / milling only
      (one tested function, `parseHarvestAddress`)
- [x] Shown on Requests, the staff job page and the customer's job page
- [ ] Works on the live URL — on a phone
