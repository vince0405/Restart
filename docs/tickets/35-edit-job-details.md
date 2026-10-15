# 35 — Fix a job's details after saving

**What to build:** Staff can correct a job's details after it is saved:
customer name, service type, farm address and note. They no longer have
to delete the job and enter it again.

**Blocked by:** 13, 26

**Status:** built — 014 run in Supabase; check on the live URL

## Rules

- Only staff (Chairperson and Manager) can edit details; customers and
  Operators cannot.
- The service type can only be changed while the job is still at its
  first stage, because changing it later would break the steps already
  done and the fee.
- Counts, fees and payments are **not** edited here; they keep their own
  screens and rules.
- Every edit shows up in the history of changes (Ticket 26).

## Checklist

- [x] SQL file lets staff change these columns (and only these), with a
      guard that refuses a service-type change after the first stage
- [x] An "Edit details" button and form on the job screen (staff only)
- [x] If the service type changes, the fee is worked out again from the
      price list
- [x] The history of changes shows the old and new values
- [x] The team has run the SQL in Supabase
- [ ] Works on the live URL, on a phone

## Notes

- 014 also repaired the live update guard, which had gone back to the 006
  version (no harvest-count price, no operator counts, no "pay before
  release"). Tested in a rolled-back transaction as the Chairperson.
- "Staff" here means the Monitor and the Chairperson (`canManage`).

## Not in this ticket

- Moving a job to a different customer account
- Editing counts or fees after they are recorded
