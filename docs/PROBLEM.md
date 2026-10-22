# RPS1

## The struggle
People spend extra time and money just keeping track of every load: which
service it is, what step it's at, whether palay or rice is being stored and
when it will go bad, and whether the customer has paid. Records don't keep
up with the loads, which causes time and money to be lost.

## Today's workaround
A notebook at intake, plus memory and loose slips, plus asking staff. To
monitor, she flips pages, asks around, and reconciles by hand — which is the
time and money the mill loses.

## The MVP
An app for Batad Multipurpose Cooperative's rice mill that follows the team's
user-flow chart. Customers (members and non-members) request drying, milling
or a Package Deal; co-op staff accept or reject requests, run each job
through only the steps its service has, weigh the finished batch, and keep
stored grain from expiring (rice 30 days, palay 3 months, warning at 14 days
left). The customer chooses to keep, sell or split the grain; the co-op can
buy it at a price per kg, minus processing fees. Five roles, each seeing only
what it should: Customer, Operator, Monitor, Chairperson, Auditor.

Team decision (2026-10-15): the team chose to go beyond the workshop's "one
type of user" rule to follow the flowchart, knowing it is a larger build.

## How we'll know it worked
Demo: a customer requests a Package Deal on one phone; the Monitor accepts it
on another; the Operator taps it Harvesting → Drying → Milling → Ready and
weighs it; the customer chooses "keep 70%, sell 30%"; the Chairperson
approves the purchase and the app shows the net payout. My mother and at
least one operator try it before Session 3.

## Out of scope
Many cooperatives and the admin who verifies them, SMS or push messages,
storage bins and capacity, reports, offline sync, payment methods and
receipts — see `docs/LATER.md`.

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
- **Load / job**: one customer's batch that moves through the steps of its
  service.
- **Cooperative / co-op**: Batad Multipurpose Cooperative, which owns the
  mill. The only co-op in the MVP.
- **Member**: a farmer who belongs to the co-op. Members' requests are
  listed first.
- **Customer**: anyone who requests a service, member or not.
- **Operator**: co-op staff who do the harvesting, drying, milling and
  weighing.
- **Monitor**: co-op staff in charge of monitoring every job, accepting
  requests and recording payments.
- **Chairperson**: head of the co-op. Everything the Monitor can do, plus
  approving buyouts, managing people and settings.
- **Auditor**: checks the co-op's records. Can see everything, change
  nothing.
- **Request**: a customer's ask for a service. Becomes a job once accepted.
- **Disposition**: what the customer does with finished grain — keep 100%,
  sell 100% to the co-op, or split (keep X%, sell the rest).
- **Buyout**: the co-op buying the customer's grain at a price per kg, minus
  processing fees. The farmgate reference price pre-fills the price.
- **Service**: what the customer paid for — Package Deal, Harvesting +
  Drying, Drying only, or Milling only. It decides the load's steps.
- **Ready**: the work is finished and the grain is waiting for the customer.
- **Stored**: finished palay or rice kept at the mill for the customer.
- **Expiry (lifeline)**: kept rice lasts 30 days, stored palay 3 months; a
  warning shows at 14 days left.
- **Output weight**: the weight of the finished batch, recorded at Ready.
