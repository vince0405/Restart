import Link from "next/link";
import { notFound } from "next/navigation";
import { Scale, Warehouse } from "lucide-react";
import { Badge, ExpiryBadge } from "@/components/rps/badge";
import { HarvestAddress } from "@/components/rps/harvest-address";
import { Breadcrumbs } from "@/components/rps/breadcrumbs";
import { PageTitle } from "@/components/rps/page-title";
import { MoneyRow } from "@/components/rps/panel";
import { Timeline } from "@/components/rps/timeline";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorNote } from "@/components/rps/error-note";
import {
  describeCount,
  cancelDeadline,
  customerStatus,
  expiryDate,
  isServiceType,
  isStage,
  jobRef,
  type LoadRow,
  type Payment,
  paymentMethodLabel,
  productFor,
  settlement,
  stepsFor,
  storedDaysLeft,
  withinCancelWindow,
} from "@/lib/loads";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";
import { cancelRequest, chooseDisposition } from "../actions";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
}


const CHOICES = [
  { value: "keep", title: "Keep 100%", text: "Take all of it home. You pay the processing fee." },
  { value: "sell", title: "Sell 100%", text: "Ask the co-op to buy all of it. The fee comes off the payout." },
  { value: "split", title: "Split", text: "Keep part, sell the rest to the co-op." },
];

