# 19 — Customer dashboard on My jobs

**What to build:** At the top of My jobs, a customer sees a summary of their
own jobs: requests waiting for the co-op, jobs being processed, jobs ready
for their keep / sell / split choice, stored grain (with the soonest expiry),
and their money — what they owe and what the co-op will pay them.

**Blocked by:** 15

**Status:** todo

- [x] Counts come from the customer's own jobs only (RLS), via one tested
      function, `customerSummary`
- [x] "Ready: your choice" and a stored lot near expiry are highlighted
- [x] Money uses `settlement()`, the same maths as the job screen
- [ ] Works on the live URL — on a phone
