import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  CircleCheck,
  HandCoins,
  Package,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Badge, PaidBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { FeesByMonthChart, JobsByServiceChart } from "@/components/rps/money-charts";
import { StatCard } from "@/components/rps/stat-card";
import { ErrorNote } from "@/components/rps/error-note";
import { jobRef, type LoadRow, moneyStats, moneySummary, parseStatsRange, settlement, type StatsRange } from "@/lib/loads";
import { canSeeMoney } from "@/lib/roles";
import { requireRole } from "@/lib/session";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

// For the Auditor (read-only), Chairperson and Monitor: where the money is.
export default async function MoneyPage({ searchParams }: PageProps<"/money">) {
  const { supabase, role } = await requireRole(canSeeMoney);

  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, customer_id, request_status, output_kg, disposition, keep_percent, buyout_status, price_per_kg, payout_done_at",
    )
    .eq("request_status", "accepted")
    .order("created_at", { ascending: false });
  const loads = (data ?? []) as LoadRow[];
  const m = moneySummary(loads);

  // Statistics for the chosen period (6 months by default).
  const { range: rawRange } = await searchParams;
  const range = parseStatsRange(rawRange);
  const stats = moneyStats(loads, range);
  const t = stats.totals;
  const RANGES: { value: StatsRange; label: string }[] = [
    { value: "6m", label: "6 months" },
    { value: "12m", label: "12 months" },
    { value: "all", label: "All" },
  ];

  const cards = [
    { label: "Cash received (fees)", value: peso.format(m.cashReceived), icon: Banknote, tone: "green" as const },
    { label: "Fees taken from buyouts", value: peso.format(m.feesCoveredByBuyouts), icon: HandCoins, tone: "green" as const },
    {
      label: "Customers still owe",
      value: peso.format(m.owedByCustomers),
      icon: ReceiptText,
      tone: "amber" as const,
      attention: m.owedByCustomers > 0,
    },
    { label: "Payouts made", value: peso.format(m.payoutsMade), icon: CircleCheck, tone: "blue" as const },
    {
      label: "Payouts still to make",
      value: peso.format(m.payoutsToMake),
      icon: Wallet,
      tone: "red" as const,
      attention: m.payoutsToMake > 0,
    },
    {
      label: "Co-op stock (bought)",
      value: kg.format(m.stockRiceKg),
      unit: "kg rice",
      note: `${kg.format(m.stockPalayKg)} kg palay`,
      icon: Package,
      tone: "amber" as const,
    },
  ];

  // Jobs where money is still open, most urgent first.
  const open = loads
    .map((load) => ({ load, s: settlement(load) }))
    .filter(({ load, s }) => s.stillOwes > 0 || (load.buyout_status === "approved" && !load.payout_done_at && s.payout > 0) || load.buyout_status === "requested");

  return (
    <div>
      <PageTitle
        eyebrow={role === "auditor" ? "Auditor · read-only" : "Records"}
        title="Money"
        description="Fees, buyouts, payouts and the co-op's own stock, from every accepted job."
        action={m.buyoutsWaiting > 0 ? <Badge tone="amber">{m.buyoutsWaiting} buyout(s) waiting</Badge> : undefined}
      />

      <ErrorNote code={error ? "load_failed" : null} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <section aria-labelledby="stats" className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="stats" className="text-lg font-extrabold text-ink">
              Statistics
            </h2>
            <p className="text-sm text-muted-foreground">
              Jobs grouped by the month they were logged (payment dates aren&rsquo;t recorded).
            </p>
          </div>
          {/* One filter row, above everything it changes. */}
          <nav aria-label="Period" className="flex gap-1 rounded-xl border border-line bg-card p-1">
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={r.value === "6m" ? "/money" : `/money?range=${r.value}`}
                aria-current={range === r.value ? "page" : undefined}
                className={
                  range === r.value
                    ? "flex min-h-11 items-center rounded-lg bg-brand px-3 text-sm font-bold text-on-brand"
                    : "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:text-ink"
                }
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Fees for these jobs" value={peso.format(t.fees)} note={`${t.jobs} ${t.jobs === 1 ? "job" : "jobs"}`} icon={ReceiptText} />
          {/* Collected share as a meter: same-colour track, filled part = collected. */}
          <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <div className="text-sm font-semibold text-muted-foreground">Collected so far</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
              {Math.round(t.collectedShare * 100)}%
            </div>
            <div
              role="meter"
              aria-label="Share of fees collected"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(t.collectedShare * 100)}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-soft"
            >
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${t.collectedShare * 100}%` }} />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-muted-foreground">
              {peso.format(t.collected)} of {peso.format(t.fees)}
            </div>
          </div>
          <StatCard label="Average fee per job" value={peso.format(t.averageFee)} icon={Banknote} tone="blue" />
          <StatCard label="Grain bought by the co-op" value={kg.format(t.boughtKg)} unit="kg" icon={Package} tone="amber" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="fees-by-month" className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
            <h3 id="fees-by-month" className="text-base font-extrabold text-ink">
              Fees per month
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">Collected and still owed. Tap a month for details.</p>
            <FeesByMonthChart months={stats.months} />
            <details className="mt-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-brand">
                Show as table
              </summary>
              <div className="overflow-x-auto">
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-bold">Month</th>
                      <th scope="col" className="py-2 pr-3 text-right font-bold">Jobs</th>
                      <th scope="col" className="py-2 pr-3 text-right font-bold">Collected</th>
                      <th scope="col" className="py-2 text-right font-bold">Still owed</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {stats.months.map((mo) => (
                      <tr key={mo.key} className="border-b border-line/60 last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
                          {mo.label} {mo.year}
                        </th>
                        <td className="py-2 pr-3 text-right text-ink">{mo.jobs}</td>
                        <td className="py-2 pr-3 text-right text-ink">{peso.format(mo.collected)}</td>
                        <td className="py-2 text-right text-ink">{peso.format(mo.owed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section aria-labelledby="by-service" className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
            <h3 id="by-service" className="text-base font-extrabold text-ink">
              Jobs by service
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">Number of jobs, and their fees.</p>
            <JobsByServiceChart rows={stats.byService} />
          </section>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-card p-2 shadow-card md:p-3">
        <div className="px-3 pb-3 pt-2">
          <h2 className="font-extrabold text-ink">Open money</h2>
          <p className="text-xs text-muted-foreground">Balances due, payouts to make and buyouts to decide.</p>
        </div>
        {open.length === 0 ? (
          <p className="px-3 pb-6 text-sm text-muted-foreground">Nothing open. Every job is settled.</p>
        ) : (
          <ul>
            {open.map(({ load, s }) => (
              <li key={load.id} className="border-t border-line/70">
                <Link
                  href={`/loads/${load.id}`}
                  className="grid items-center gap-2 rounded-xl px-3 py-3 hover:bg-surface md:grid-cols-[0.8fr_1.4fr_1.6fr_auto]"
                >
                  <span className="text-xs font-bold text-brand">#{jobRef(load.id)}</span>
                  <span className="truncate text-sm font-bold text-ink">{load.customer_name}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <PaidBadge isPaid={load.is_paid} amount={load.amount_paid} />
                    {s.stillOwes > 0 && <Badge tone="amber">Owes {peso.format(s.stillOwes)}</Badge>}
                    {load.buyout_status === "requested" && <Badge tone="amber">Buyout to decide</Badge>}
                    {load.buyout_status === "approved" && !load.payout_done_at && s.payout > 0 && (
                      <Badge tone="red">Pay out {peso.format(s.payout)}</Badge>
                    )}
                  </span>
                  <ChevronRight className="hidden size-4 text-muted-foreground md:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
