# 11 — Customer requests a service

**What to build:** A signed-in Customer picks a service for Batad
Multipurpose Cooperative, enters sacks, estimated kg, a preferred date and
a note, and sends the request. It appears on "My jobs" as Pending.

**Blocked by:** 10

**Status:** todo

- [x] SQL file adds the request columns to `loads` (customer, request
      status, reject reason, preferred date, note); the team has run it
- [x] Request form with the four service cards
- [x] The request is saved as Pending and linked to the customer
- [x] My jobs lists the customer's requests and jobs with their status
- [x] A customer cannot create a job for someone else, or an already
      accepted one, even through the API
- [ ] Works on the live URL — on a phone
