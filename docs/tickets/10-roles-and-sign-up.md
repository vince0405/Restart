# 10 — Roles, sign-up, and who sees what

**What to build:** Anyone can sign up and becomes a Customer. Every account
has a role (Customer, Operator, Monitor, Chairperson, Auditor). Staff land on
the staff dashboard; customers land on "My jobs" (empty for now). The
database enforces who can see which jobs.

**Blocked by:** 09

**Status:** todo

- [ ] SQL file: `profiles` table (role starts as `customer`, a profile is
      created automatically on sign-up), `settings` table with the co-op
      name, RLS on both. The team has run it.
- [ ] Nobody can change their own role or member flag, even through the API
- [ ] `loads` RLS rewritten: staff and auditors see all jobs, customers only
      their own; existing jobs stay visible to staff
- [ ] Public sign-ups switched back on; a Sign up screen with name, phone,
      email, password
- [ ] The team's chairperson account is set to `chairperson` by hand
- [ ] Customers land on "My jobs"; staff land on the dashboard; the sidebar
      shows the person's name and role
- [ ] A customer typing a staff address (e.g. /storage) is sent to My jobs
- [ ] Works on the live URL
