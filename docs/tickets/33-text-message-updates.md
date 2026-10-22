# 33 — Text message updates for customers

**What to build:** Customers get an SMS at the moments that matter:
their request is accepted or rejected, their rice is ready to claim, the
storage lifeline is nearly over (warning days from Settings), and a
buyout result.

**Blocked by:** team decision (needs an SMS service), 21

**Status:** todo

**Stop before building:** sending SMS in the Philippines needs an SMS
provider (for example Semaphore or a telco API). That is a new **paid
service**, outside the pinned stack. The team has to agree on the
provider and on who pays before any code is written. Its API key is a
secret: it lives only on the server (never `NEXT_PUBLIC_`) and never in
the repo.

## Checklist

- [ ] The team has chosen a provider and added its key in Vercel's
      environment variables (not in `.env.local` in git)
- [ ] Messages are sent from the server only
- [ ] One message per event per job (no repeats when a page reloads)
- [ ] Each message is short and in plain language, e.g. "RPS1: Your
      rice (Job 0142) is ready to claim at Batad MPC."
- [ ] A customer can turn texts off
- [ ] Sent messages are listed on the job screen for staff
- [ ] Works on the live URL: a real phone receives the text

## Not in this ticket

- Replying to texts
- Daily automatic checks (the lifeline warning can be sent when staff
  open the jobs list at first; a scheduled check can come later)
