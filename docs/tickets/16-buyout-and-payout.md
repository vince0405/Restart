# 16 — Chairperson approves the buyout; net payout

**What to build:** The Chairperson approves a requested buyout at a price
per kg (pre-filled from the farmgate reference price) or declines it. The
app shows sale value, processing fee and net payout to both sides, and the
Chairperson marks the payout as handed over. Bought kg count as co-op stock.

**Blocked by:** 15

**Status:** todo

- [ ] SQL file adds `price_per_kg`, `payout_done_at`, and the farmgate price
      in `settings`; the team has run it
- [ ] The payout maths (sale value, fee, net, "still owes" when negative)
      lives in one tested function
- [ ] Approve shows the net payout; Decline tells the customer to claim
      all of it
- [ ] Chairperson can mark the payout as paid out
- [ ] Settings screen: the Chairperson edits the farmgate price
- [ ] Dashboard shows co-op stock (kg bought)
- [ ] Only the Chairperson can approve, decline or mark paid out
- [ ] Works on the live URL
