# 44 — More security: Content-Security-Policy and hardening

**What to build:** The next layer of security after Ticket 42, found by
running every test again on 16 Oct 2026.

**Blocked by:** 42

**Status:** built — 024 run in Supabase; check on the live URL

## Checklist

- [x] Content-Security-Policy on every page (src/proxy.ts): scripts run
      only with a fresh one-time nonce per request; data only from this
      site and our Supabase project; no framing; forms post only here
- [x] The theme script carries the nonce (src/app/layout.tsx)
- [x] `X-Powered-By: Next.js` removed; Cross-Origin-Opener-Policy added
- [x] Signed-out visitors can't call the "who am I?" helpers (024)
- [x] Own profile edits only to sensible values: a name that isn't
      blank, a mobile number like +639171234567 or none (024)
- [x] Tested: 0 scripts blocked on sign-in, landing, sign-up and forgot
      password (all 13 scripts carry the nonce), dark mode still works;
      profile rules; the 17-step workflow; every Ticket 42 attack still
      refused; 120 unit tests, lint, TypeScript, build; 0 known
      vulnerabilities in production packages
- [ ] Works on the live URL, on a phone (sign in and use every screen)

## Notes

- Styles still allow inline `style=` because the charts and bars use it;
  scripts are the part that matters for stopping injected code.
- 4 older profiles have numbers in another format; they keep working and
  are checked only when someone edits them.
