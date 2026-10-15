# 22 — Count sacks after harvesting and after drying

**What to build:** For Package Deal and Harvesting + Drying, the customer
doesn't enter sacks or weight (nobody knows them before the harvest). Staff
record the sacks and weight when they finish Harvesting, and again when they
finish Drying (dried palay is lighter and may fill fewer sacks).

**Blocked by:** 06

**Status:** todo

- [x] Request and walk-in forms hide sacks / weight for harvesting services
      (still required for Drying only and Milling only)
- [x] "Move to …" from Harvesting or Drying requires the new sacks and kg
- [x] Screens say "To be counted after harvest" until the first count
- [x] SQL 008 lets Operators change `sacks` and `kilos` (nothing else new)
- [ ] The team has run 008 in Supabase
- [ ] Works on the live URL — on a phone
