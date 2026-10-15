import Link from "next/link";
import { History, Search } from "lucide-react";
import { AuditList } from "@/components/rps/audit-list";
import { EmptyState } from "@/components/rps/empty-state";
import { FilterSelect, FilterTabs, Pagination } from "@/components/rps/list-controls";
import { Notice } from "@/components/rps/notice";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AuditEntry } from "@/lib/audit";
import { listHref, pageInfo, pageRange, parseChoice, parsePage } from "@/lib/list";
import { groupByDay } from "@/lib/loads";
import { canSeeHistory } from "@/lib/roles";
import { requireRole } from "@/lib/session";

const PER_PAGE = 20;

const WHAT = ["all", "jobs", "payments", "people", "settings"] as const;
const WHAT_LABELS: Record<(typeof WHAT)[number], string> = {
  all: "Everything",
  jobs: "Jobs",
  payments: "Payments",
  people: "People",
  settings: "Co-op settings",
};
const WHAT_TABLES: Record<Exclude<(typeof WHAT)[number], "all">, string[]> = {
  jobs: ["loads"],
  payments: ["payments"],
  people: ["profiles"],
  settings: ["cooperatives", "settings"],
};

const ACTIONS = ["all", "insert", "update", "delete"] as const;
const ACTION_FILTER_LABELS: Record<(typeof ACTIONS)[number], string> = {
  all: "Any change",
  insert: "Created",
  update: "Changed",
  delete: "Deleted",
};

const PERIODS = ["all", "today", "7d", "30d"] as const;
const PERIOD_LABELS: Record<(typeof PERIODS)[number], string> = {
  all: "All time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

/** The start of the chosen period, as an ISO time (Manila days). */
function since(period: (typeof PERIODS)[number], now = new Date()): string | null {
  if (period === "all") return null;
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const midnight = new Date(`${today}T00:00:00+08:00`);
  const days = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return new Date(midnight.getTime() - days * 86_400_000).toISOString();
}

// Chairperson and Auditor: every change to jobs, payments, people and
// settings, newest first, with simple filters and pages. The database
// writes this log itself (supabase/sql/011); nobody can edit it, and RLS
// only shows the person's own co-op.
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { supabase } = await requireRole(canSeeHistory);
  const raw = await searchParams;
  const what = parseChoice(raw.what, WHAT);
  const action = parseChoice(raw.action, ACTIONS);
  const period = parseChoice(raw.period, PERIODS);
  const requested = parsePage(raw.page);
  const from = since(period);

  const buildQuery = (page: number) => {
    let query = supabase.from("audit_log").select("*", { count: "exact" });
    if (what !== "all") query = query.in("table_name", WHAT_TABLES[what]);
    if (action !== "all") query = query.eq("action", action);
    if (from) query = query.gte("changed_at", from);
    const [a, b] = pageRange(page, PER_PAGE);
    return query.order("changed_at", { ascending: false }).range(a, b);
  };

  let { data, error, count } = await buildQuery(requested);
  const info = pageInfo(requested, PER_PAGE, count ?? 0);
  if (info.page !== requested && (count ?? 0) > 0) ({ data, error, count } = await buildQuery(info.page));
  const entries = (data ?? []) as AuditEntry[];
  const total = count ?? 0;

  // Names for "who changed it" and for people whose details changed.
  const ids = [...new Set(entries.flatMap((e) => [e.changed_by, e.table_name === "profiles" ? e.row_id : null]))]
    .filter((id): id is string => !!id);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string) || "Unnamed"]));

  const defaults = { what: "all", action: "all", period: "all" };
  const href = (changes: Record<string, string | number>) =>
    listHref("/history", { what, action, period, page: info.page, ...changes }, defaults);
  const filtering = what !== "all" || action !== "all" || period !== "all";
  const days = groupByDay(entries.map((e) => ({ ...e, created_at: e.changed_at })));

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        eyebrow="Records"
        title="History"
        description="Who changed what, and when. Nobody can edit this list."
      />

      <section className="rounded-2xl border border-line bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
          <FilterTabs
            label="What changed"
            tabs={WHAT.map((w) => ({ label: WHAT_LABELS[w], href: href({ what: w, page: 1 }), active: what === w }))}
          />
          <form action="/history" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {what !== "all" && <input type="hidden" name="what" value={what} />}
            <FilterSelect
              name="action"
              label="Action"
              value={action}
              options={ACTIONS.map((a) => ({ value: a, label: ACTION_FILTER_LABELS[a] }))}
            />
            <FilterSelect
              name="period"
              label="When"
              value={period}
              options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
            />
            <SubmitButton variant="secondary">Apply</SubmitButton>
            {filtering && (
              <Link href="/history" className="flex min-h-11 items-center px-1 text-sm font-bold text-brand sm:ml-auto">
                Clear filters
              </Link>
            )}
          </form>
        </div>

        <div className="p-4 sm:p-5">
          {error ? (
            <Notice tone="error" className="mb-0">Could not load the history. Please refresh.</Notice>
          ) : entries.length === 0 ? (
            filtering ? (
              <EmptyState
                icon={Search}
                title="No changes match"
                action={
                  <Link href="/history" className={buttonVariants({ variant: "outline" })}>
                    Clear filters
                  </Link>
                }
              >
                Try another kind of change or a longer period.
              </EmptyState>
            ) : (
              <EmptyState icon={History} title="No changes yet">
                Changes are recorded from the day the history was switched on.
              </EmptyState>
            )
          ) : (
            <div className="flex flex-col gap-5">
              {days.map((day) => (
                <section key={day.key} aria-label={day.label}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {day.label}
                    <span className="h-px flex-1 bg-line" aria-hidden />
                  </h2>
                  <AuditList entries={day.items} names={names} timeOnly />
                </section>
              ))}
            </div>
          )}
        </div>

        {total > 0 && (
          <Pagination {...info} total={total} noun={["change", "changes"]} hrefFor={(page) => href({ page })} />
        )}
      </section>
    </div>
  );
}