export default async function MyJobPage({ params, searchParams }: PageProps<"/my/[id]">) {
  const { supabase } = await requireRole((r) => !isStaff(r));
  const { lifeline, warning_days, cancel_window_hours } = await getSettings();
  const { id } = await params;
  const { error, confirm } = await searchParams;

  // RLS: a customer can only ever load their own job. Anyone else's id is
  // simply "not found".
  const { data } = await supabase.from("loads").select("*").eq("id", id).maybeSingle();
  const load = data as LoadRow | null;
  if (!load || !isServiceType(load.service_type) || !isStage(load.stage)) notFound();

  // Their payments on this job, each with a receipt (Ticket 31). RLS only
  // ever returns payments on the customer's own jobs.
  const { data: paymentRows } = await supabase
    .from("payments")
    .select("*")
    .eq("load_id", id)
    .order("paid_on")
    .order("created_at");
  const payments = (paymentRows ?? []) as Payment[];

  const status = customerStatus(load);
  const product = productFor(load.service_type);
  const stored = load.stored_at != null;
  const steps = stepsFor(load.service_type, stored);
  const money = settlement(load);
  const left = storedDaysLeft(load, new Date(), lifeline);
  const deadline = cancelDeadline(load.created_at, cancel_window_hours);
  const canCancel =
    load.request_status === "pending" && withinCancelWindow(load.created_at, cancel_window_hours);
  const canChoose =
    load.request_status === "accepted" &&
    load.stage === "Ready" &&
    load.output_kg != null &&
    !load.disposition;

  return (
    <div>
      <Breadcrumbs items={[{ label: "My transactions", href: "/my" }, { label: `#${jobRef(load.id)}` }]} />

      <PageTitle
        eyebrow="My transaction"
        title={`#${jobRef(load.id)}`}
        description={`${load.service_type} · ${describeCount(load)}`}
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <ErrorNote code={error} />

      {load.harvest_address && (
        <div className="mb-6">
          <HarvestAddress address={load.harvest_address} />
        </div>
      )}

      {load.request_status === "pending" && (
        <section className="mb-6 rounded-2xl border-l-4 border-gold bg-gold-soft p-5">
          <h2 className="font-extrabold text-ink">Waiting for the co-op</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            They will accept your request or tell you why not.
            {load.preferred_date
              ? ` You asked for ${formatDate(new Date(load.preferred_date))}.`
              : ""}
          </p>

          {/* Cancel: shown only inside the window. The database checks the
              same rule with its own clock, so this is never the only lock. */}
          {canCancel && (
            <div className="mt-4 border-t border-gold/40 pt-4">
              {confirm === "cancel" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-ink">Cancel this request?</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <form action={cancelRequest}>
                      <input type="hidden" name="id" value={load.id} />
                      <SubmitButton variant="destructive" className="w-full sm:w-auto">
                        Yes, cancel request
                      </SubmitButton>
                    </form>
                    <Link
                      href={`/my/${load.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                    >
                      Keep my request
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    You can cancel until <strong className="text-ink">{formatDateTime(deadline)}</strong>.
                  </p>
                  <Link
                    href={`/my/${load.id}?confirm=cancel`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-danger hover:text-danger")}
                  >
                    Cancel request
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {load.request_status === "cancelled" && (
        <section className="mb-6 rounded-2xl border-l-4 border-line bg-surface p-5">
          <h2 className="font-extrabold text-ink">You cancelled this request</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {load.cancelled_at ? `Cancelled ${formatDateTime(new Date(load.cancelled_at))}. ` : ""}
            Nothing more will happen with it.
          </p>
          <Link href="/my/request" className="mt-3 inline-block text-sm font-bold text-brand">
            Send a new request
          </Link>
        </section>
      )}

      {load.request_status === "rejected" && (
        <section className="mb-6 rounded-2xl border-l-4 border-danger bg-danger-soft p-5">
          <h2 className="font-extrabold text-ink">The co-op could not accept this request</h2>
          <p className="mt-1 text-sm text-ink">{load.reject_reason ?? "No reason given."}</p>
          <Link href="/my/request" className="mt-3 inline-block text-sm font-bold text-brand">
            Send a new request
          </Link>
        </section>
      )}

      {load.request_status === "accepted" && (
        <section className="rounded-2xl border border-line bg-card p-5 shadow-card md:p-7">
          <h2 className="mb-6 font-extrabold text-ink">Processing timeline</h2>
          <Timeline steps={steps} current={load.stage} />
        </section>
      )}

      {canChoose && (
        <section className="mt-6 rounded-2xl border-2 border-brand bg-card p-5 shadow-card md:p-7">
          <h2 className="text-lg font-extrabold text-ink">Your {product} is ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It weighed {kg.format(load.output_kg ?? 0)} kg. What would you like to do with it?
          </p>
          <form action={chooseDisposition} className="mt-5 flex flex-col gap-4">
            <input type="hidden" name="id" value={load.id} />
            <div className="grid gap-3 md:grid-cols-3">
              {CHOICES.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer flex-col gap-1 rounded-2xl border-2 border-line p-4 transition hover:border-brand/30 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
                >
                  <input type="radio" name="choice" value={c.value} required className="sr-only" />
                  <span className="font-extrabold text-ink">{c.title}</span>
                  <span className="text-xs text-muted-foreground">{c.text}</span>
                </label>
              ))}
            </div>
            <label className="block max-w-xs">
              <span className="mb-2 block text-xs font-bold text-ink">
                If splitting: how much do you keep?
              </span>
              <span className="flex min-h-12 items-center rounded-xl border border-field bg-card px-3 focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
                <input
                  name="keep_percent"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  step={1}
                  placeholder="70"
                  className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none md:text-sm"
                />
                <span className="border-l border-line pl-3 text-xs font-bold text-muted-foreground">
                  % keep
                </span>
              </span>
            </label>
            <SubmitButton size="lg" className="w-full sm:w-auto">
              Confirm my choice
            </SubmitButton>
          </form>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {load.request_status === "accepted" && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Scale className="size-5" aria-hidden />
              </div>
              <h2 className="font-extrabold text-ink">Weight breakdown</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <MoneyRow label="Palay (latest count)" value={load.sacks || load.kilos ? `${load.sacks} sacks · ${kg.format(load.kilos)} kg` : "Counted after harvest"} />
              <MoneyRow
                label={`${product === "rice" ? "Rice" : "Palay"} out`}
                value={load.output_kg != null ? `${kg.format(load.output_kg)} kg` : "Not weighed yet"}
              />
              {load.disposition && (
                <>
                  <MoneyRow label="You keep" value={`${kg.format(money.keptKg)} kg (${load.keep_percent}%)`} />
                  {money.soldKg > 0 && <MoneyRow label="Offered to the co-op" value={`${kg.format(money.soldKg)} kg`} />}
                </>
              )}
            </div>
          </section>
        )}

        {load.request_status === "accepted" && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <h2 className="font-extrabold text-ink">Money</h2>
            <div className="mt-4 space-y-3 text-sm">
              {load.harvest_fee_in === "palay" && load.harvest_kept_kg != null && (
                <MoneyRow
                  label="Harvest share paid in palay"
                  value={`${kg.format(Number(load.harvest_kept_kg))} kg`}
                />
              )}
              {load.dryer_load_id && load.drying_fee != null && (
                <MoneyRow
                  label="Drying: your share of a shared dryer load"
                  value={peso.format(Number(load.drying_fee))}
                />
              )}
              <MoneyRow label="Processing fee" value={load.agreed_price > 0 ? peso.format(load.agreed_price) : "To be set"} />
              <MoneyRow label="Paid so far" value={peso.format(money.paidCash)} />
              {payments.length > 0 && (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                      <Link href={`/receipts/${p.id}`} className="font-bold text-brand">
                        {peso.format(Number(p.amount))}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(new Date(`${p.paid_on}T00:00:00+08:00`))} · {paymentMethodLabel(p.method)}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {load.buyout_status === "requested" && (
                <p className="rounded-xl bg-gold-soft p-3 text-gold-dark">
                  The chairperson is deciding on your sale.
                </p>
              )}
              {load.buyout_status === "declined" && (
                <p className="rounded-xl bg-danger-soft p-3 text-danger">
                  The co-op cannot buy this time. Please claim all of your grain.
                </p>
              )}
              {load.buyout_status === "approved" && (
                <MoneyRow
                  label={`Sale: ${kg.format(money.soldKg)} kg × ${peso.format(Number(load.price_per_kg ?? 0))}`}
                  value={peso.format(money.saleValue)}
                />
              )}
              <div
                className={cn(
                  "rounded-xl p-3",
                  money.payout > 0 ? "bg-brand-soft" : money.stillOwes > 0 ? "bg-gold-soft" : "bg-surface",
                )}
              >
                {money.payout > 0 ? (
                  <MoneyRow
                    label={load.payout_done_at ? "Paid out to you" : "The co-op will pay you"}
                    value={peso.format(money.payout)}
                    strong
                  />
                ) : (
                  <MoneyRow label="You still owe" value={peso.format(money.stillOwes)} strong />
                )}
              </div>
            </div>
          </section>
        )}

        {stored && load.stored_at && left !== null && load.stage === "Stored" && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-info-soft text-info-dark">
                <Warehouse className="size-5" aria-hidden />
              </div>
              <h2 className="font-extrabold text-ink">Stored at the mill</h2>
              <span className="ml-auto">
                <ExpiryBadge daysLeft={left} warningDays={warning_days} />
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Please claim your {product} by{" "}
              <strong className="text-ink">
                {formatDate(expiryDate(new Date(load.stored_at), load.service_type, lifeline))}
              </strong>
              . Stored since {formatDate(new Date(load.stored_at))}.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
