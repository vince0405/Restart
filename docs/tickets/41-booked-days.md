# 41 — A day that is already booked can't be booked again

**What to build:** A customer's preferred date is a booking. When a day is
already booked, other customers can't request it.

**Blocked by:** 11, 34, 40

**Status:** built — 022 run in Supabase; check on the live URL

## Checklist

- [x] A day is full when it has as many pending or accepted requests as
      the co-op's **bookings per day** (default 1; Chairperson sets it in
      Settings, 1–50). Rejected and cancelled requests free the day.
- [x] The database refuses a request for a full day, or a day in the
      past, so a tampered form can't skip it; a short lock stops two
      customers taking the last place at the same moment
- [x] The request form lists the days already booked in the next two
      months (dates only — never who booked them); picking one shows
      "That day is already booked. Please choose another day."
- [x] Each co-op's days are separate
- [x] Tested in a rolled-back transaction: B was refused A's day, could
      book the next day, was refused a past day, got the day after A
      cancelled; with 2 per day a second booking was accepted
- [ ] Works on the live URL, on a phone

## Notes

- The preferred date is still optional: a request with no date books
  nothing.
- Walk-in jobs typed in by staff have no preferred date, so they don't
  fill a day.

## Not in this ticket

- A calendar that greys out full days inside the date picker (phones'
  built-in date pickers can't do that; the list under the field does)
- Booking limits per service (e.g. 2 harvests but 5 dryings a day)
