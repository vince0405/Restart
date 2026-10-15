import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Scale, Warehouse } from "lucide-react";
import { Badge, ExpiryBadge, PaidBadge, StageBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  daysLeft,
  expiryDate,
  isServiceType,
  isStage,
  jobRef,
  nextStage,
  prevStage,
  productFor,
  SHELF_LIFE_MONTHS,
  stepsFor,
} from "@/lib/loads";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { markNotPaid, markPaid, moveStage, storeLoad } from "../actions";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold text-ink">{value}</div>
    </div>
  );
}

function Price({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold ? "font-extrabold text-ink" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className={bold ? "" : "font-bold text-ink"}>{value}</span>
    </div>
  );
}

export default async function LoadDetailPage({
  params,
  searchParams,
}: PageProps<"/loads/[id]">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { error } = await searchParams;

  // RLS means this only finds the load if it belongs to the signed-in
  // Monitor. Someone else's load (or a made-up id) is simply "not found".
  const { data: load } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!load || !isServiceType(load.service_type) || !isStage(load.stage)) {
    notFound();
  }

  const stored = load.stored_at != null;
  const steps = stepsFor(load.service_type, stored);
  const next = nextStage(load.service_type, load.stage, stored);
  const prev = prevStage(load.service_type, load.stage, stored);
  const current = steps.indexOf(load.stage);
  const finished = load.stage === "Released";

  const product = productFor(load.service_type);
  const storedAt = stored ? new Date(load.stored_at) : null;
  const expires = storedAt ? expiryDate(storedAt, load.service_type) : null;
  const left = expires ? daysLeft(expires) : null;

  const balance = Math.max(0, load.agreed_price - (load.is_paid ? (load.amount_paid ?? 0) : 0));
  const initials = String(load.customer_name)
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Hidden fields every stage-move form sends.
  const stageFields = (direction: "next" | "back") => (
    <>
      <input type="hidden" name="id" value={load.id} />
      <input type="hidden" name="service" value={load.service_type} />
      <input type="hidden" name="from" value={load.stage} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="stored" value={stored ? "1" : "0"} />
    </>
  );

  return (
    <div>
      <Link
        href="/loads"
        className="mb-4 flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All jobs
      </Link>

      <PageTitle
        eyebrow="Job details"
        title={`#${jobRef(load.id)}`}
        description={`${load.service_type} · Created ${formatDate(new Date(load.created_at))}`}
        action={
          next && (
            <form action={moveStage}>
              {stageFields("next")}
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                {next === "Released" ? "Release to customer" : `Move to ${next}`}
              </Button>
            </form>
          )
        }
      />

      {error && (
        <p
          className="mb-4 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="grid size-11 place-items-center rounded-full bg-brand-soft font-extrabold text-brand">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate font-extrabold text-ink">{load.customer_name}</div>
          <div className="text-xs text-muted-foreground">
            {load.sacks} sacks · {kg.format(load.kilos)} kg
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <StageBadge stage={load.stage} />
          <PaidBadge isPaid={load.is_paid} amount={load.amount_paid} />
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card md:p-7">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-ink">Processing timeline</h2>
            <p className="text-xs text-muted-foreground">
              {load.service_type}: {steps.length} steps
            </p>
          </div>
          <Badge tone={finished ? "gray" : "amber"}>{finished ? "Finished" : "In progress"}</Badge>
        </div>

        {/* Vertical on phones, one column per step on wider screens. */}
        <ol
          className="grid md:[grid-template-columns:repeat(var(--steps),minmax(0,1fr))]"
          style={{ ["--steps" as string]: steps.length }}
        >
          {steps.map((step, i) => {
            const done = i < current || (finished && i === current);
            const isCurrent = i === current && !finished;
            return (
              <li
                key={step}
                className="relative flex gap-4 pb-6 last:pb-0 md:block md:pb-0"
              >
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-4 top-8 h-full w-0.5 md:left-1/2 md:top-4 md:h-0.5 md:w-full",
                      i < current ? "bg-brand" : "bg-line",
                    )}
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold md:mx-auto",
                    done && "bg-brand text-white",
                    isCurrent && "bg-gold text-white ring-4 ring-gold-soft",
                    !done && !isCurrent && "bg-surface text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </div>
                <div className="md:mt-3 md:text-center">
                  <div className="text-xs font-extrabold text-ink">{step}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {done ? "Done" : isCurrent ? (step === "Ready" ? "Waiting for customer" : "In progress") : "Pending"}
                    {isCurrent && <span className="sr-only"> (current step)</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {(prev || (load.stage === "Ready" && !stored)) && (
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
            {load.stage === "Ready" && !stored && (
              <form action={storeLoad} className="flex-1">
                <input type="hidden" name="id" value={load.id} />
                <Button type="submit" variant="secondary" size="lg" className="w-full border border-line">
                  <Warehouse className="size-5" aria-hidden />
                  Store {product} at the mill
                </Button>
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  Stored {product} keeps {SHELF_LIFE_MONTHS[product]}{" "}
                  {SHELF_LIFE_MONTHS[product] === 1 ? "month" : "months"}.
                </p>
              </form>
            )}
            {prev && (
              <form action={moveStage} className="flex-1">
                {stageFields("back")}
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Back one step (to {prev})
                </Button>
              </form>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {storedAt && expires && left !== null && (
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-info-soft text-info-dark">
                  <Warehouse className="size-5" aria-hidden />
                </div>
                <h2 className="font-extrabold text-ink">Storage record</h2>
                <span className="ml-auto">
                  {finished ? <Badge tone="gray">Released</Badge> : <ExpiryBadge daysLeft={left} />}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Fact label="Stored" value={product === "rice" ? "Rice" : "Palay"} />
                <Fact label="Since" value={formatDate(storedAt)} />
                <Fact label="Expires" value={formatDate(expires)} />
                <Fact label="Shelf life" value={`${SHELF_LIFE_MONTHS[product]} ${SHELF_LIFE_MONTHS[product] === 1 ? "month" : "months"}`} />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Scale className="size-5" aria-hidden />
              </div>
              <h2 className="font-extrabold text-ink">Intake summary</h2>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Fact label="Sacks" value={`${load.sacks} sacks`} />
              <Fact label="Weight" value={`${kg.format(load.kilos)} kg`} />
              <Fact label="Service" value={load.service_type} />
              <Fact
                label="Logged"
                value={new Date(load.created_at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-card xl:self-start">
          <h2 className="font-extrabold text-ink">Billing summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Price label="Agreed price" value={peso.format(load.agreed_price)} bold />
            <Price
              label="Paid"
              value={load.is_paid ? peso.format(load.amount_paid ?? 0) : peso.format(0)}
            />
            <div className={cn("rounded-xl p-3", balance > 0 ? "bg-gold-soft" : "bg-brand-soft")}>
              <Price label="Balance due" value={peso.format(balance)} bold />
            </div>
          </div>

          {load.is_paid ? (
            <form action={markNotPaid} className="mt-4">
              <input type="hidden" name="id" value={load.id} />
              <Button type="submit" variant="outline" className="w-full">
                Mark not paid
              </Button>
            </form>
          ) : (
            <form action={markPaid} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="id" value={load.id} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount_paid">Amount received (₱)</Label>
                <Input
                  id="amount_paid"
                  name="amount_paid"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  defaultValue={load.agreed_price}
                  required
                />
              </div>
              <Button type="submit" size="lg" className="w-full">
                Mark paid
              </Button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
