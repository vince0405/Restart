# 18 — Customer cancels their own pending request

**What to build:** A customer can cancel their own request while it is
still Pending, within the co-op's cancel window (default 2 hours; the
Chairperson sets 1–24 in Settings). Once staff accept or reject it, or the
window passes, it can no longer be cancelled.

**Blocked by:** 12

**Status:** todo

- [x] SQL file 006 adds `cancel_window_hours`, `cancelled_at`, `cancelled_by`
      and the `cancelled` status; the database enforces ownership, Pending
      and the time limit using its own clock
- [x] Customers can no longer choose their own `created_at` / `owner_id`
      (found while testing: backdating jumped the Requests queue)
- [ ] The team has run 006 in Supabase
- [x] Customer job screen: "You can cancel until …", a Cancel button with an
      "Are you sure?" step, hidden once the window has passed
- [x] A cancelled request shows a grey "Cancelled" card and badge; staff see
      a short banner and no buttons; it leaves Requests, Jobs and totals
- [x] Settings: the Chairperson sets the cancel window (1–24 hours)
- [ ] A customer cannot cancel someone else's request, an accepted one, or a
      late one — even by calling the database directly
- [ ] Works on the live URL — on a phone
