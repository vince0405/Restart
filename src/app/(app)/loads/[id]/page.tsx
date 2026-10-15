import Link from "next/link";
import { Notice } from "@/components/rps/notice";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, Droplet, HandCoins, History, Scale, Trash2, Warehouse } from "lucide-react";
import { Badge, ExpiryBadge, PaidBadge, StageBadge } from "@/components/rps/badge";
import { HarvestAddress } from "@/components/rps/harvest-address";
import { Breadcrumbs } from "@/components/rps/breadcrumbs";
import { PageTitle } from "@/components/rps/page-title";
import { Fact, MoneyRow, Panel, PanelHead } from "@/components/rps/panel";
import { Timeline } from "@/components/rps/timeline";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/components/rps/error-note";
import {
  canRelease,
  describeCount,
  countsAfter,
  firstStage,
  daysLeft,
  expiryDate,
  isServiceType,
  isStage,
  jobRef,
  type LoadRow,
  nextStage,
  prevStage,
  productFor,
  SERVICE_TYPES,
  settlement,
  stepsFor,
} from "@/lib/loads";
import { canApproveBuyout, canManage, canSeeHistory, canWork, isStaff } from "@/lib/roles";
import type { AuditEntry } from "@/lib/audit";
import { AuditList } from "@/components/rps/audit-list";
import { priceListTotal } from "@/lib/pricing";
import { getPriceHistory, getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  approveBuyout,
  declineBuyout,
  deleteLoad,
  joinDryerLoad,
  leaveDryerLoad,
  markNotPaid,
  markPaid,
  markPayoutDone,
  moveStage,
  recordOutput,
  setDisposition,
  storeLoad,
  updateDetails,
  updateFee,
} from "../actions";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
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
  const { error, confirm, edit } = await searchParams;
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

  // This job's history of changes (Chairperson and Auditor; supabase/sql/011).
  const showHistory = canSeeHistory(role);
  let history: AuditEntry[] = [];
  let historyNames = new Map<string, string>();
  if (showHistory) {
    const { data: log } = await supabase
      .from("audit_log")
      .select("*")
      .eq("table_name", "loads")
      .eq("row_id", id)
      .order("changed_at", { ascending: false })
      .limit(50);
    history = (log ?? []) as AuditEntry[];
    const who = [...new Set(history.map((e) => e.changed_by).filter((v): v is string => !!v))];
    if (who.length) {
      const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", who);
      historyNames = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string) || "Unnamed"]));
    }
  }

  // Which buttons this person gets. The database enforces the same rules.
  const worker = canWork(role);

  // Shared dryer load (Ticket 29): the other jobs in this job's load, or
  // the loads still drying that have room for this job.
  const maxSacks = settings.rates.dryer_load_max_sacks;
  let dryerMates: { id: string; customer_name: string; sacks: number; drying_fee: number | null }[] = [];
  let openDryerLoads: { id: string; jobs: number; sacks: number }[] = [];
  if (load.dryer_load_id) {
    const { data: mates } = await supabase
      .from("loads")
      .select("id, customer_name, sacks, drying_fee")
      .eq("dryer_load_id", load.dryer_load_id);
    dryerMates = (mates ?? []).filter((m) => m.id !== load.id);
  } else if (worker && load.stage === "Drying" && load.request_status === "accepted") {
    const { data: inLoads } = await supabase
      .from("loads")
      .select("dryer_load_id, sacks")
      .eq("stage", "Drying")
      .not("dryer_load_id", "is", null);
    const byLoad = new Map<string, { id: string; jobs: number; sacks: number }>();
    for (const row of inLoads ?? []) {
      const key = row.dryer_load_id as string;
      const entry = byLoad.get(key) ?? { id: key, jobs: 0, sacks: 0 };
      entry.jobs++;
      entry.sacks += Number(row.sacks);
      byLoad.set(key, entry);
    }
    openDryerLoads = [...byLoad.values()].filter((d) => d.sacks + load.sacks <= maxSacks);
  }
  const dryerSacks = load.sacks + dryerMates.reduce((n, m) => n + Number(m.sacks), 0);
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
  // Releasing also needs the fee settled (paid, or covered by a buyout).
  const unpaidRelease = next === "Released" && !canRelease(load);
  const canAdvance =
    worker && !closed && next !== null && (!atReady || (weighed && chosen)) && !unpaidRelease;
  // After harvesting and after drying, moving on needs the new count.
  const countStep = countsAfter(load.stage);
  // The reference price the harvest count starts from, and since when (Ticket 28).
  const [reference] = countStep === "harvesting" ? await getPriceHistory() : [];
  const canStore = worker && atReady && !stored && weighed && chosen && money.keptKg > 0;

  const product = productFor(load.service_type);
  // The fee parts the price list has worked out so far (supabase/sql/009).
  const hasParts = load.harvest_fee != null || load.drying_fee != null || load.milling_fee != null;
  const listTotal = priceListTotal(load);
  // Staff's discount or extra charge, kept across counts (supabase/sql/012).
  const adjustment = hasParts ? Number(load.agreed_price) - listTotal : 0;
  const adjusted = adjustment !== 0;
  const storedAt = stored ? new Date(load.stored_at as string) : null;
  const expires = storedAt ? expiryDate(storedAt, load.service_type, settings.lifeline) : null;
  const left = expires ? daysLeft(expires) : null;
  const walkIn = !load.customer_id;
  // The service can only change before work starts (Ticket 35, supabase/sql/014).
  const atFirstStep = load.stage === firstStage(load.service_type);
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
      <Breadcrumbs items={[{ label: "Jobs", href: "/loads" }, { label: `#${jobRef(load.id)}` }]} />

      <PageTitle
        eyebrow="Job details"
        title={`#${jobRef(load.id)}`}
        description={`${load.service_type} · Created ${formatDate(new Date(load.created_at))}`}
        action={
          canAdvance &&
          !countStep && (
            <form action={moveStage}>
              {stageFields("next")}
              <SubmitButton size="lg" className="w-full sm:w-auto">
                {next === "Released" ? "Release to customer" : `Move to ${next}`}
              </SubmitButton>
            </form>
          )
        }
      />

      <ErrorNote code={error} />

      {role === "auditor" && (
        <Notice tone="info">Read-only: auditors can see everything but change nothing.</Notice>
      )}

      {rejected && (
        <Notice tone="error" title="Request rejected">{load.reject_reason}</Notice>
      )}

      {cancelled && (
        <Notice tone="info" title="Cancelled by the customer">Cancelled{load.cancelled_at ? ` on ${formatDate(new Date(load.cancelled_at))}` : ""}. Nothing to do.</Notice>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
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
                {countStep === "harvesting" && (
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="market_price_per_kg">Today&rsquo;s market price of palay (₱ per kg)</Label>
                    <Input
                      id="market_price_per_kg"
                      name="market_price_per_kg"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      defaultValue={load.market_price_per_kg ?? (settings.farmgate_price_per_kg || undefined)}
                      required
                    />
                    {reference && (
                      <p className="text-xs text-muted-foreground">
                        Starts at the co-op&rsquo;s reference price, {peso.format(reference.price_per_kg)}{" "}
                        (set {formatDate(new Date(reference.set_at))}). Change it if today&rsquo;s
                        price is different.
                      </p>
                    )}
                  </div>
                )}
                {countStep === "harvesting" && (
                  <fieldset className="flex flex-col gap-2 sm:col-span-2">
                    <legend className="mb-2 text-sm font-bold text-ink">
                      How does the farmer pay the {settings.rates.harvest_share_percent}% harvest share?
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["pesos", "In pesos", "Added to the fee"],
                        ["palay", "In palay", "The co-op keeps the kg"],
                      ].map(([value, label, hint]) => (
                        <label
                          key={value}
                          className="cursor-pointer rounded-xl border-2 border-line bg-card p-3 text-center text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                        >
                          <input
                            type="radio"
                            name="harvest_fee_in"
                            value={value}
                            defaultChecked={value === "pesos"}
                            className="sr-only"
                          />
                          <span className="block font-bold text-ink">{label}</span>
                          <span className="block text-xs text-muted-foreground">{hint}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      In palay: the harvest fee is ₱0, the co-op keeps{" "}
                      {settings.rates.harvest_share_percent}% of the kg and sacks, and drying and
                      milling are worked out on the farmer&rsquo;s share.
                    </p>
                  </fieldset>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {countStep === "harvesting"
                  ? `The fee is worked out from these numbers: harvesting is ${settings.rates.harvest_share_percent}% of the kg × the market price; drying is ${peso.format(settings.rates.dryer_load_fee)} per dryer load of up to ${settings.rates.dryer_load_max_sacks} sacks.`
                  : load.service_type === "Package Deal"
                    ? `Milling is ${peso.format(settings.rates.milling_fee_per_sack)} per sack, counted now.`
                    : null}
              </p>
              <SubmitButton size="lg" className="w-full sm:w-auto sm:self-start">
                Save count and move to {next}
              </SubmitButton>
            </form>
          )}

          {worker && !closed && unpaidRelease && (!atReady || (weighed && chosen)) && (
            <Notice tone="warning" className="mb-0 mt-5">
              Release is locked: the customer still owes {peso.format(money.stillOwes)}. Record the
              payment in the billing summary first.
            </Notice>
          )}

          {worker && atReady && weighed && !chosen && (
            <Notice tone="warning" className="mb-0 mt-5">Weighed. Release and storage unlock once {walkIn ? "the walk-in's" : "the customer's"} keep /
              sell / split choice is recorded.</Notice>
          )}

          {worker && (prev || canStore) && (
            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
              {canStore && (
                <form action={storeLoad} className="flex-1">
                  <input type="hidden" name="id" value={load.id} />
                  <SubmitButton variant="secondary" size="lg" className="w-full">
                    <Warehouse className="size-5" aria-hidden />
                    Store {product} at the mill
                  </SubmitButton>
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    {kg.format(money.keptKg)} kg kept · stored {product} keeps{" "}
                    {settings.lifeline[product]} days.
                  </p>
                </form>
              )}
              {prev && (
                <form action={moveStage} className="flex-1">
                  {stageFields("back")}
                  <SubmitButton variant="outline" size="lg" className="w-full">
                    Back one step (to {prev})
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </Panel>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {!closed && (load.dryer_load_id || (worker && load.stage === "Drying")) && (
            <Panel>
              <PanelHead
                icon={Droplet}
                tone="bg-info-soft text-info-dark"
                title="Dryer load"
                right={
                  load.dryer_load_id ? (
                    <Badge tone="blue">
                      {dryerMates.length
                        ? `Shared with ${dryerMates.length} other ${dryerMates.length === 1 ? "job" : "jobs"}`
                        : "On its own so far"}
                    </Badge>
                  ) : undefined
                }
              />
              {load.dryer_load_id ? (
                <div className="mt-4 space-y-3 text-sm">
                  <MoneyRow
                    label="This job's share of the load fee"
                    value={load.drying_fee != null ? peso.format(Number(load.drying_fee)) : "—"}
                  />
                  <MoneyRow label="Sacks in the load" value={`${dryerSacks} of ${maxSacks}`} />
                  {dryerMates.length > 0 && (
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {dryerMates.map((m) => (
                        <li key={m.id} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                          <Link href={`/loads/${m.id}`} className="font-bold text-brand">
                            #{jobRef(m.id)} · {m.customer_name}
                          </Link>
                          <span className="text-muted-foreground">
                            {m.sacks} sacks
                            {m.drying_fee != null ? ` · ${peso.format(Number(m.drying_fee))}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The {peso.format(settings.rates.dryer_load_fee)} load fee is split by sacks.
                  </p>
                  {worker && load.stage === "Drying" && (
                    <form action={leaveDryerLoad}>
                      <input type="hidden" name="id" value={load.id} />
                      <SubmitButton variant="outline" className="w-full sm:w-auto">
                        Take out of this dryer load
                      </SubmitButton>
                    </form>
                  )}
                </div>
              ) : load.sacks > 0 ? (
                <form action={joinDryerLoad} className="mt-4 flex flex-col gap-3">
                  <input type="hidden" name="id" value={load.id} />
                  <p className="text-sm text-muted-foreground">
                    Drying with other farmers&rsquo; palay? Put this job ({load.sacks} sacks) in a
                    shared load and the {peso.format(settings.rates.dryer_load_fee)} fee is split by
                    sacks. Up to {maxSacks} sacks per load.
                  </p>
                  <div className="flex flex-col gap-2">
                    {openDryerLoads.map((d) => (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                      >
                        <input type="radio" name="dryer_load" value={d.id} required />
                        <span>
                          <span className="font-bold text-ink">
                            Dryer load with {d.jobs} {d.jobs === 1 ? "job" : "jobs"}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            · {d.sacks} of {maxSacks} sacks used
                          </span>
                        </span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                      <input type="radio" name="dryer_load" value="new" required />
                      <span className="font-bold text-ink">Start a new dryer load</span>
                    </label>
                  </div>
                  <SubmitButton variant="secondary" className="sm:self-start">
                    Put in dryer load
                  </SubmitButton>
                </form>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Count the sacks first to share a dryer load.
                </p>
              )}
            </Panel>
          )}

          {(atReady || weighed) && !closed && (
            <Panel className={cn(atReady && !weighed && "border-2 border-gold")}>
              <PanelHead
                icon={Scale}
                tone="bg-gold-soft text-gold-dark"
                title="Weigh batch"
                right={weighed ? <Badge tone="green">Weighed</Badge> : <Badge tone="amber">Needed</Badge>}
              />
              <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                <Fact label="Palay in" value={`${kg.format(load.kilos)} kg`} />
                <Fact
                  label={`${product === "rice" ? "Rice" : "Palay"} out`}
                  value={weighed ? `${kg.format(load.output_kg ?? 0)} kg` : "—"}
                />
                {weighed && load.kilos > 0 && (
                  <Fact label="Out ÷ in" value={`${Math.round(((load.output_kg ?? 0) / load.kilos) * 100)}%`} />
                )}
              </dl>
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
                  <SubmitButton>{weighed ? "Update weight" : "Save weight"}</SubmitButton>
                </form>
              )}
            </Panel>
          )}

          {weighed && !closed && (
            <Panel>
              <PanelHead icon={HandCoins} tone="bg-brand-soft text-brand" title="Keep, sell or split" />
              {load.disposition ? (
                <div className="mt-4 space-y-2 text-sm">
                  <MoneyRow label="Customer keeps" value={`${kg.format(money.keptKg)} kg (${load.keep_percent}%)`} />
                  <MoneyRow label="Offered to the co-op" value={`${kg.format(money.soldKg)} kg`} />
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
                  <SubmitButton>Save choice</SubmitButton>
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
                <MoneyRow
                  label={`${product === "rice" ? "Rice" : "Palay"} offered`}
                  value={`${kg.format(money.soldKg)} kg`}
                />
                {load.buyout_status === "approved" && (
                  <>
                    <MoneyRow label="Price per kg" value={peso.format(Number(load.price_per_kg ?? 0))} />
                    <MoneyRow label="Sale value" value={peso.format(money.saleValue)} />
                    <MoneyRow label="Processing fee still owed" value={`− ${peso.format(money.feeOwed)}`} />
                    <div className={cn("rounded-xl p-3", money.payout > 0 ? "bg-brand-soft" : "bg-gold-soft")}>
                      {money.payout > 0 ? (
                        <MoneyRow label="Net payout to customer" value={peso.format(money.payout)} strong />
                      ) : (
                        <MoneyRow label="Customer still owes" value={peso.format(money.stillOwes)} strong />
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
                    <SubmitButton>Approve buyout</SubmitButton>
                  </form>
                  <form action={declineBuyout}>
                    <input type="hidden" name="id" value={load.id} />
                    <SubmitButton variant="outline" className="w-full text-danger hover:text-danger">
                      Decline
                    </SubmitButton>
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
                  <SubmitButton className="w-full">
                    Mark {peso.format(money.payout)} as paid out
                  </SubmitButton>
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
              <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Fact label="Stored" value={product === "rice" ? "Rice" : "Palay"} />
                <Fact label="Since" value={formatDate(storedAt)} />
                <Fact label="Expires" value={formatDate(expires)} />
                <Fact label="Lifeline" value={`${settings.lifeline[product]} days`} />
              </dl>
            </Panel>
          )}

          <Panel>
            <details open={edit === "1"} className="group/details">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Scale className="size-5" aria-hidden />
                </span>
                <span className="text-base font-extrabold text-ink">Intake details</span>
                <span className="ml-auto text-sm font-bold text-brand">
                  <span className="group-open/details:hidden">Show</span>
                  <span className="hidden group-open/details:inline">Hide</span>
                </span>
              </summary>
            <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
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
            </dl>
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
            {manager && !closed && (
              <details open={edit === "1"} className="mt-5 border-t border-line pt-4">
                <summary className="min-h-11 cursor-pointer text-sm font-bold text-brand">
                  Edit details
                </summary>
                <form action={updateDetails} className="mt-2 flex flex-col gap-4">
                  <input type="hidden" name="id" value={load.id} />
                  {walkIn ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="edit_name">Customer name</Label>
                      <Input id="edit_name" name="customer_name" defaultValue={load.customer_name} maxLength={120} required />
                    </div>
                  ) : (
                    <input type="hidden" name="customer_name" value={load.customer_name} />
                  )}
                  {atFirstStep ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="edit_service">Service</Label>
                        <Select id="edit_service" name="service_type" defaultValue={load.service_type}>
                          {SERVICE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          A new service starts again at its first step, and the fee is worked out
                          again from the price list.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="edit_sacks">Sacks</Label>
                          <Input id="edit_sacks" name="sacks" type="number" inputMode="numeric" min={0} step={1} defaultValue={load.sacks || undefined} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="edit_kilos">Weight (kg)</Label>
                          <Input id="edit_kilos" name="kilos" type="number" inputMode="decimal" min={0} step={0.01} defaultValue={load.kilos || undefined} />
                        </div>
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Only used when changing to Drying only or Milling only. Harvesting
                          services are counted after the harvest.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The service can&rsquo;t be changed: work on this job has started.
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit_address">Farm address (harvesting services)</Label>
                    <Input id="edit_address" name="harvest_address" defaultValue={load.harvest_address ?? ""} maxLength={300} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit_note">Note</Label>
                    <Textarea id="edit_note" name="customer_note" defaultValue={load.customer_note ?? ""} maxLength={1000} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Counts, fees and payments are changed in their own places. Every edit is kept in
                    the history.
                  </p>
                  <SubmitButton variant="outline" className="sm:self-start">
                    Save details
                  </SubmitButton>
                </form>
              </details>
            )}
            </details>
          </Panel>

          {showHistory && (
            <Panel>
              <details className="group/history">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <History className="size-5" aria-hidden />
                  </span>
                  <span className="text-base font-extrabold text-ink">History ({history.length})</span>
                  <span className="ml-auto text-sm font-bold text-brand">
                    <span className="group-open/history:hidden">Show</span>
                    <span className="hidden group-open/history:inline">Hide</span>
                  </span>
                </summary>
                <div className="mt-5">
                  {history.length ? (
                    <AuditList entries={history} names={historyNames} showTarget={false} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No changes recorded yet. Changes are recorded from the day the history was
                      switched on.
                    </p>
                  )}
                </div>
              </details>
            </Panel>
          )}
        </div>

        {!closed && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card xl:self-start">
            <h2 className="font-extrabold text-ink">Billing summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              {load.harvest_fee_in === "palay" && load.harvest_kept_kg != null && (
                <MoneyRow
                  label="Harvest share paid in palay"
                  value={`${kg.format(Number(load.harvest_kept_kg))} kg`}
                />
              )}
              {load.harvest_fee != null && load.harvest_fee_in !== "palay" && (
                <MoneyRow
                  label={
                    Number(load.market_price_per_kg) > 0
                      ? `Harvesting: ${kg.format(Number(load.harvest_fee) / Number(load.market_price_per_kg))} kg × ${peso.format(Number(load.market_price_per_kg))}`
                      : "Harvesting"
                  }
                  value={peso.format(Number(load.harvest_fee))}
                />
              )}
              {load.drying_fee != null && (
                <MoneyRow
                  label={load.dryer_load_id ? "Drying (share of a shared load)" : "Drying"}
                  value={peso.format(Number(load.drying_fee))}
                />
              )}
              {load.milling_fee != null && <MoneyRow label="Milling" value={peso.format(Number(load.milling_fee))} />}
              {adjusted && (
                <MoneyRow
                  label={adjustment < 0 ? "Discount" : "Extra charge"}
                  value={peso.format(adjustment)}
                />
              )}
              <MoneyRow label="Processing fee" value={peso.format(load.agreed_price)} strong />
              <MoneyRow label="Paid in cash" value={peso.format(money.paidCash)} />
              {load.buyout_status === "approved" && (
                <MoneyRow
                  label="Covered by the buyout"
                  value={peso.format(Math.min(money.saleValue, money.feeOwed))}
                />
              )}
              <div className={cn("rounded-xl p-3", money.stillOwes > 0 ? "bg-gold-soft" : "bg-brand-soft")}>
                <MoneyRow label="Balance due" value={peso.format(money.stillOwes)} strong />
              </div>
            </div>

            {manager &&
              (load.is_paid ? (
                <form action={markNotPaid} className="mt-4">
                  <input type="hidden" name="id" value={load.id} />
                  <SubmitButton variant="outline" className="w-full">
                    Mark not paid
                  </SubmitButton>
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
                  <SubmitButton size="lg" className="w-full">
                    Mark paid
                  </SubmitButton>
                </form>
              ))}

            {manager && !load.is_paid && (
              <details className="mt-4 border-t border-line pt-4">
                <summary className="min-h-11 cursor-pointer text-sm font-bold text-brand">
                  Change the fee (e.g. a discount)
                </summary>
                <form action={updateFee} className="mt-2 flex flex-col gap-3">
                  <input type="hidden" name="id" value={load.id} />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="new_fee">Processing fee (₱)</Label>
                    <Input
                      id="new_fee"
                      name="agreed_price"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      defaultValue={load.agreed_price}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hasParts
                      ? "A discount or extra charge is kept: the next count adds the new price-list amounts and keeps the same difference."
                      : "This job has no price-list amounts yet. The harvest count will work the fee out from the price list."}
                  </p>
                  <SubmitButton variant="outline">Save fee</SubmitButton>
                </form>
              </details>
            )}
          </section>
        )}
      </div>

      {/* Delete: the first tap only asks "Are you sure?" (?confirm=delete);
          the job is removed only by the "Yes, delete" button. */}
      {manager && (
        <section className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-card">
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
                  <SubmitButton variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="size-4" aria-hidden />
                    Yes, delete
                  </SubmitButton>
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
