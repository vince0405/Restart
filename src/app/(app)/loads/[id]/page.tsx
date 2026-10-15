import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, BadgeCheck, HandCoins, Scale, Trash2, Warehouse, type LucideIcon } from "lucide-react";
import { Badge, ExpiryBadge, PaidBadge, StageBadge } from "@/components/rps/badge";
import { HarvestAddress } from "@/components/rps/harvest-address";
import { PageTitle } from "@/components/rps/page-title";
import { Timeline } from "@/components/rps/timeline";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/components/rps/error-note";
import {
  describeCount,
  countsAfter,
  daysLeft,
  expiryDate,
  isServiceType,
  isStage,
  jobRef,
  type LoadRow,
  nextStage,
  prevStage,
  productFor,
  settlement,
  stepsFor,
} from "@/lib/loads";
import { canApproveBuyout, canManage, canWork, isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  approveBuyout,
  declineBuyout,
  deleteLoad,
  markNotPaid,
  markPaid,
  markPayoutDone,
  moveStage,
  recordOutput,
  setDisposition,
  storeLoad,
} from "../actions";

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
    <div className={cn("flex justify-between gap-3", bold ? "font-extrabold text-ink" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className={bold ? "" : "font-bold text-ink"}>{value}</span>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      {children}
    </section>
  );
}

