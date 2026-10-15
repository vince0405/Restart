# 07 — Store at the mill, with expiry warnings

**What to build:** When a load is Ready, the Monitor can either release it
or store it at the mill. Stored palay keeps 3 months and stored rice keeps
1 month. The list warns before stored grain expires.

**Blocked by:** 06

**Status:** todo

- [ ] At Ready, the detail screen offers "Release" and "Store at the mill"
- [ ] Storing records the date and moves the load to Stored
- [ ] The detail screen shows what is stored (palay or rice), the date
      stored and the expiry date
- [ ] Rice is anything from Package Deal or Milling only; everything else
      is palay
- [ ] The list shows "Expires in N days" for stored loads, highlighted at
      7 days or fewer, and "Expired" once past
- [ ] A stored load can be released
- [ ] Works on the live URL — on a phone
