import Link from "next/link";
import { EmptyState } from "@/components/rps/empty-state";
import { ChevronRight, ClipboardList, Plus, Search } from "lucide-react";
import { ExpiryBadge, PaidBadge, StageBadge } from "@/components/rps/badge";
import { FilterSelect, FilterTabs, Pagination, SearchBox } from "@/components/rps/list-controls";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNote } from "@/components/rps/error-note";
import { describeCount, jobRef, type LoadRow, SERVICE_TYPES, storedDaysLeft } from "@/lib/loads";
import { escapeLike, listHref, pageInfo, pageRange, parseChoice, parsePage, parseSearch } from "@/lib/list";
import { canManage, isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const PER_PAGE = 15;

// Status filter: the steps grouped the way staff talk about them.
const STATUSES = ["all", "active", "ready", "stored", "done"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABELS: Record<Status, string> = {
  all: "All",
  active: "In progress",
  ready: "Ready",
  stored: "Stored",
  done: "Completed",
};
const STATUS_STAGES: Record<Exclude<Status, "all">, string[]> = {
  active: ["Received", "Harvesting", "Drying", "Milling"],
  ready: ["Ready"],
  stored: ["Stored"],
  done: ["Released"],
};
const SERVICES = ["all", ...SERVICE_TYPES] as const;

// The Jobs list: newest first, with search (customer name), a service and a
// status filter, and pages. The database does the filtering and counting,
// so only one page of jobs is ever loaded.
export default async function JobsPage({ searchParams }: PageProps<"/loads">) {
  const { supabase, role } = await requireRole(isStaff);
  const raw = await searchParams;
  const q = parseSearch(raw.q);
  const service = parseChoice(raw.service, SERVICES);
  const status = parseChoice(raw.status, STATUSES);
  const requested = parsePage(raw.page);

  // No "where coop = ..." needed: Row Level Security only ever hands back
  // the signed-in person's own co-op's jobs.
  const buildQuery = (page: number) => {
    let query = supabase
      .from("loads")
      .select(
        "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, customer_id, disposition, buyout_status",
        { count: "exact" },
      )
      .eq("request_status", "accepted");
    if (q) query = query.ilike("customer_name", `%${escapeLike(q)}%`);
    if (service !== "all") query = query.eq("service_type", service);
    if (status !== "all") query = query.in("stage", STATUS_STAGES[status]);
    const [from, to] = pageRange(page, PER_PAGE);
    return query.order("created_at", { ascending: false }).range(from, to);
  };

  let { data, error, count } = await buildQuery(requested);
  // Asked for a page past the end: the database answers "out of range"
  // without a count, so count from page 1 first (Ticket 42).
  if (error?.code === "PGRST103") ({ data, error, count } = await buildQuery(1));
  const info = pageInfo(requested, PER_PAGE, count ?? 0);
  // Asked for a page past the end (e.g. after a filter): show the last one.
  if (info.page !== requested && (count ?? 0) > 0) ({ data, error, count } = await buildQuery(info.page));

  const loads = (data ?? []) as LoadRow[];
  const total = count ?? 0;
  const { lifeline, warning_days } = await getSettings();

  const defaults = { service: "all", status: "all" };
  const href = (changes: Record<string, string | number>) =>
    listHref("/loads", { q, service, status, page: info.page, ...changes }, defaults);
  const filtering = q !== "" || service !== "all" || status !== "all";

  return (
    <div>
      <PageTitle
        eyebrow="Transaction tracking"
        title="Process"
        description="Every accepted transaction, newest first."
        action={
          canManage(role) && (
            <Link href="/loads/new" className={buttonVariants({ size: "lg" })}>
              <Plus className="size-5" aria-hidden />
              New walk-in transaction
            </Link>
          )
        }
      />

      <ErrorNote code={error ? "load_failed" : null} />

      <section className="rounded-2xl border border-line bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
          <SearchBox
            action="/loads"
            q={q}
            placeholder="Search by customer name"
            label="Search transactions by customer name"
            keep={status !== "all" ? { status } : {}}
          >
            <FilterSelect
              name="service"
              label="Service"
              value={service}
              options={SERVICES.map((s) => ({ value: s, label: s === "all" ? "All services" : s }))}
            />
          </SearchBox>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterTabs
              label="Status"
              tabs={STATUSES.map((s) => ({ label: STATUS_LABELS[s], href: href({ status: s, page: 1 }), active: status === s }))}
            />
            {filtering && (
              <Link href="/loads" className="text-sm font-bold text-brand">
                Clear filters
              </Link>
            )}
          </div>
        </div>

        {loads.length === 0 ? (
          <div className="p-4 sm:p-5">
            {filtering ? (
              <EmptyState
                icon={Search}
                title="No transactions match"
                action={
                  <Link href="/loads" className={buttonVariants({ variant: "outline" })}>
                    Clear filters
                  </Link>
                }
              >
                Try another name, service or status.
              </EmptyState>
            ) : (
              <EmptyState icon={ClipboardList} title="No transactions yet">
                Accepted requests and walk-in transactions show up here.
              </EmptyState>
            )}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[0.9fr_1.5fr_1.1fr_0.8fr_1.6fr_auto] gap-3 border-b border-line bg-surface px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Transaction ID</span>
              <span>Customer</span>
              <span>Service</span>
              <span>Weight</span>
              <span>Status</span>
              <span className="w-4" />
            </div>
            <ul className="p-2 md:p-3">
              {loads.map((load) => {
                const left = storedDaysLeft(load, new Date(), lifeline);
                return (
                  <li key={load.id} className="border-b border-line/70 last:border-0">
                    <Link
                      href={`/loads/${load.id}`}
                      className="grid items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3 transition-colors hover:bg-surface md:grid-cols-[0.9fr_1.5fr_1.1fr_0.8fr_1.6fr_auto]"
                    >
                      <div className="flex items-center justify-between md:block">
                        <span className="text-xs font-bold text-brand">#{jobRef(load.id)}</span>
                        <span className="text-xs text-muted-foreground md:hidden">{describeCount(load)}</span>
                      </div>
                      <span className="truncate text-sm font-bold text-ink">{load.customer_name}</span>
                      <span className="text-xs text-muted-foreground">{load.service_type}</span>
                      <span className="hidden text-xs font-bold text-ink md:block">{kg.format(load.kilos)} kg</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StageBadge stage={load.stage} />
                        <PaidBadge isPaid={load.is_paid} amount={load.amount_paid} fee={load.agreed_price} />
                        {left !== null && <ExpiryBadge daysLeft={left} warningDays={warning_days} />}
                      </span>
                      <ChevronRight className="hidden size-4 text-muted-foreground md:block" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {total > 0 && (
          <Pagination
            {...info}
            total={total}
            noun={["transaction", "transactions"]}
            hrefFor={(page) => href({ page })}
          />
        )}
      </section>
    </div>
  );
}
