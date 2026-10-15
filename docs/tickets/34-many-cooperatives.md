# 34 — More than one cooperative

**What to build:** Other cooperatives can sign up and use RPS1 with
their own people, jobs, rates and settings. Nobody can see or change
another co-op's data. An Admin approves each new co-op before it can be
used.

**Blocked by:** all earlier tickets

**Status:** built — 018 run in Supabase; needs a main Admin account (below) and a check on the live URL

**Size warning:** this changes almost every table and every security
policy. Every row needs to know which co-op it belongs to, and every RLS
policy must check it. A mistake here leaks one co-op's money and
customers to another. Do it alone, with a `/code-review` straight after.

## Checklist

- [x] SQL file adds a `cooperatives` table and a co-op link on
      `profiles`, `loads`, `settings`, the audit log and every other
      table; RLS on, with policies
- [x] Batad Multipurpose Cooperative's existing data is moved into its
      own co-op, so nothing is lost
- [x] Every RLS policy and guard checks the co-op, not just the role
- [x] ~~A co-op sign-up form; new co-ops wait as "Pending"~~ Changed by
      the team (15 Oct 2026): the main Admin adds each co-op and its first
      Chairperson at /admin; there is no public co-op sign-up
- [x] An Admin role that can approve co-ops but cannot see their jobs or
      money
- [x] Test: a Chairperson of co-op A cannot read or change anything of
      co-op B (tried directly against the database, not just the screens)
- [x] The team has run the SQL in Supabase
- [ ] Works on the live URL, on a phone

## Notes

- "RPS 1", "RPS 2" = different cooperatives in different towns.
- Each co-op's settings (name, town, rates, lifelines, cancel window) are
  on its row in `cooperatives`. The old single `settings` row is kept
  read-only and no longer used.
- Admins are listed in the `admins` table (not a role) and have no co-op,
  so every co-op policy gives them nothing. To make someone the main
  Admin, run in Supabase (with their account's id):
  `insert into public.admins (user_id) values ('<id>');
   update public.profiles set coop_id = null where id = '<id>';`
- Customers choose their co-op on the sign-up page.
- Tested in a rolled-back transaction with a test co-op B: B's
  Chairperson could not read, edit, add to, pay or rename anything of
  Batad, or change a Batad person's role; Batad could not see B's job; B's
  own job used B's rates; the Admin saw no jobs, payments or people of any
  co-op; non-admins could not add co-ops or use the admin list.

## Not in this ticket

- Billing co-ops for using RPS1
- An Admin dashboard with global rules (see `docs/LATER.md`)
