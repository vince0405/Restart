# 02 — Connected to Supabase

**What to build:** The app can talk to the database. The `loads` table
exists with Row Level Security on, and the live site proves the
connection — and proves the data is protected — by showing that a
signed-out visitor can see 0 loads.

**Blocked by:** 01

**Status:** todo

- [ ] Supabase URL and publishable key are set in `.env.local` and in Vercel
- [ ] The `loads` table exists with every column from the spec
- [ ] RLS is ON for `loads`, with policies so a signed-in Monitor can read,
      add, update and delete only their own rows, and visitors can do nothing
- [ ] Supabase Table Editor shows no "RLS disabled" warning
- [ ] The example `notes` SQL is deleted from the repo
- [ ] The live site shows "Connected: 0 loads visible" while signed out
- [ ] Works on the live URL
