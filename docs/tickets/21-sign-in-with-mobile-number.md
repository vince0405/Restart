# 21 — Sign in with a mobile number; email optional

**What to build:** New accounts (self sign-up, and the Chairperson's "Add a
person") sign in with a Philippine mobile number and password. Email is
optional and kept for contact only. Older email accounts still sign in with
their email.

**Blocked by:** 10

**Status:** todo

- [x] Mobile numbers in any common form (0917…, +63 917…, 63917…) are
      accepted and stored as +639…; tested in `src/lib/phone.test.ts`
- [x] Sign-up: mobile number required, email optional
- [x] Sign-in: one box for "Mobile number or email"
- [x] Add a person: mobile number required, email optional
- [x] The internal sign-in name (…@phone.rps1.invalid) is never shown
- [x] The team has run 007 in Supabase (adds `profiles.contact_email`)
- [ ] Works on the live URL — on a phone
