# 15 — Customer chooses keep, sell or split

**What to build:** Once weighed, the customer chooses Keep 100%, Sell 100%
or Split (keep X%). Staff can choose for walk-in jobs. Keeping leads to the
existing pay / store / release flow; selling asks the co-op for a buyout.

**Blocked by:** 14

**Status:** todo

- [ ] SQL file adds `disposition`, `keep_percent`, `buyout_status`; the team
      has run it
- [ ] Choice screen shows the kg kept and kg offered for sale
- [ ] Keep 100%: no buyout; the job continues to payment, storage, release
- [ ] Sell or split: buyout status becomes Requested and shows on the
      Chairperson's dashboard
- [ ] A customer can only choose for their own Ready, weighed job, once
- [ ] Works on the live URL — on a phone
