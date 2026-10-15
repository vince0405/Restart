# 11 — Customer requests a service

**What to build:** A signed-in Customer picks a service for Batad
Multipurpose Cooperative, enters sacks, estimated kg, a preferred date and
a note, and sends the request. It appears on "My jobs" as Pending.

**Blocked by:** 10

**Status:** todo

- [ ] SQL file adds the request columns to `loads` (customer, request
      status, reject reason, preferred date, note); the team has run it
- [ ] Request form with the four service cards
- [ ] The request is saved as Pending and linked to the customer
- [ ] My jobs lists the customer's requests and jobs with their status
- [ ] A customer cannot create a job for someone else, or an already
      accepted one, even through the API
- [ ] Works on the live URL — on a phone
