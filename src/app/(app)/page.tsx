import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Leaf,
  Plus,
  ReceiptText,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge, PaidBadge, StageBadge, type Tone } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import {
  EXPIRY_SOON_DAYS,
  expiryLabel,
  expiryTone,
  jobRef,
  type LoadRow,
  productFor,
  isServiceType,
  storedDaysLeft,
  summarize,
} from "@/lib/loads";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS hands back only the signed-in Monitor's loads.
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at",
    )
    .order("created_at", { ascending: false });
  const loads = (data ?? []) as LoadRow[];

  const now = new Date();
  const s = summarize(loads, now);

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
      note: `${s.palaySacks} sacks`,
      icon: Leaf,
      tone: "amber",
      href: "/storage?type=palay",
    },
    {
      label: "Rice in storage",
      value: kg.format(s.riceKg),
      unit: "kg",
      note: `${s.riceSacks} sacks`,
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
    .map((load) => ({ load, left: storedDaysLeft(load, now) }))
    .filter((a): a is { load: LoadRow; left: number } => a.left !== null && a.left <= EXPIRY_SOON_DAYS)
    .sort((a, b) => a.left - b.left);
  const unpaidReleased = loads.filter((l) => l.stage === "Released" && !l.is_paid);
  const alertCount = expiryAlerts.length + unpaidReleased.length;

  return (
    <div>
      <PageTitle
        eyebrow="Monitor overview"
        title={greeting(now)}
        description="Here's what's happening across the mill today."
        action={
          <Link href="/loads/new" className={cn(buttonVariants(), "md:hidden")}>
            <Plus className="size-[18px]" aria-hidden />
            New load
          </Link>
        }
      />

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          Could not load your data: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <Link
            key={k.label}
            href={k.href}
            className={cn(
              "rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand/40",
              i === 4 && "col-span-2 md:col-span-1",
            )}
          >
            <div className="mb-4 flex items-start justify-between">
              <div
                className={cn(
                  "grid size-10 place-items-center rounded-xl",
                  k.tone === "green" && "bg-brand-soft text-brand",
                  k.tone === "amber" && "bg-gold-soft text-gold-dark",
                  k.tone === "blue" && "bg-info-soft text-info-dark",
                  k.tone === "red" && "bg-danger-soft text-danger",
                )}
              >
                <k.icon className="size-5" aria-hidden />
              </div>
              {k.urgent && (
                <span className="mt-1 size-2 rounded-full bg-danger ring-4 ring-danger-soft" />
              )}
            </div>
            <div className="text-xs font-semibold text-muted-foreground">{k.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold tracking-tight text-ink">{k.value}</span>
              {k.unit && <span className="text-xs font-bold text-muted-foreground">{k.unit}</span>}
            </div>
            <div
              className={cn(
                "mt-2 text-[11px] font-semibold",
                k.urgent ? "text-danger" : "text-muted-foreground",
              )}
            >
              {k.note}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card md:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-ink">Live job board</h2>
              <p className="text-xs text-muted-foreground">
                {s.activeJobs} {s.activeJobs === 1 ? "job" : "jobs"} currently in progress
              </p>
            </div>
            <Link href="/loads" className="flex items-center gap-1 text-xs font-bold text-brand">
              View all <ArrowRight className="size-[15px]" aria-hidden />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {BOARD.map((col) => {
              const jobs = loads.filter((l) => l.stage === col.stage);
              return (
                <div key={col.stage} className="min-w-[13rem] flex-1 rounded-xl bg-surface p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", col.dot)} />
                    <span className="text-xs font-extrabold text-ink">{col.stage}</span>
                    <span className="ml-auto rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {jobs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {jobs.length === 0 && (
                      <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
                        Nothing here
                      </p>
                    )}
                    {jobs.slice(0, 4).map((job) => (
                      <Link
                        key={job.id}
                        href={`/loads/${job.id}`}
                        className="block w-full rounded-xl border border-line bg-white p-3 text-left shadow-sm transition hover:border-brand/40"
                      >
                        <div className="text-[11px] font-bold text-brand">#{jobRef(job.id)}</div>
                        <div className="mt-1 truncate text-sm font-bold text-ink">
                          {job.customer_name}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{kg.format(job.kilos)} kg</span>
                          <ChevronRight className="size-3.5" aria-hidden />
                        </div>
                      </Link>
                    ))}
                    {jobs.length > 4 && (
                      <Link
                        href="/loads"
                        className="block text-center text-[11px] font-bold text-brand"
                      >
                        +{jobs.length - 4} more
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-extrabold text-ink">Alerts</h2>
            {alertCount > 0 ? (
              <Badge tone="red">{alertCount} to check</Badge>
            ) : (
              <Badge tone="green">All clear</Badge>
            )}
          </div>
          <div className="space-y-3">
            {alertCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No stored grain close to expiry, and every released load is paid.
              </p>
            )}
            {expiryAlerts.slice(0, 4).map(({ load, left }) => (
              <Link
                key={load.id}
                href={`/loads/${load.id}`}
                className={cn(
                  "block rounded-xl border-l-4 p-3",
                  expiryTone(left) === "red"
                    ? "border-danger bg-danger-soft"
                    : "border-gold bg-gold-soft",
                )}
              >
                <div className="text-xs font-bold text-ink">
                  {isServiceType(load.service_type) && productFor(load.service_type) === "rice"
                    ? "Rice"
                    : "Palay"}{" "}
                  #{jobRef(load.id)} · {expiryLabel(left).toLowerCase()}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {load.customer_name} · {kg.format(load.kilos)} kg
                </div>
              </Link>
            ))}
            {unpaidReleased.slice(0, 3).map((load) => (
              <Link
                key={load.id}
                href={`/loads/${load.id}`}
                className="block rounded-xl border-l-4 border-danger bg-danger-soft p-3"
              >
                <div className="text-xs font-bold text-ink">
                  #{jobRef(load.id)} released but not paid
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {load.customer_name} · {peso.format(load.agreed_price)}
                </div>
              </Link>
            ))}
          </div>
          <Link
            href="/storage"
            className="mt-4 block w-full rounded-xl border border-line py-2.5 text-center text-xs font-bold text-brand"
          >
            View storage
          </Link>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-card md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-ink">Recent loads</h2>
            <p className="text-xs text-muted-foreground">Latest mill activity</p>
          </div>
          <Link href="/loads" className="text-xs font-bold text-brand">
            View all
          </Link>
        </div>
        {loads.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No loads yet. Tap &ldquo;New load&rdquo; when a customer&rsquo;s job starts.
          </p>
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_1.4fr_1fr_1fr_1fr] border-b border-line px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Job ID</span>
              <span>Customer</span>
              <span>Service</span>
              <span>Amount</span>
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
                <span className="text-xs font-bold text-ink">{peso.format(load.agreed_price)}</span>
                <span className="flex flex-wrap gap-1.5">
                  <span className="hidden md:inline">
                    <StageBadge stage={load.stage} />
                  </span>
                  <PaidBadge isPaid={load.is_paid} />
                </span>
              </Link>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
