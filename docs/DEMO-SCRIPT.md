# RPS1 — Demo Script

About six minutes, spoken. If more than one of you presents, write a name
next to each part. Anything in [square brackets] is a real detail only you
can fill in. Don't invent it, and don't skip it.

## Before you present (the night before)

- [ ] Open the live URL on the phone you'll demo with. Sign in once.
- [ ] Have three accounts ready: **Chairperson**, **Operator**, **Customer**.
- [ ] Set the farmgate price in **Settings** (e.g. ₱20 per kg).
- [ ] Prepare one **Package Deal** job that is already at **Drying**, so you
      don't wait through every step live.
- [ ] Check the phone has internet and the battery is above 50%.
- [ ] Have a backup: screenshots of each screen, in case the Wi-Fi fails.

---

## The script

### 1. The person (~45s)

This is about my mother. She is the chairperson of Batad Multipurpose
Cooperative, and the co-op owns a rice mill. Farmers bring in their palay,
and she has to watch every job: who asked for what, what step it's at, how
much came out, what's stored, who has paid.

Before RPS1, all of that lived in a notebook, on slips of paper, and in her
memory. [One real moment: e.g. the evening she sat with the notebook trying
to work out whether a customer had already paid.]

### 2. What RPS1 does (~30s)

RPS1 is a phone app for the whole co-op. Customers request a service from
their own phone. Staff move each job through its steps. The app works out
the fee, keeps stored grain from going bad, and won't let grain leave the
mill until it's paid for.

There are five roles: Customer, Operator, Monitor, Chairperson and Auditor.
Each person only sees the buttons they're allowed to use.

### 3. Live demo (~3 min)

**a. The customer asks (~30s)** — *Customer account*

"I'm a farmer. I open RPS1, tap **Request a service**, and choose
**Package Deal**: harvesting, drying and milling. I give my farm address so
the harvest team can find the field. I don't enter sacks or weight, because
nobody knows them before the harvest."

**b. The co-op accepts (~20s)** — *Chairperson account*

"On the Requests page, members are listed first. I accept the request. The
fee is worked out later, from the price list, after the harvest."

**c. The price list works out the fee (~60s)** — *Operator account, on the
job you prepared*

"Our co-op's rates are:
- Harvesting: 15% of the harvest, times the market price of palay that day
- Drying: ₱9,000 per dryer load, up to 130 sacks
- Milling: ₱120 per sack, counted after drying

At the harvest count, I enter 100 sacks, 6,000 kg, and today's price,
₱20 per kg. The app works out the harvesting fee: 15% of 6,000 kg is
900 kg, times ₱20 is **₱18,000**. Drying is one load: **₱9,000**.

After drying, the palay is lighter. I count again: 95 sacks. Milling is
95 times ₱120: **₱11,400**. The total is **₱38,400**. Nobody had to
calculate anything, and the breakdown is on the screen."

**d. Weigh, choose, pay, release (~60s)**

"At Ready, I weigh the rice that came out. The customer chooses to
**keep** it, **sell** it to the co-op, or **split** it.

Now watch: the **Release** button is locked. The app says the customer
still owes ₱38,400. Grain can't leave the mill until it's paid. I record
the payment, and now I can release it."

**e. Storage (~10s, optional)**

"If the customer leaves the rice at the mill, I tap **Store**. Rice keeps
30 days, palay 90, and the app warns us 14 days before it goes bad."

### 4. Safe by design (~30s)

"The app is on a public website, so we made sure:
- Every table in the database has security rules. Customers only ever see
  their own jobs.
- The **database itself** checks who may change what, and does the fee
  maths. Even someone who gets past the screens can't type in a fake fee or
  release unpaid grain.
- The Auditor can see everything but change nothing."

### 5. What it can't do yet: the limitations (~60s)

"We want to be honest about what RPS1 doesn't do yet:

1. **The rates are fixed in the code.** If the co-op changes ₱9,000 or
   ₱120 or 15%, a developer has to change them. There's no settings screen
   for them yet.
2. **The market price is typed in by hand** for each harvest. The app
   doesn't look up palay prices or keep a price history.
3. **One job, one dryer.** If two farmers share one dryer load, the app
   still charges each of them a full load. It doesn't split a load between
   jobs.
4. **Paying the harvest fee in palay isn't tracked.** The fee is always shown
   in pesos. If the farmer pays with palay instead, the app doesn't take
   those kilos out of their grain.
5. **A discount can be overwritten.** If staff lower the fee and the job is
   counted again later, the price list replaces the discount.
6. **Payments are simple.** One cash amount per job. No receipts, no GCash
   or Maya, no record of the payment date, and no "pay later" exception for
   trusted members.
7. **It needs internet.** In a mill with weak signal, it won't work offline.
8. **No text messages.** Customers only see updates when they open the app.
9. **One cooperative only.** Other co-ops can't sign up yet.
10. **No history of who changed what.** The Auditor sees the current
    records, not every change made to them.
11. **Most details can't be edited after saving.** If a name or service is
    wrong, the job has to be deleted and entered again.
12. **Forgot password** needs the Chairperson to reset it.

All of these are written down in our **Later** list. We cut them on purpose
to ship something that works now."

### 6. How we'll know it works (~30s)

"[What happened when your mother or the staff used it on real jobs: what
she liked, and what she didn't.]

Our test is simple: would the co-op rather use this than the notebook?
[Her answer.]"

**Close:** "RPS1: every job, every fee, every sack, from the farm to the
customer's hands. Thank you."

---

## Likely questions

**"What if the market price changes in the middle of a job?"**
The price used is the one entered at the harvest count. Staff can change
the total fee afterwards, for example for a discount.

**"Why can't a trusted member take the rice and pay later?"**
Right now the rule is strict: no release until it's paid. A "pay later"
option for members is a good idea for later.

**"Why not just use a spreadsheet?"**
A spreadsheet can hold the data, but it can't stop unpaid grain leaving,
work out the fee by itself, or let customers check their own job from
their phone.

**"What happens if two staff tap at the same time?"**
The job only moves if it's still at the step the person was looking at, so
a double tap moves it once, not twice.
