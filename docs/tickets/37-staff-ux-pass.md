# 37 — Staff screens: filters, supply, theme and polish

**What to build:** A round of improvements for co-op staff's daily work
(not customers, not the main Admin), from the team's list on 15 Oct 2026.

**Blocked by:** 31, 34

**Status:** in progress

## Checklist

- [x] Jobs: search (customer name), service filter, status filter
      (In progress / Ready / Stored / Completed), pages of 15, newest
      first; no payment method in the list
- [x] Dashboard: recent jobs in a clearer, grouped layout
- [x] Money: Week / Month / Year filters, bar chart by default with an
      optional line chart, amounts shortened (1k, 10k, 1m)
- [x] History: simple filters, pages, easier to read
- [x] People: search, pages, role filter
- [x] Storage: the co-op's own rice and palay supply — goes up with
      approved buyouts (and palay harvest shares), staff add or take out
      stock by hand, low-supply warning at a level the Chairperson sets
- [x] Job screen: "Record a payment" shows once the rice is finished
      (Ready and after); before that, a "Customer wants to pay early"
      button opens it
- [x] Settings: a note that forgotten passwords are reset by the
      Chairperson (self-service password change stays as it is)
- [ ] Look: a warm rice-paddy background, earth tones, light and dark
- [ ] Buttons press in when tapped; loading screens while pages load
- [ ] Basic security checks: inputs, sessions, RLS on new tables
- [ ] Main workflows tested again after the changes
- [ ] Works on the live URL, on a phone

## Decisions (team, 15 Oct 2026)

- "Supply" = the co-op's own rice/palay stock. Buyouts add to it
  automatically; staff add by hand. Taking stock out by hand is included
  so the low-supply warning can ever trigger.
- Passwords: kept as they are (Account page, forgot-password email,
  Chairperson's reset in People). The main Admin cannot reset passwords:
  that would need the Supabase secret key, which this project never uses.
- Payment method is still recorded on payments and receipts.
- There is NO Chairperson password reset in People (Ticket 36's note was
  wrong): resetting someone else's password needs the Supabase secret
  key. The Settings note says so honestly. Mobile-number accounts need
  Ticket 33 (SMS) to reset their own.

## Not in this ticket

- Automatic re-ordering of supplies
- Customer-facing changes and Admin console changes
