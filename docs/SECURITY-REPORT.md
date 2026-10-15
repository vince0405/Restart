# RPS1 — Security and bug test report

**Date:** 16 Oct 2026 · **Scope:** the live app (https://restart-cyan.vercel.app),
its Supabase database, and the code in `src/` · **Fixes:** Ticket 42,
`supabase/sql/023-security-fixes.sql`

## How it was tested

1. **Automated checks** — 120 unit tests, TypeScript, lint and a production
   build (all pass).
2. **Outsider attack** — the live database called directly with the public
   key every browser has, signed out: read and write every table, call every
   database function.
3. **Insider attacks** — the database driven as a real customer, Operator,
   Monitor, Chairperson of another co-op and Auditor, trying to see or change
   what each must not. Every test ran inside a transaction that was rolled
   back, so no real data changed.
4. **Live site** — security headers, signed-out access to every staff page,
   error-text injection, redirect tricks.
5. **Code review** — every server action, page and shared function read for
   logic bugs and unsafe handling.

## Results at a glance

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Open redirect after a password-reset link | Medium | **Fixed** |
| 2 | One customer could block every booking day | Medium | **Fixed** |
| 3 | Overpayments accepted and silently lost | Medium | **Fixed** |
| 4 | Payment could be removed after the rice was released | Medium | **Fixed** |
| 5 | Supply could be taken below zero (direct database call or two people at once) | Medium | **Fixed** |
| 6 | Totals wrong past 1,000 jobs (Statistics, dashboard, supply) | Medium | **Fixed** |
| 7 | Page past the end of a list showed "Could not load" | Low | **Fixed** |
| 8 | Cancelled / rejected requests could still be moved through the steps | Low | **Fixed** |
| 9 | Fee could change after release or payout | Low | **Fixed** |
| 10 | "Remove payment" had no "are you sure?" | Low | **Fixed** |
| 11 | Failed "new dryer load" left empty dryer loads behind | Low | **Fixed** |
| 12 | Password change didn't ask for the current password | Low | **Fixed** |
| 13 | Sign-up allowed 6-character passwords (everywhere else 8) | Low | **Fixed** |
| 14 | Every co-op could read Batad's old settings row | Low | **Fixed** |
| 15 | Walk-in names over 120 characters gave a vague error | Low | **Fixed** |
| 16 | "Infinity" accepted as a rate in Settings | Low | **Fixed** |
| 17 | Impossible payment dates (31 Feb) gave a vague error | Low | **Fixed** |
| 18 | Accounts with no co-op were only stopped by the page layout | Info | **Fixed** |
| 19 | Sign-ups don't prove they own the email or mobile number | Medium | **Not fixable yet** — see below |
| 20 | Sign-up says when a mobile number already has an account | Info | **Accepted** — see below |

## The findings in detail

### 1. Open redirect after a password-reset link — fixed
`src/app/auth/confirm/route.ts`. The link's `next` value was only checked
for a leading `/`. A backslash (`/\evil.com`) or a hidden tab or newline
(`/%09/evil.com`) passed the check, and the browser then treated it as
another website. An attacker could ask Supabase for a genuine reset email
for a victim (or send their own sign-in link), and after clicking it the
victim would land on a look-alike site asking for their password.
**Fix:** `next` must be exactly `/reset-password` or `/`; only "recovery"
links are accepted. Tested: every trick now stays on RPS1.

### 2. One customer could block every booking day — fixed
Nothing limited how many waiting requests one person could have, so one
account filled 12 days in a row (and with bookings-per-day = 1, nobody else
could book them). **Fix (023):** at most **3 waiting requests per
customer**, checked by the database with a lock so a burst can't slip past.
Tested: the 4th request is refused with a clear message.

### 3. Overpayments accepted and lost — fixed
A ₱50,000 payment on a ₱9,000 fee was accepted; the extra was counted as
"received" but never shown as change or credit. **Fix (023):** the database
refuses a payment above what is still owed (the job is locked while
checking, so two payments at once can't both slip under); the form also has
a maximum. Tested: overpayment refused, exact and part payments work.

### 4. Payment removable after release — fixed
Removing a payment after the job was released left a "Released but unpaid"
job, quietly undoing the "no release until paid" rule. **Fix (023):** the
database refuses to remove a payment on a released or paid-out job
(deleting a whole job still removes its payments). The "Remove" button now
asks "Remove this ₱… payment?" first.

### 5. Supply below zero — fixed
Only the app checked take-outs; an Operator calling the database directly
recorded "−999,999 kg rice", and two people taking the last kilos at once
could both succeed. **Fix (023):** the database works the supply out itself
(`supply_levels()`) and refuses taking out more than there is, under a
lock. Tested: refused; normal add and take-out still work.

### 6. Totals wrong past 1,000 jobs — fixed
Supabase returns at most 1,000 rows per request, so Statistics, the
dashboard and the supply levels would silently under-count once a co-op had
more jobs. **Fix:** Statistics and the dashboard now fetch every job in
pages of 1,000 (`src/lib/fetch-all.ts`, with tests); supply totals are added
up in the database.

### 7–18. Smaller fixes
- **7** — Asking for a page past the end (e.g. `/loads?page=50`) now shows the
  last page instead of "Could not load".
- **8** — Rejected or cancelled requests can't be changed at all; waiting
  requests can only be accepted or rejected (database guard + the actions).
- **9** — The fee can't change after release or payout (database guard).
- **11** — A new dryer load is created and joined in one database step, so a
  failure leaves nothing behind.
- **12** — Changing your password now needs your current password, so
  someone who picks up a phone left signed in can't lock the owner out.
- **13** — Sign-up needs at least 8 characters, like the rest of RPS1.
- **14** — The old single settings row (Batad's, before co-ops) is hidden;
  nothing uses it.
- **15–17** — Clear messages instead of "Could not save" for long names,
  impossible dates and "Infinity" rates (with tests).
- **18** — An account with no co-op is sent to its own page from every
  co-op page and action, not just stopped by the layout.

### 19. Sign-ups are not verified — not fixable yet
All 31 accounts were confirmed without any email being sent: Supabase's
email confirmation is off, and mobile numbers can't be confirmed without an
SMS service. So someone can register a farmer's number before the farmer
does, or make several fake customers. Turning email confirmation on would
lock out every mobile-number account. **Limits in place:** 3 waiting
requests per account; staff accept or reject every request; the
Chairperson controls roles. **Real fix:** an SMS provider (Ticket 33), then
a one-time code at sign-up.

### 20. Sign-up reveals registered numbers — accepted
"That mobile number already has an account" lets someone check whether a
number is registered. Hiding it would confuse real farmers (they sign in
with that number). Forgot-password does **not** reveal accounts.

## What was tested and found solid

- **Signed-out visitors** can't read or change any table or call any
  sensitive function; only the co-op name list (for sign-up) is public.
  Every staff page, `/admin` and receipts send them to sign-in.
- **Customers** see only their own jobs, payments and profile; can't
  change prices, payments, stages or their own role, co-op, member or
  "pay later" flags; a request they send is forced to "waiting" with the
  price-list fee, whatever the form says.
- **Operators and Monitors** can't change fees, take payments, approve
  buyouts, delete jobs or change roles beyond their role.
- **Co-ops are separate:** a Chairperson of one co-op can't read, edit,
  pay, rename or change roles in another (tested in the co-op work, 018).
- **The Auditor** can look at everything in their co-op and change nothing.
- **No database text** reaches users; error messages are fixed sentences.
  React escapes all user text; the Maps and phone links are built safely.
- **No secret keys** in the code; `.env.local` is not committed; only the
  Supabase URL and public key reach the browser.
- **Security headers** on every page (no framing, no type guessing,
  referrer policy, no camera/microphone/location).
- **All 10 tables** have Row Level Security on with policies.

## Added afterwards (Ticket 44, 16 Oct 2026)

- **Content-Security-Policy** on every page: scripts run only with a fresh
  one-time nonce per request, so an injected script would be refused;
  data only from this site and our Supabase project; no framing; forms
  only post here. Tested: nothing blocked on the public pages.
- `X-Powered-By: Next.js` removed; Cross-Origin-Opener-Policy added.
- Signed-out visitors can no longer call the "who am I?" helpers.
- Own profile edits are checked: no blank names, mobile numbers only in
  the standard form.

## Still worth doing later

- An SMS provider (Ticket 33) to verify mobile numbers and allow resets.
- Supabase dashboard → Authentication: keep the built-in sign-in rate
  limits on, and set the Site URL / Redirect URLs (Ticket 36).
- Run `/code-review` after the next big change.
