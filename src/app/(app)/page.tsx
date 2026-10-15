import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  HandCoins,
  Inbox,
  Leaf,
  Plus,
  ReceiptText,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge, PaidBadge, StageBadge, type Tone } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { StatCard } from "@/components/rps/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNote } from "@/components/rps/error-note";
import {
  expiryLabel,
  expiryTone,
  jobRef,
  type LoadRow,
  moneySummary,
  settlement,
  productFor,
  isServiceType,
  storedDaysLeft,
  summarize,
} from "@/lib/loads";
import { canManage, isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

// The job board shows work still happening, one column per step.
const BOARD = [
  { stage: "Received", dot: "bg-info" },
  { stage: "Harvesting", dot: "bg-gold-dark" },
  { stage: "Drying", dot: "bg-gold" },
  { stage: "Milling", dot: "bg-brand" },
  { stage: "Ready", dot: "bg-brand-dark" },
];

function greeting(now: Date) {
  const hour = Number(
    now.toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }),
  );
  if (hour < 12) return "Magandang umaga";
  if (hour < 18) return "Magandang hapon";
  return "Magandang gabi";
}

export default async function DashboardPage() {
  const { supabase, role } = await requireRole(isStaff);

  // RLS hands back only the signed-in Monitor's loads.
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, request_status, output_kg, disposition, keep_percent, buyout_status, price_per_kg, payout_done_at",
    )
    .eq("request_status", "accepted")
    .order("created_at", { ascending: false });
  const loads = (data ?? []) as LoadRow[];

  // Pending requests are counted separately: they are not jobs yet.
  const { count: pendingRequests } = await supabase
    .from("loads")
    .select("id", { count: "exact", head: true })
    .eq("request_status", "pending");

  const { lifeline, warning_days } = await getSettings();
  const now = new Date();
  const s = summarize(loads, now, lifeline, warning_days);

  const kpis: {
    label: string;
    value: string;
    unit?: string;
    note: string;
    icon: LucideIcon;
    tone: Tone;
    href: string;
    urgent?: boolean;
  }[] = [
    {
      label: "Active jobs",
      value: String(s.activeJobs),
      note: `+${s.addedToday} today`,
      icon: ClipboardList,
      tone: "green",
      href: "/loads",
    },
    {
      label: "Palay in storage",
      value: kg.format(s.palayKg),
      unit: "kg",
      note: `${s.palayLots} ${s.palayLots === 1 ? "lot" : "lots"}`,
      icon: Leaf,
      tone: "amber",
      href: "/storage?type=palay",
    },
    {
      label: "Rice in storage",
      value: kg.format(s.riceKg),
      unit: "kg",
      note: `${s.riceLots} ${s.riceLots === 1 ? "lot" : "lots"}`,
      icon: Warehouse,
      tone: "blue",
      href: "/storage?type=rice",
    },
    {
      label: "Expiring soon",
      value: String(s.expiringSoon),
      note: s.expiringSoon > 0 ? "Needs attention" : "All good",
      icon: CalendarClock,
      tone: "red",
      href: "/storage",
      urgent: s.expiringSoon > 0,
    },
    {
      label: "Not yet paid",
      value: peso.format(s.unpaidTotal),
      note: `${s.unpaidCount} ${s.unpaidCount === 1 ? "load" : "loads"}`,
      icon: ReceiptText,
      tone: "green",
      href: "/loads",
    },
  ];

  // Alerts: stored grain close to expiry, and rice already released but unpaid.
  const expiryAlerts = loads
    .map((load) => ({ load, left: storedDaysLeft(load, now, lifeline) }))
    .filter((a): a is { load: LoadRow; left: number } => a.left !== null && a.left <= warning_days)
    .sort((a, b) => a.left - b.left);
  // Released but still owing: same maths as the job screen (a fee covered by
  // a buyout is not owed).
  const unpaidReleased = loads
    .map((load) => ({ load, owes: settlement(load).stillOwes }))
    .filter(({ load, owes }) => load.stage === "Released" && owes > 0);
  const buyoutsWaiting = loads.filter((l) => l.buyout_status === "requested");
  const alertCount = expiryAlerts.length + unpaidReleased.length + buyoutsWaiting.length;
  const money = moneySummary(loads);

  return (
    <div>
      <PageTitle
        eyebrow="Monitor overview"
        title={greeting(now)}
        description="Here's what's happening across the mill today."
        action={
          canManage(role) && (
            <Link href="/loads/new" className={cn(buttonVariants(), "md:hidden")}>
              <Plus className="size-[18px]" aria-hidden />
              New walk-in job
            </Link>
          )
        }
      />

      <ErrorNote code={error ? "load_failed" : null} />

      {(pendingRequests ?? 0) > 0 && (
        <Link
          href="/requests"
          className="mb-5 flex min-h-14 items-center gap-3 rounded-2xl border-l-4 border-gold bg-gold-soft p-4 shadow-card transition-colors hover:border-brand"
        >
          <Inbox className="size-5 shrink-0 text-gold-dark" aria-hidden />
          <span className="flex-1 text-sm font-bold text-ink">
            {pendingRequests} new {pendingRequests === 1 ? "request" : "requests"} waiting
            {canManage(role) ? " for you to accept or reject" : ""}
          </span>
          <ArrowRight className="size-4 text-gold-dark" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
            unit={k.unit}
            note={k.note}
            icon={k.icon}
            tone={k.tone === "gray" ? "green" : k.tone}
            href={k.href}
            attention={k.urgent}
            className={cn(i === 4 && "col-span-2 md:col-span-1")}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <section className="min-w-0 rounded-2xl border border-line bg-card p-4 shadow-card md:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-ink">Live job board</h2>
              <p className="text-xs text-muted-foreground">
                {s.activeJobs} {s.activeJobs === 1 ? "job" : "jobs"} currently in progress
              </p>
            </div>
            <Link href="/loads" className="flex min-h-11 items-center gap-1 px-1 text-sm font-bold text-brand">
              View all <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {BOARD.map((col) => {
              const jobs = loads.filter((l) => l.stage === col.stage);
              return (
                <section
                  key={col.stage}
                  aria-labelledby={`board-${col.stage}`}
                  className="min-w-[13rem] flex-1 rounded-xl bg-surface p-3"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", col.dot)} aria-hidden />
                    <h3 id={`board-${col.stage}`} className="text-sm font-extrabold text-ink">
                      {col.stage}
                    </h3>
                    <span className="ml-auto rounded-md bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground">
                      {jobs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {jobs.length === 0 && (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                        Nothing here
                      </p>
                    )}
                    {jobs.slice(0, 4).map((job) => (
                      <Link
                        key={job.id}
                        href={`/loads/${job.id}`}
                        className="block w-full rounded-xl border border-line bg-card p-3 text-left shadow-sm transition-colors hover:border-brand"
                      >
                        <div className="text-xs font-bold text-brand">#{jobRef(job.id)}</div>
                        <div className="mt-1 truncate text-sm font-bold text-ink">
                          {job.customer_name}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{job.sacks || job.kilos ? `${kg.format(job.kilos)} kg` : "Not counted yet"}</span>
                          <ChevronRight className="size-3.5" aria-hidden />
                        </div>
                      </Link>
                    ))}
                    {jobs.length > 4 && (
                      <Link
                        href="/loads"
                        className="flex min-h-11 items-center justify-center text-sm font-bold text-brand"
                      >
                        +{jobs.length - 4} more
                      </Link>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-ink">Alerts</h2>
            {alertCount > 0 ? (
              <Badge tone="red">{alertCount} to check</Badge>
            ) : (
              <Badge tone="green">All clear</Badge>
            )}
          </div>
          <div className="space-y-3" aria-live="polite">
            {alertCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No buyouts to decide, no stored grain close to expiry, and every released load is paid.
              </p>
            )}
            {buyoutsWaiting.slice(0, 3).map((load) => (
              <Link
                key={load.id}
                href={`/loads/${load.id}`}
                className="flex min-h-14 items-start gap-3 rounded-xl border-l-4 p-3 border-gold bg-gold-soft"
              >
                <HandCoins className="mt-0.5 size-5 shrink-0 text-gold-dark" aria-hidden />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    Buyout to decide · #{jobRef(load.id)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {load.customer_name} · {load.keep_percent === 0 ? "sell 100%" : `keep ${load.keep_percent}%`}
                  </span>
                </span>
              </Link>
            ))}
            {expiryAlerts.slice(0, 4).map(({ load, left }) => (
              <Link
                key={load.id}
                href={`/loads/${load.id}`}
                className={cn(
                  "flex min-h-14 items-start gap-3 rounded-xl border-l-4 p-3",
                  expiryTone(left, warning_days) === "red"
                    ? "border-danger bg-danger-soft"
                    : "border-gold bg-gold-soft",
                )}
              >
                <CalendarClock
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    expiryTone(left, warning_days) === "red" ? "text-danger" : "text-gold-dark",
                  )}
                  aria-hidden
                />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    {isServiceType(load.service_type) && productFor(load.service_type) === "rice"
                      ? "Rice"
                      : "Palay"}{" "}
                    {expiryLabel(left).toLowerCase()} · #{jobRef(load.id)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {load.customer_name} · {kg.format(settlement(load).keptKg)} kg stored
                  </span>
                </span>
              </Link>
            ))}
            {unpaidReleased.slice(0, 3).map(({ load, owes }) => (
              <Link
                key={load.id}
                href={`/loads/${load.id}`}
                className="flex min-h-14 items-start gap-3 rounded-xl border-l-4 p-3 border-danger bg-danger-soft"
              >
                <ReceiptText className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    Released, not paid · #{jobRef(load.id)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {load.customer_name} · owes {peso.format(owes)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
            Co-op stock bought:{" "}
            <strong className="text-ink">
              {kg.format(money.stockRiceKg)} kg rice · {kg.format(money.stockPalayKg)} kg palay
            </strong>
          </div>
          <Link
            href="/storage"
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-field text-sm font-bold text-brand transition-colors hover:bg-surface"
          >
            View storage
          </Link>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-card p-4 shadow-card md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-ink">Recent loads</h2>
            <p className="text-xs text-muted-foreground">Latest mill activity</p>
          </div>
          <Link href="/loads" className="flex min-h-11 items-center px-1 text-sm font-bold text-brand">
            View all
          </Link>
        </div>
        {loads.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No jobs yet. Accepted requests and walk-in jobs show up here.
          </p>
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_1.4fr_1fr_1fr_1fr] border-b border-line px-3 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Job ID</span>
              <span>Customer</span>
              <span>Service</span>
              <span className="md:text-right md:pr-4">Fee</span>
              <span>Status</span>
            </div>
            {loads.slice(0, 5).map((load) => (
              <Link
                key={load.id}
                href={`/loads/${load.id}`}
                className="grid gap-2 border-b border-line/70 px-3 py-3 last:border-0 hover:bg-surface md:grid-cols-[1fr_1.4fr_1fr_1fr_1fr] md:items-center"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand">#{jobRef(load.id)}</span>
                  <span className="md:hidden">
                    <StageBadge stage={load.stage} />
                  </span>
                </div>
                <span className="text-sm font-bold text-ink">{load.customer_name}</span>
                <span className="text-xs text-muted-foreground">{load.service_type}</span>
                <span className="text-sm font-bold tabular-nums text-ink md:text-right md:pr-4">{peso.format(load.agreed_price)}</span>
                <span className="flex flex-wrap gap-1.5">
                  <span className="hidden md:inline">
                    <StageBadge stage={load.stage} />
                  </span>
                  <PaidBadge isPaid={load.is_paid} amount={load.amount_paid} />
                </span>
              </Link>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
