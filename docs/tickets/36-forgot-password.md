# 36 — Forgot password, without the Chairperson

**What to build:** A person who forgot their password can reset it
themselves. If their account has an email, they get a reset link by
email. If it only has a mobile number, they get a one-time code by SMS.

**Blocked by:** 21, and 33 for the SMS part

**Status:** part 1 built — the team must add the live URL in Supabase (below); part 2 waits for Ticket 33

## Two parts

### Part 1: email (no new service)
Supabase can already send password reset emails. This part only works
for people who added an email.

- [x] A "Forgot password?" link on the sign-in page
- [x] Entering an email sends a reset link; the link opens a "Choose a new
      password" page
- [x] The page says the same thing whether or not the email exists, so
      it cannot be used to find out who has an account
- [ ] The reset link's address is set in Supabase's Auth settings to the
      live Vercel URL (not localhost)
- [ ] Works on the live URL, on a phone

**Team to do (dashboard, once):** Supabase -> Authentication -> URL
Configuration: set **Site URL** to `https://restart-cyan.vercel.app` and
add `https://restart-cyan.vercel.app/**` under **Redirect URLs**.
Without it the email link points at localhost or is refused.

Only accounts that **sign in with an email** can use this (19 of 25 on
15 Oct 2026). Mobile-number accounts sign in with an internal `.invalid`
name that has no inbox, so the page tells them to ask the Chairperson.
The link must be opened in the same browser that asked for it; to make
it work on any device, change the "Reset Password" email template's link
to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
(`/auth/confirm` already accepts both).

### Part 2: mobile number (needs an SMS service)
- [ ] Only after Ticket 33's SMS provider is agreed: a 6-digit code is
      texted to the number, expires after 10 minutes, and can only be
      tried a few times
- [ ] Works on the live URL with a real phone

The Chairperson's reset in People stays as a backup.

## Not in this ticket

- Proving a mobile number at sign-up (see `docs/LATER.md`)
