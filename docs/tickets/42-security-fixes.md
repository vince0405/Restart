# 42 — Fixes from the security and bug test

**What to build:** Fix every issue found in the 16 Oct 2026 test. The full
report is in `docs/SECURITY-REPORT.md`.

**Blocked by:** 41

**Status:** built — 023 run in Supabase; check on the live URL

## Checklist

- [x] Reset links can only lead to /reset-password or / (no open redirect)
- [x] At most 3 waiting requests per customer
- [x] No payment above what is still owed; no removing payments once
      released; "Remove" asks first
- [x] Supply can't go below zero (checked and added up in the database)
- [x] Statistics, dashboard and supply count every job, past 1,000
- [x] A page past the end shows the last page
- [x] Closed requests can't change; waiting ones only accept / reject
- [x] Fee can't change after release or payout
- [x] New dryer load made and joined in one step
- [x] Password change needs the current password; sign-up needs 8+
- [x] Old settings row hidden; accounts without a co-op get their own page
- [x] Clear messages for long names, impossible dates, "Infinity" rates
- [x] Every fix re-tested in rolled-back transactions; full workflow (15
      steps) still passes; 120 unit tests pass
- [ ] Works on the live URL, on a phone

## Not in this ticket

- Verifying mobile numbers and emails at sign-up (needs Ticket 33)
