import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Scale, Warehouse } from "lucide-react";
import { Badge, ExpiryBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { Timeline } from "@/components/rps/timeline";
import { Button } from "@/components/ui/button";
import {
  customerStatus,
  expiryDate,
  isServiceType,
  isStage,
  jobRef,
  type LoadRow,
  productFor,
  settlement,
  stepsFor,
  storedDaysLeft,
} from "@/lib/loads";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";
import { chooseDisposition } from "../actions";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", bold ? "font-extrabold text-ink" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className={bold ? "" : "font-bold text-ink"}>{value}</span>
    </div>
  );
}

const CHOICES = [
  { value: "keep", title: "Keep 100%", text: "Take all of it home. You pay the processing fee." },
  { value: "sell", title: "Sell 100%", text: "Ask the co-op to buy all of it. The fee comes off the payout." },
  { value: "split", title: "Split", text: "Keep part, sell the rest to the co-op." },
];

export default async function MyJobPage({ params, searchParams }: PageProps<"/my/[id]">) {
  const { supabase } = await requireRole((r) => !isStaff(r));
  const { lifeline } = await getSettings();
  const { id } = await params;
  const { error } = await searchParams;

  // RLS: a customer can only ever load their own job. Anyone else's id is
  // simply "not found".
  const { data } = await supabase.from("loads").select("*").eq("id", id).maybeSingle();
  const load = data as LoadRow | null;
  if (!load || !isServiceType(load.service_type) || !isStage(load.stage)) notFound();

  const status = customerStatus(load);
  const product = productFor(load.service_type);
  const stored = load.stored_at != null;
  const steps = stepsFor(load.service_type, stored);
  const money = settlement(load);
  const left = storedDaysLeft(load, new Date(), lifeline);
  const canChoose =
    load.request_status === "accepted" &&
    load.stage === "Ready" &&
    load.output_kg != null &&
    !load.disposition;

  return (
    <div>
      <Link
        href="/my"
        className="mb-4 flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My jobs
      </Link>

      <PageTitle
        eyebrow="My job"
        title={`#${jobRef(load.id)}`}
        description={`${load.service_type} · ${load.sacks} sacks · ${kg.format(load.kilos)} kg`}
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {typeof error === "string" && (
        <p className="mb-4 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
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
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card md:p-7">
          <h2 className="mb-6 font-extrabold text-ink">Processing timeline</h2>
          <Timeline steps={steps} current={load.stage} />
        </section>
      )}

      {canChoose && (
        <section className="mt-6 rounded-2xl border-2 border-brand bg-white p-5 shadow-card md:p-7">
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
              <span className="flex min-h-12 items-center rounded-xl border border-line bg-white px-3 focus-within:border-brand">
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
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Confirm my choice
            </Button>
          </form>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {load.request_status === "accepted" && (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Scale className="size-5" aria-hidden />
              </div>
              <h2 className="font-extrabold text-ink">Weight breakdown</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Palay brought in" value={`${kg.format(load.kilos)} kg`} />
              <Row
                label={`${product === "rice" ? "Rice" : "Palay"} out`}
                value={load.output_kg != null ? `${kg.format(load.output_kg)} kg` : "Not weighed yet"}
              />
              {load.disposition && (
                <>
                  <Row label="You keep" value={`${kg.format(money.keptKg)} kg (${load.keep_percent}%)`} />
                  {money.soldKg > 0 && <Row label="Offered to the co-op" value={`${kg.format(money.soldKg)} kg`} />}
                </>
              )}
            </div>
          </section>
        )}

        {load.request_status === "accepted" && (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="font-extrabold text-ink">Money</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Processing fee" value={load.agreed_price > 0 ? peso.format(load.agreed_price) : "To be set"} />
              <Row label="Paid in cash" value={peso.format(money.paidCash)} />
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
                <Row
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
                  <Row
                    label={load.payout_done_at ? "Paid out to you" : "The co-op will pay you"}
                    value={peso.format(money.payout)}
                    bold
                  />
                ) : (
                  <Row label="You still owe" value={peso.format(money.stillOwes)} bold />
                )}
              </div>
            </div>
          </section>
        )}

        {stored && load.stored_at && left !== null && load.stage === "Stored" && (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-info-soft text-info-dark">
                <Warehouse className="size-5" aria-hidden />
              </div>
              <h2 className="font-extrabold text-ink">Stored at the mill</h2>
              <span className="ml-auto">
                <ExpiryBadge daysLeft={left} />
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
