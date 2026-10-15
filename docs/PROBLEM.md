# RPS1

## Who
My mother — the owner-operator of our family's rice mill.

## The struggle
She spends extra time and money just keeping track of every load: what stage
it's at, whether the package deal was applied, and whether the customer has
paid. She watches the loads, but the records don't keep up with them.

## Today's workaround
A notebook at intake, plus memory and loose slips, plus asking staff. To
monitor, she flips pages, asks around, and reconciles by hand — which is the
time and money the mill loses.

## The MVP
A one-user app where she logs a palay load (customer, sacks, kilos, service
type, and the agreed price typed by hand) and taps it forward through fixed
stages: Received → Drying → Dried → Milling → Milled → Released. Payment is a
simple Paid/Not-paid flag with an amount. Needs a login so customer data stays
private.

## How we'll know it worked
Demo: log a load, tap it through every stage, and mark it paid — on her phone.
My mother tries it before Session 3; if she'd use it instead of the notebook,
it works.

## Out of scope
Staff accounts, farmer/admin roles, warehouse storage and expiry, reports,
offline sync, payment methods (cash/online/card/e-wallet), automatic pricing.

## Glossary
- **Palay**: unhusked rice as harvested.
- **Package Deal**: harvesting + drying + milling bundled for one agreed
  price; in the MVP it is a label plus a hand-typed price.
- **Drying**: reducing palay moisture to a safe level.
- **Milling**: turning palay into rice.
- **Sack**: 50 kg unit.
- **Load**: one customer's palay that moves through the stages.
