# 06 — Four services, each with its own steps

**What to build:** When logging a load, the Monitor picks one of four
services, and the load then follows only that service's steps:

- Package Deal: Harvesting → Drying → Milling → Ready → Released
- Harvesting + Drying: Harvesting → Drying → Ready → Released
- Drying only: Received → Drying → Ready → Released
- Milling only: Received → Milling → Ready → Released

This replaces the fixed six stages from ticket 05.

**Blocked by:** 05

**Status:** todo

- [x] A numbered SQL file updates the database: the four services, the
      new step names, a `stored_at` column, and any existing loads moved
      to the nearest new step. The team has run it in Supabase.
- [x] The New load form offers all four services
- [x] A new load starts at the first step of its service
- [x] The detail screen shows only that service's steps, and "Move to"
      and "Back one step" follow them
- [x] A Drying only load never shows Harvesting or Milling
- [x] The list shows the service and current step for each load
- [ ] Works on the live URL — on a phone
