# 40 — A name and mobile number on every service request

**What to build:** When a customer requests a service, they must give a
name and a mobile number the co-op can contact about that request.

**Blocked by:** 11, 21

**Status:** built — 021 run in Supabase; check on the live URL

## Checklist

- [x] The request form has "Your contact details": Name and Mobile
      number, both required, filled in from the customer's account and
      changeable (e.g. a relative meets the harvest team)
- [x] The number is checked as a Philippine mobile number and saved in
      one standard form (+639…)
- [x] SQL file adds `loads.contact_phone`; the customer sets it only when
      creating their own request; nobody can change it afterwards
- [x] Requests and the job screen show the request's name first, and its
      number as a tap-to-call link (the account's number if a job has none)
- [x] Tested in a rolled-back transaction: a customer's request kept the
      name and number; a Chairperson could not change the number
- [ ] Works on the live URL, on a phone

## Not in this ticket

- Staff correcting the contact number after the request (use the note)
- A contact number on walk-in jobs
