# 13 — Each role only gets its own buttons

**What to build:** On job screens, each role sees only the buttons it may
use, and the database refuses anything else. Operators move steps and
store; only Monitors and the Chairperson record payments, delete or log
walk-in jobs; Auditors only look. Customers see a read-only timeline of
their own job.

**Blocked by:** 12

**Status:** todo

- [x] A database check stops each role changing columns it is not allowed
      to (e.g. an Operator changing payment fields is refused)
- [x] Buttons are hidden for roles that may not use them
- [x] Customer job detail: timeline, status, agreed price, what they owe
- [x] Auditor sees every screen with no buttons that change anything
- [ ] Works on the live URL
