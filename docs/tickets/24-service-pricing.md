# 24 — Price list: the app works out the fee

**What to build:** The app works out each job's fee from the co-op's price
list, so staff don't have to calculate it. Staff can still change the fee
(for example, to give a discount).

**Blocked by:** 22

**Status:** todo

## The price list

| Service step | Price | Which count |
|---|---|---|
| Harvesting | **15% of the harvest kg × market price of palay per kg** | Real kg recorded after harvesting |
| Drying | **₱9,000 per dryer load**. One load holds up to 130 sacks. Under 120 sacks still costs ₱9,000. Over 130 sacks needs another load. | Sacks going into the dryer (the harvest count, or the sacks on the form for Drying only) |
| Milling | **₱120 per sack** | Sacks counted after drying (the sacks on the form for Milling only) |

- Dryer loads = sacks ÷ 130, rounded up, with a minimum of 1.
  For example, 50 sacks → 1 load, 125 → 1, 131 → 2, 200 → 2.
- **Package Deal** = harvesting + drying + milling, added together.
- **Harvesting + Drying** = harvesting + drying.

## The harvesting fee

The harvesting fee is always worked out in pesos:

    harvest fee = 15% × harvested kg × market price of palay per kg

The market price changes, so staff type it in when they record the harvest
count. It starts filled in with the farmgate reference price from Settings.
The farmer can pay the fee in cash, or in palay worth the same amount.

## Worked example (Package Deal)

The harvest is 100 sacks, weighed at 6,000 kg. After drying, there are 95 sacks.

- Harvesting: 15% × 6,000 kg = 900 kg; 900 kg × ₱20 market price = **₱18,000**
- Drying: 100 sacks = 1 load = **₱9,000**
- Milling: 95 × ₱120 = **₱11,400**
- Total fee = ₱18,000 + ₱9,000 + ₱11,400 = **₱38,400**

## Checklist

- [x] Price rules live in `src/lib/` as plain functions, with unit tests
      (including the worked example above)
- [x] After each count (harvest, drying), the suggested fee is filled in and
      staff can change it
- [x] Drying only and Milling only fill in the fee as soon as the job is logged
- [x] The harvest count form asks for today's market price per kg
      (pre-filled from Settings)
- [x] The job screen shows the breakdown (harvest, drying, milling)
- [x] A job can't be released until the fee is paid (or covered by a buyout)
- [x] Any new columns go in a numbered SQL file in `supabase/sql/`, with RLS
      policies to match (009)
- [ ] The team has run 009 in Supabase
- [ ] Works on the live URL, on a phone

## Not in this ticket (park in LATER.md if wanted)

- A screen to edit the rates (₱9,000, ₱120, 15%). For now they are fixed in code.
