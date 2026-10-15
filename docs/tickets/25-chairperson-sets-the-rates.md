# 25 — The Chairperson sets the rates

**What to build:** The price list (15% harvest share, ₱9,000 per dryer load
of up to 130 sacks, ₱120 per milling sack) moves out of the code and into
Settings, where only the Chairperson can change it.

**Blocked by:** 24

**Status:** done

- [x] Four new `settings` columns with safe defaults and checks (010)
- [x] The database price trigger reads the rates from `settings`
- [x] `src/lib/pricing.ts` takes the rates as an input; unit tests cover a
      changed rate
- [x] The Settings page has a "Price list" section (Chairperson only)
- [x] The price list on the intake form and the job screen show the
      current rates
- [x] A rate change does not change fees already worked out
- [x] The team has run 010 in Supabase
- [x] Works on the live URL, on a phone

Already done in Ticket 24: the harvest count's market price starts filled
in with the farmgate reference price from Settings.

## Not in this ticket

- A history of past rates (the audit log in Ticket 26 records each change)
