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
import { StatCard } from "@/components/rps/stat-card";
import { ErrorNote } from "@/components/rps/error-note";
import { jobRef, type LoadRow, moneySummary, settlement } from "@/lib/loads";
import { canSeeMoney } from "@/lib/roles";
import { requireRole } from "@/lib/session";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

// For the Auditor (read-only), Chairperson and Monitor: where the money is.
export default async function MoneyPage() {
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
