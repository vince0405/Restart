# 30 — Pay the harvest fee in palay

**What to build:** At the harvest count, staff choose whether the farmer
pays the 15% harvest share **in pesos** (as today) or **in palay**. If in
palay, the co-op keeps 15% of the harvested kilos, the farmer's grain is
reduced by that amount, and the harvest fee in pesos becomes ₱0.

**Blocked by:** 22, 24

**Status:** built — 015 run in Supabase; check on the live URL

## How it works

Example: the harvest count is 2,000 kg.
- In pesos: fee = 15% × 2,000 kg × market price; the farmer keeps 2,000 kg.
- In palay: fee = ₱0; the co-op keeps 300 kg; the farmer's grain is 1,700 kg.

Drying and milling are then worked out on the farmer's 1,700 kg.

## Checklist

- [x] SQL file adds a "harvest fee paid in" choice (pesos or palay) and
      the kilos kept by the co-op; only the database works out the kilos
- [x] The price trigger sets the harvest fee to ₱0 when paid in palay
- [x] The rule lives in `src/lib/pricing.ts`, with unit tests
- [x] The harvest count form has the choice; the job screen and the
      customer's view show "Harvest share paid in palay: 300 kg"
- [x] The Money page counts palay kept separately from pesos
- [x] The team has run the SQL in Supabase
- [ ] Works on the live URL, on a phone

## Notes

- The co-op also keeps the same share of the **sacks** (rounded to whole
  sacks), because drying is priced per sack. Change this in both
  `harvestShareInPalay()` and 015 if the co-op counts it differently.
- The market price is still asked for at the count, for the record.

## Not in this ticket

- Paying drying or milling fees in palay or rice
- Tracking where the co-op's kept palay goes after that
