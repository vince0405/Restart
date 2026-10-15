# 26 — History of changes (audit log)

**What to build:** Every change to a job, a person's role, or the settings
is recorded: who, when, and what changed from what to what. The Chairperson
and the Auditor can read it; nobody can edit or delete it.

**Blocked by:** 25

**Status:** todo

- [ ] `audit_log` table, written only by database triggers (011)
- [ ] RLS: Chairperson and Auditor read; no role can insert, update or delete
- [ ] A History page listing the latest changes, newest first
- [ ] Each job screen shows that job's history (staff)
- [ ] The team has run 011 in Supabase
- [ ] Works on the live URL, on a phone
