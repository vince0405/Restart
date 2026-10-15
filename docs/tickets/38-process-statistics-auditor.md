# 38 — "Process" and "Statistics", and a read-only Auditor

**What to build:** Rename two staff screens, and make sure the Auditor can
look at everything in their co-op but change nothing.

**Blocked by:** 37

**Status:** built — 020 run in Supabase; check on the live URL

## Checklist

- [x] "Jobs" is called **Process** (menu, page title, breadcrumb, History
      filter). The address stays `/loads`, so old links still work.
- [x] "Money" is called **Statistics** (menu and page title). The address
      stays `/money`. The customer's own "Money" box on their job is
      unchanged.
- [x] Every screen shows the Auditor a "Read-only" note
- [x] App: no action lets the Auditor change anything (each one requires
      a worker, manager, Chairperson or customer role), and no edit
      button is shown to them
- [x] Database (020): the job guard refuses every change from an
      Auditor — this closes the one gap found: an Auditor who was also
      the customer of a job could still make its keep / sell / split
      choice or cancel their own request
- [x] Tested in a rolled-back transaction: an Auditor could read jobs but
      could not edit a job (even their own), add a request, a payment,
      supply or a dryer load, change the co-op's settings, or change
      anyone's role, including their own; the Chairperson could still edit
- [ ] Works on the live URL, on a phone

## Not in this ticket

- The Auditor can still change their **own** password and name under
  Account: that is their personal account, not the co-op's records.
