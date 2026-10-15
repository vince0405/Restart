# RPS1

## Who
My mother — the owner-operator of our family's rice mill.

## The struggle
She spends extra time and money just keeping track of every load: which
service it is, what step it's at, whether palay or rice is being stored and
when it will go bad, and whether the customer has paid. She watches the
loads, but the records don't keep up with them.

## Today's workaround
A notebook at intake, plus memory and loose slips, plus asking staff. To
monitor, she flips pages, asks around, and reconciles by hand — which is the
time and money the mill loses.

## The MVP
A one-user app for the Monitor: log a load (customer, sacks, kilos, one of
four services, and the agreed price typed by hand), tap it through only the
steps its service has, store finished palay or rice with a warning before it
expires (palay 3 months, rice 1 month), and mark it paid. Needs a login so
customer data stays private.

## How we'll know it worked
Demo: log a Package Deal load, tap it Harvesting → Drying → Milling → Ready,
store it and see its expiry date, then mark it paid — on her phone.
My mother tries it before Session 3; if she'd use it instead of the notebook,
it works.

## Out of scope
Operator and customer logins (the planned next step), storage locations and
capacity, a separate storage fee, reports, offline sync, payment methods
(cash/online/card/e-wallet), automatic pricing.

## Still to find out
How many loads arrive on a busy day, and when a load, a payment or stored
grain last slipped through. Ask the Monitor — this is the evidence the pitch
still needs.

## Glossary
- **Palay**: unhusked rice as harvested.
- **Package Deal**: harvesting + drying + milling bundled for one agreed
  price; in the MVP it is a label plus a hand-typed price.
- **Drying**: reducing palay moisture to a safe level.
- **Milling**: turning palay into rice.
- **Sack**: 50 kg unit.
- **Load**: one customer's job that moves through the steps of its service.
- **Monitor**: the one person who watches every load at the mill. The only
  user of the MVP.
- **Operator**: mill staff who do the harvesting, drying and milling. Not a
  user in the MVP.
- **Service**: what the customer paid for — Package Deal, Harvesting +
  Drying, Drying only, or Milling only. It decides the load's steps.
- **Ready**: the work is finished and the grain is waiting for the customer.
- **Stored**: finished palay or rice kept at the mill for the customer.
- **Expiry**: stored palay keeps 3 months; stored rice keeps 1 month.
