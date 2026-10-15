# 31 — Payment records and receipts

**What to build:** A job can have more than one payment. Each payment
records the amount, the date, the method (cash, GCash, Maya, bank) and a
reference number when there is one. The customer and staff can open a
simple receipt page for each payment and print or screenshot it. The
Chairperson can mark a member as trusted, so their job can be released
before it is fully paid.

**Blocked by:** 08, 24

**Status:** built — 017 run in Supabase; check on the live URL

## Checklist

- [x] SQL file adds a `payments` table (job, amount, paid on, method,
      reference, recorded by); RLS on, with policies: staff record
      payments, customers read only their own, the Auditor reads all
- [x] Existing paid amounts are moved into the new table, so no money
      is lost
- [x] The amount owed = fee − all payments; the job is paid when it
      reaches ₱0
- [x] A receipt page per payment (co-op name, customer, job, amount,
      date, method, reference)
- [x] Settings or People: the Chairperson can mark a member as trusted
      ("pay later"); the database allows release while owing only for
      trusted members
- [x] The Money page uses the payments table
- [x] The team has run the SQL in Supabase
- [ ] Works on the live URL, on a phone

## Notes

- The database keeps `loads.amount_paid` / `is_paid` equal to the total
  of the job's payments, so the release check, dashboards and Money totals
  work unchanged. Nobody can type those two in any more.
- "Mark paid" / "Mark not paid" are replaced by "Record a payment" and
  "Remove" (a payment recorded by mistake; it stays in the history).
- "Pay later" is a checkbox per person on the People page (Chairperson).
- Tested in a rolled-back transaction: two payments added up on the job;
  "recorded by" is set by the database; customers could not record
  payments, mark themselves trusted or see other people's payments.
  **Not yet tested:** removing a payment, and deleting a job that has
  payments — please try both on a test job on the live site.

## Not in this ticket

- Taking payments online through GCash, Maya or a card. That needs a
  payment gateway, which is a new paid service. Talk to the team first.
  This ticket only **records** payments made outside the app.
- Official BIR receipts
