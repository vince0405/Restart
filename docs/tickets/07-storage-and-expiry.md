# 07 — Store at the mill, with expiry warnings

**What to build:** When a load is Ready, the Monitor can either release it
or store it at the mill. Stored palay keeps 3 months and stored rice keeps
1 month. The list warns before stored grain expires.

**Blocked by:** 06

**Status:** todo

- [x] At Ready, the detail screen offers "Release" and "Store at the mill"
- [x] Storing records the date and moves the load to Stored
- [x] The detail screen shows what is stored (palay or rice), the date
      stored and the expiry date
- [x] Rice is anything from Package Deal or Milling only; everything else
      is palay
- [x] The list shows "Expires in N days" for stored loads, highlighted at
      7 days or fewer, and "Expired" once past
- [x] A stored load can be released
- [ ] Works on the live URL — on a phone