function PanelHead({
  icon: Icon,
  tone,
  title,
  right,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid size-10 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="font-extrabold text-ink">{title}</h2>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

type Job = LoadRow & {
  reject_reason: string | null;
  preferred_date: string | null;
  customer_note: string | null;
  customer: { full_name: string; phone: string; is_member: boolean } | null;
};

export default async function LoadDetailPage({ params, searchParams }: PageProps<"/loads/[id]">) {
  const { supabase, role } = await requireRole(isStaff);
  const settings = await getSettings();
  const { id } = await params;
  const { error, confirm } = await searchParams;
  const confirmingDelete = confirm === "delete";

  // RLS: staff see every job. A made-up id is simply "not found".
  const { data } = await supabase
    .from("loads")
    .select("*, customer:profiles!loads_customer_id_fkey(full_name, phone, is_member)")
    .eq("id", id)
    .maybeSingle();
  const load = data as Job | null;
  if (!load || !isServiceType(load.service_type) || !isStage(load.stage)) notFound();
  if (load.request_status === "pending") redirect("/requests");

  // Which buttons this person gets. The database enforces the same rules.
  const worker = canWork(role);
  const manager = canManage(role);
  const chair = canApproveBuyout(role);

  const rejected = load.request_status === "rejected";
  const cancelled = load.request_status === "cancelled";
  // Rejected or cancelled requests are closed: no work or money buttons.
  const closed = rejected || cancelled;
  const stored = load.stored_at != null;
  const steps = stepsFor(load.service_type, stored);
  const next = nextStage(load.service_type, load.stage, stored);
  const prev = prevStage(load.service_type, load.stage, stored);
  const finished = load.stage === "Released";
  const weighed = load.output_kg != null;
  const atReady = load.stage === "Ready";
  const chosen = load.disposition != null;
  const money = settlement(load);
  // Leaving Ready needs the batch weighed AND the customer's keep / sell /
  // split choice. Storing also needs something kept. (The database and the
  // server actions refuse these too.)
  const canAdvance = worker && !closed && next !== null && (!atReady || (weighed && chosen));
  // After harvesting and after drying, moving on needs the new count.
  const countStep = countsAfter(load.stage);
  const canStore = worker && atReady && !stored && weighed && chosen && money.keptKg > 0;

  const product = productFor(load.service_type);
  const storedAt = stored ? new Date(load.stored_at as string) : null;
  const expires = storedAt ? expiryDate(storedAt, load.service_type, settings.lifeline) : null;
  const left = expires ? daysLeft(expires) : null;
  const walkIn = !load.customer_id;
  const name = load.customer?.full_name || load.customer_name;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
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
          canAdvance &&
          !countStep && (
            <form action={moveStage}>
              {stageFields("next")}
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                {next === "Released" ? "Release to customer" : `Move to ${next}`}
              </Button>
            </form>
          )
        }
      />

      <ErrorNote code={error} />

      {role === "auditor" && (
        <p className="mb-4 rounded-xl border-l-4 border-info bg-info-soft p-3 text-sm font-semibold text-info-dark">
          Read-only: auditors can see everything but change nothing.
        </p>
      )}

      {rejected && (
        <p className="mb-4 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm text-ink">
          <strong>Request rejected.</strong> {load.reject_reason}
        </p>
      )}

      {cancelled && (
        <p className="mb-4 rounded-xl border-l-4 border-line bg-surface p-3 text-sm text-ink">
          <strong>Cancelled by the customer</strong>
          {load.cancelled_at ? ` on ${formatDate(new Date(load.cancelled_at))}` : ""}. Nothing to do.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="grid size-11 place-items-center rounded-full bg-brand-soft font-extrabold text-brand">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-extrabold text-ink">{name}</span>
            {load.customer?.is_member && (
              <Badge tone="green">
                <BadgeCheck className="mr-1 size-3.5" aria-hidden />
                Member
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {walkIn ? "Walk-in (no account)" : load.customer?.phone || "Has an account"} ·{" "}
            {describeCount(load)}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <StageBadge stage={load.stage} />
          <PaidBadge isPaid={load.is_paid} amount={load.amount_paid} />
        </div>
      </div>

      {!closed && (
        <Panel className="md:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-ink">Processing timeline</h2>
              <p className="text-xs text-muted-foreground">
                {load.service_type}: {steps.length} steps
              </p>
            </div>
            <Badge tone={finished ? "gray" : "amber"}>{finished ? "Finished" : "In progress"}</Badge>
          </div>

          <Timeline steps={steps} current={load.stage} />

          {canAdvance && countStep && (
            <form
              action={moveStage}
              className="mt-6 flex flex-col gap-4 rounded-2xl border-2 border-gold bg-gold-soft/40 p-4"
            >
              {stageFields("next")}
              <div>
                <h3 className="font-extrabold text-ink">
                  {countStep === "harvesting" ? "Harvest done? Count and weigh" : "Drying done? Count and weigh again"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {countStep === "harvesting"
                    ? "Record how many sacks were harvested and their total weight."
                    : "Dried palay is lighter and may fill fewer sacks — record the new numbers."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="count_sacks">
                    Sacks after {countStep === "harvesting" ? "harvesting" : "drying"}
                  </Label>
                  <Input
                    id="count_sacks"
                    name="sacks"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    defaultValue={load.sacks || undefined}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="count_kilos">
                    Weight after {countStep === "harvesting" ? "harvesting" : "drying"} (kg)
                  </Label>
                  <Input
                    id="count_kilos"
                    name="kilos"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    defaultValue={load.kilos || undefined}
                    required
                  />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start">
                Save count and move to {next}
              </Button>
            </form>
          )}

          {worker && atReady && weighed && !chosen && (
            <p className="mt-5 rounded-xl border-l-4 border-gold bg-gold-soft p-3 text-sm text-ink">
              Weighed. Release and storage unlock once {walkIn ? "the walk-in's" : "the customer's"} keep /
              sell / split choice is recorded.
            </p>
          )}

          {worker && (prev || canStore) && (
            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
              {canStore && (
                <form action={storeLoad} className="flex-1">
                  <input type="hidden" name="id" value={load.id} />
                  <Button type="submit" variant="secondary" size="lg" className="w-full border border-line">
                    <Warehouse className="size-5" aria-hidden />
                    Store {product} at the mill
                  </Button>
                  <p className="mt-1 text-center text-[11px] text-muted-foreground">
                    {kg.format(money.keptKg)} kg kept · stored {product} keeps{" "}
                    {settings.lifeline[product]} days.
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
        </Panel>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {(atReady || weighed) && !closed && (
            <Panel className={cn(atReady && !weighed && "border-2 border-gold")}>
              <PanelHead
                icon={Scale}
                tone="bg-gold-soft text-gold-dark"
                title="Weigh batch"
                right={weighed ? <Badge tone="green">Weighed</Badge> : <Badge tone="amber">Needed</Badge>}
              />
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                <Fact label="Palay in" value={`${kg.format(load.kilos)} kg`} />
                <Fact
                  label={`${product === "rice" ? "Rice" : "Palay"} out`}
                  value={weighed ? `${kg.format(load.output_kg ?? 0)} kg` : "—"}
                />
                {weighed && load.kilos > 0 && (
                  <Fact label="Out ÷ in" value={`${Math.round(((load.output_kg ?? 0) / load.kilos) * 100)}%`} />
                )}
              </div>
              {worker && atReady && !load.disposition && (
                <form action={recordOutput} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="id" value={load.id} />
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="output_kg">Output weight (kg)</Label>
                    <Input
                      id="output_kg"
                      name="output_kg"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      defaultValue={load.output_kg ?? undefined}
                      required
                    />
                  </div>
                  <Button type="submit">{weighed ? "Update weight" : "Save weight"}</Button>
                </form>
              )}
            </Panel>
          )}

          {weighed && !closed && (
            <Panel>
              <PanelHead icon={HandCoins} tone="bg-brand-soft text-brand" title="Keep, sell or split" />
              {load.disposition ? (
                <div className="mt-4 space-y-2 text-sm">
                  <Price label="Customer keeps" value={`${kg.format(money.keptKg)} kg (${load.keep_percent}%)`} />
                  <Price label="Offered to the co-op" value={`${kg.format(money.soldKg)} kg`} />
                </div>
              ) : walkIn && manager ? (
                <form action={setDisposition} className="mt-4 flex flex-col gap-3">
                  <input type="hidden" name="id" value={load.id} />
                  <p className="text-sm text-muted-foreground">
                    Walk-in customer: record what they decided.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["keep", "Keep 100%"],
                      ["sell", "Sell 100%"],
                      ["split", "Split"],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className="cursor-pointer rounded-xl border-2 border-line p-3 text-center text-sm font-bold has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                      >
                        <input type="radio" name="choice" value={value} required className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="keep_percent">If splitting: % the customer keeps</Label>
                    <Input
                      id="keep_percent"
                      name="keep_percent"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      step={1}
                      placeholder="70"
                    />
                  </div>
                  <Button type="submit">Save choice</Button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {walkIn
                    ? "Waiting for a Monitor to record the choice."
                    : "Waiting for the customer to choose in their app."}
                </p>
              )}
            </Panel>
          )}

          {load.buyout_status && load.buyout_status !== "none" && (
            <Panel className={cn(load.buyout_status === "requested" && "border-2 border-gold")}>
              <PanelHead
                icon={HandCoins}
                tone="bg-gold-soft text-gold-dark"
                title="Buyout"
                right={
                  <Badge
                    tone={
                      load.buyout_status === "approved"
                        ? "green"
                        : load.buyout_status === "declined"
                          ? "red"
                          : "amber"
                    }
                  >
                    {load.buyout_status === "requested"
                      ? "Waiting for decision"
                      : load.buyout_status === "approved"
                        ? load.payout_done_at
                          ? "Paid out"
                          : "Approved"
                        : "Declined"}
                  </Badge>
                }
              />
              <div className="mt-4 space-y-3 text-sm">
                <Price
                  label={`${product === "rice" ? "Rice" : "Palay"} offered`}
                  value={`${kg.format(money.soldKg)} kg`}
                />
                {load.buyout_status === "approved" && (
                  <>
                    <Price label="Price per kg" value={peso.format(Number(load.price_per_kg ?? 0))} />
                    <Price label="Sale value" value={peso.format(money.saleValue)} />
                    <Price label="Processing fee still owed" value={`− ${peso.format(money.feeOwed)}`} />
                    <div className={cn("rounded-xl p-3", money.payout > 0 ? "bg-brand-soft" : "bg-gold-soft")}>
                      {money.payout > 0 ? (
                        <Price label="Net payout to customer" value={peso.format(money.payout)} bold />
                      ) : (
                        <Price label="Customer still owes" value={peso.format(money.stillOwes)} bold />
                      )}
                    </div>
                    {load.payout_done_at && (
                      <p className="text-xs text-muted-foreground">
                        Paid out {formatDate(new Date(load.payout_done_at))}.
                      </p>
                    )}
                  </>
                )}
                {load.buyout_status === "declined" && (
                  <p className="text-muted-foreground">The customer claims all of the grain.</p>
                )}
              </div>

              {chair && load.buyout_status === "requested" && (
                <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <form action={approveBuyout} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input type="hidden" name="id" value={load.id} />
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor="price_per_kg">Price per kg (₱)</Label>
                      <Input
                        id="price_per_kg"
                        name="price_per_kg"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        defaultValue={settings.farmgate_price_per_kg || undefined}
                        required
                      />
                    </div>
                    <Button type="submit">Approve buyout</Button>
                  </form>
                  <form action={declineBuyout}>
                    <input type="hidden" name="id" value={load.id} />
                    <Button type="submit" variant="outline" className="w-full text-danger hover:text-danger">
                      Decline
                    </Button>
                  </form>
                </div>
              )}
              {!chair && load.buyout_status === "requested" && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Only the Chairperson can approve or decline.
                </p>
              )}
              {chair && load.buyout_status === "approved" && !load.payout_done_at && money.payout > 0 && (
                <form action={markPayoutDone} className="mt-4">
                  <input type="hidden" name="id" value={load.id} />
                  <Button type="submit" className="w-full">
                    Mark {peso.format(money.payout)} as paid out
                  </Button>
                </form>
              )}
            </Panel>
          )}

          {storedAt && expires && left !== null && (
            <Panel>
              <PanelHead
                icon={Warehouse}
                tone="bg-info-soft text-info-dark"
                title="Storage record"
                right={
                  finished ? (
                    <Badge tone="gray">Released</Badge>
                  ) : (
                    <ExpiryBadge daysLeft={left} warningDays={settings.warning_days} />
                  )
                }
              />
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Fact label="Stored" value={product === "rice" ? "Rice" : "Palay"} />
                <Fact label="Since" value={formatDate(storedAt)} />
                <Fact label="Expires" value={formatDate(expires)} />
                <Fact label="Lifeline" value={`${settings.lifeline[product]} days`} />
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHead icon={Scale} tone="bg-brand-soft text-brand" title="Intake summary" />
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Fact label="Sacks" value={load.sacks || load.kilos ? `${load.sacks} sacks` : "Not counted yet"} />
              <Fact label="Weight" value={load.sacks || load.kilos ? `${kg.format(load.kilos)} kg` : "Not weighed yet"} />
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
            {load.harvest_address && (
              <div className="mt-4">
                <HarvestAddress address={load.harvest_address} />
              </div>
            )}
            {(load.preferred_date || load.customer_note) && (
              <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
                {load.preferred_date && (
                  <div className="text-muted-foreground">
                    Preferred date:{" "}
                    <strong className="text-ink">{formatDate(new Date(load.preferred_date))}</strong>
                  </div>
                )}
                {load.customer_note && <p className="mt-1 text-ink">&ldquo;{load.customer_note}&rdquo;</p>}
              </div>
            )}
          </Panel>
        </div>

        {!closed && (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card xl:self-start">
            <h2 className="font-extrabold text-ink">Billing summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Price label="Processing fee" value={peso.format(load.agreed_price)} bold />
              <Price label="Paid in cash" value={peso.format(money.paidCash)} />
              {load.buyout_status === "approved" && (
                <Price
                  label="Covered by the buyout"
                  value={peso.format(Math.min(money.saleValue, money.feeOwed))}
                />
              )}
              <div className={cn("rounded-xl p-3", money.stillOwes > 0 ? "bg-gold-soft" : "bg-brand-soft")}>
                <Price label="Balance due" value={peso.format(money.stillOwes)} bold />
              </div>
            </div>

            {manager &&
              (load.is_paid ? (
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
                    <Label htmlFor="amount_paid">Cash received (₱)</Label>
                    <Input
                      id="amount_paid"
                      name="amount_paid"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      defaultValue={money.stillOwes || load.agreed_price}
                      required
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full">
                    Mark paid
                  </Button>
                </form>
              ))}
          </section>
        )}
      </div>

      {/* Delete: the first tap only asks "Are you sure?" (?confirm=delete);
          the job is removed only by the "Yes, delete" button. */}
      {manager && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card">
          {confirmingDelete ? (
            <div className="rounded-xl border-l-4 border-danger bg-danger-soft p-4">
              <p className="font-extrabold text-ink">Delete this job?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                #{jobRef(load.id)} for {name} will be removed for good. Only do this if it was
                entered by mistake.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <form action={deleteLoad}>
                  <input type="hidden" name="id" value={load.id} />
                  <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="size-4" aria-hidden />
                    Yes, delete
                  </Button>
                </form>
                <Link
                  href={`/loads/${load.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                >
                  Cancel
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-ink">Entered by mistake?</h2>
                <p className="text-xs text-muted-foreground">You will be asked to confirm.</p>
              </div>
              <Link
                href={`/loads/${load.id}?confirm=delete`}
                className={cn(buttonVariants({ variant: "outline" }), "text-danger hover:text-danger")}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete job
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
