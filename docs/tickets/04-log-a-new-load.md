# 04 — Log a new load

**What to build:** From the loads list, the Monitor taps "+ New load",
fills in customer name, sacks, kilos, service type and agreed price, and
saves. The load appears at the top of the list as Received / Not paid.

**Blocked by:** 03

**Status:** todo

- [x] The team has confirmed the service-type list (see "Assumptions to
      check" in the spec)
- [x] The form has customer name, sacks, kilos, service type (picked from
      a list) and agreed price
- [x] Empty or negative values are refused with a clear message
- [x] A saved load appears at the top of the list showing customer, sacks,
      stage "Received" and a "Not paid" badge
- [x] The load is still there after refreshing the page
- [ ] Works on the live URL — on a phone
