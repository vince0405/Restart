# 23 — Statistics on the Money page

**What to build:** Below the money totals, a Statistics section for the
Chairperson, Monitor and Auditor: a 6 months / 12 months / All filter,
headline tiles (fees, share collected as a meter, average fee, grain
bought), a "Fees per month" chart (collected vs still owed) and a "Jobs by
service" chart, each with a table view.

**Blocked by:** 17

**Status:** todo

- [x] One tested function, `moneyStats`, using the same `settlement()` maths
      as the rest of the Money page; grouped by the month the job was logged
- [x] Chart colours validated (lightness band, colour-blind separation, 3:1)
      in light and dark; stored as `--chart-1` / `--chart-2`
- [x] Legend for two series, hover + keyboard tooltips, "Show as table"
- [x] Checked by screenshot at 360px wide, light and dark
- [ ] Works on the live URL — on a phone
