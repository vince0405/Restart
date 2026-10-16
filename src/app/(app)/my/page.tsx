import Link from "next/link";
import { EmptyState } from "@/components/rps/empty-state";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  HandCoins,
  Hourglass,
  Plus,
  Scale,
  Search,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge, ExpiryBadge } from "@/components/rps/badge";
import { FilterSelect, FilterTabs, SearchBox } from "@/components/rps/list-controls";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNote } from "@/components/rps/error-note";
import { listHref, parseChoice, parseSearch } from "@/lib/list";
import {
  describeCount,
  customerStatus,
  customerSummary,
  expiryLabel,
  expiryTone,
  isServiceType,
  jobRef,
  type LoadRow,
  SERVICE_TYPES,
  settlement,
  storedDaysLeft,
} from "@/lib/loads";
import { matchesMyTransaction, MY_GROUP_LABELS, MY_GROUPS, myGroup } from "@/lib/my-transactions";
import { cn } from "@/lib/utils";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

// A customer's home screen: their requests and jobs, newest first. A search
// box, a service choice and tabs (the same groups as the tiles) narrow the
// list; all of it lives in the address (?q=&service=&show=).
export default async function MyJobsPage({ searchParams }: PageProps<"/my">) {
  const { supabase, profile } = await requireRole((r) => !isStaff(r));
  const { q: rawQ, service: rawService, show: rawShow } = await searchParams;
  const q = parseSearch(rawQ);
  const service = typeof rawService === "string" && isServiceType(rawService) ? rawService : "";
  const show = parseChoice(rawShow, MY_GROUPS);
  const { coop_name, lifeline, warning_days } = await getSettings();

  // RLS only ever returns this customer's own rows.
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, request_status, reject_reason, output_kg, disposition, keep_percent, buyout_status, price_per_kg, payout_done_at",
    )
    .order("created_at", { ascending: false });
  const loads = (data ?? []) as LoadRow[];
  const sum = customerSummary(loads, new Date(), lifeline);

  // One customer's own list is small: search and filters are worked out here.
  const searched = loads.filter((l) => matchesMyTransaction(l, q) && (!service || l.service_type === service));
  const shown = show === "all" ? searched : searched.filter((l) => myGroup(l) === show);
  const count = (g: string) => searched.filter((l) => myGroup(l) === g).length;
  const href = (changes: Record<string, string>) =>
    listHref("/my", { q, service, show, ...changes }, { show: "all" });
  const filtering = Boolean(q || service || show !== "all");

  // My dashboard: what is happening with my palay, and my money.
  const tiles: { label: string; value: string; note: string; icon: LucideIcon; tone: string; highlight?: boolean }[] = [
    {
      label: "Waiting for the co-op",
      value: String(sum.waiting),
      note: sum.waiting === 1 ? "request" : "requests",
      icon: Hourglass,
      tone: "bg-gold-soft text-gold-dark",
    },
    {
      label: "Being processed",
      value: String(sum.inProgress),
      note: sum.inProgress === 1 ? "transaction" : "transactions",
      icon: Scale,
      tone: "bg-brand-soft text-brand",
    },
    {
      label: "Ready: your choice",
      value: String(sum.toChoose),
      note: sum.toChoose > 0 ? "Choose keep, sell or split" : "Nothing to choose",
      icon: HandCoins,
      tone: "bg-brand-soft text-brand",
      highlight: sum.toChoose > 0,
    },
    {
      label: "Stored at the mill",
      value: String(sum.stored),
      note:
        sum.soonestExpiryDays === null
          ? "Nothing stored"
          : `Soonest: ${expiryLabel(sum.soonestExpiryDays).toLowerCase()}`,
      icon: sum.soonestExpiryDays !== null && expiryTone(sum.soonestExpiryDays, warning_days) !== "green" ? CalendarClock : Warehouse,
      tone:
        sum.soonestExpiryDays !== null && expiryTone(sum.soonestExpiryDays, warning_days) === "red"
          ? "bg-danger-soft text-danger"
          : "bg-info-soft text-info-dark",
      highlight: sum.soonestExpiryDays !== null && expiryTone(sum.soonestExpiryDays, warning_days) !== "green",
    },
  ];

  return (
    <div>
      <PageTitle
        eyebrow={coop_name}
        title={`Hello, ${profile.full_name.split(" ")[0] || "there"}`}
        description="Your requests and transactions at the mill."
        action={
          <Link href="/my/request" className={buttonVariants({ size: "lg" })}>
            <Plus className="size-5" aria-hidden />
            Request a service
          </Link>
        }
      />

      <ErrorNote code={error ? "load_failed" : null} />

      {loads.length > 0 && (
        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((t) => (
              <div
                key={t.label}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-card",
                  t.highlight ? "border-2 border-gold" : "border-line",
                )}
              >
                <div className={cn("mb-3 grid size-9 place-items-center rounded-xl", t.tone)}>
                  <t.icon className="size-5" aria-hidden />
                </div>
                <div className="text-2xl font-extrabold tracking-tight text-ink">{t.value}</div>
                <div className="text-xs font-bold text-ink">{t.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t.note}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-brand p-5 text-on-brand shadow-logo">
            <div className="text-xs font-bold uppercase tracking-wider text-on-brand/80">My money</div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-sm text-on-brand/85">You owe</span>
              <span className="text-2xl font-extrabold">{peso.format(sum.owes)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-sm text-on-brand/85">The co-op will pay you</span>
              <span className="text-2xl font-extrabold">{peso.format(sum.toReceive)}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-on-brand/80">
              Fees count once the co-op accepts your request. Sales count once the chairperson
              approves them.
            </p>
          </div>
        </div>
      )}

      {loads.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
          <h2 className="font-extrabold text-ink">My transactions</h2>
          <SearchBox
            action="/my"
            q={q}
            placeholder="RPS- number, service or status"
            label="Search my transactions by reference number, service or status"
            keep={show !== "all" ? { show } : {}}
          >
            <FilterSelect
              name="service"
              label="Service"
              value={service}
              options={[{ value: "", label: "All services" }, ...SERVICE_TYPES.map((s) => ({ value: s, label: s }))]}
            />
          </SearchBox>
          <FilterTabs
            label="Show"
            tabs={MY_GROUPS
              // Empty tabs are left out to keep the row short on a phone.
              .filter((g) => g === "all" || g === show || count(g) > 0)
              .map((g) => ({
                label: MY_GROUP_LABELS[g],
                href: href({ show: g }),
                active: show === g,
                count: g === "all" ? searched.length : count(g),
              }))}
          />
          {filtering && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Showing {shown.length} of {loads.length}.{" "}
              <Link href="/my" className="font-bold text-brand underline">
                Show all
              </Link>
            </p>
          )}
        </div>
      )}

      {loads.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requests yet"
          action={
            <Link href="/my/request" className={buttonVariants({ size: "lg" })}>
              <Plus className="size-5" aria-hidden />
              Request a service
            </Link>
          }
        >
          Ask the co-op to dry or mill your palay. You can follow every step from here.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          action={
            <Link href="/my" className={buttonVariants({ variant: "outline" })}>
              Clear search
            </Link>
          }
        >
          Try another number, service or tab.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((load) => {
            const status = customerStatus(load);
            const left = storedDaysLeft(load, new Date(), lifeline);
            const money = settlement(load);
            const accepted = load.request_status === "accepted";
            return (
              <li key={load.id}>
                <Link
                  href={`/my/${load.id}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-card transition hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-brand">#{jobRef(load.id)}</div>
                      <div className="mt-1 font-extrabold text-ink">{load.service_type}</div>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {left !== null && <ExpiryBadge daysLeft={left} warningDays={warning_days} />}
                  </div>
                  {load.request_status === "rejected" && load.reject_reason && (
                    <p className="text-sm text-danger">{load.reject_reason}</p>
                  )}
                  {accepted && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 text-xs">
                      <div>
                        <div className="font-bold uppercase text-muted-foreground">Output</div>
                        <div className="mt-0.5 font-extrabold text-ink">
                          {load.output_kg != null ? `${kg.format(load.output_kg)} kg` : "Not weighed yet"}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold uppercase text-muted-foreground">
                          {money.payout > 0 ? (load.payout_done_at ? "Paid to you" : "You get") : "You owe"}
                        </div>
                        <div className="mt-0.5 font-extrabold text-ink">
                          {money.payout > 0
                            ? peso.format(money.payout)
                            : load.agreed_price > 0
                              ? peso.format(money.stillOwes)
                              : "Fee not set yet"}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-auto text-xs text-muted-foreground">
                    {describeCount(load)} ·{" "}
                    {formatDate(load.created_at)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
