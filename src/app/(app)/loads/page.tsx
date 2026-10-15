import Link from "next/link";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { ExpiryBadge, PaidBadge, StageBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNote } from "@/components/rps/error-note";
import { jobRef, type LoadRow, storedDaysLeft } from "@/lib/loads";
import { canManage, isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

// The Jobs list: every load, newest first.
export default async function JobsPage() {
  const { supabase, role } = await requireRole(isStaff);

  // No "where owner_id = ..." needed: Row Level Security only ever hands
  // back the signed-in Monitor's own loads.
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, customer_id, disposition, buyout_status",
    )
    .eq("request_status", "accepted")
    .order("created_at", { ascending: false });
  const loads = (data ?? []) as LoadRow[];
  const { lifeline, warning_days } = await getSettings();

  return (
    <div>
      <PageTitle
        eyebrow="Job tracking"
        title="Jobs"
        description={
          loads.length > 0
            ? `${loads.length} ${loads.length === 1 ? "load" : "loads"}, newest first.`
            : "Every load the mill is working on."
        }
        action={
          canManage(role) && (
            <Link href="/loads/new" className={buttonVariants({ size: "lg" })}>
              <Plus className="size-5" aria-hidden />
              New walk-in job
            </Link>
          )
        }
      />

      <ErrorNote code={error ? "load_failed" : null} />

      {loads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white px-6 py-14 text-center shadow-card">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ClipboardList className="size-7" aria-hidden />
          </span>
          <p className="font-extrabold text-ink">No loads yet</p>
          <p className="text-sm text-muted-foreground">
            Tap &ldquo;New load&rdquo; when a customer&rsquo;s job starts.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-line bg-white p-2 shadow-card md:p-3">
          <div className="hidden grid-cols-[0.9fr_1.5fr_1.1fr_0.8fr_1.6fr_auto] gap-3 border-b border-line px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Job ID</span>
            <span>Customer</span>
            <span>Service</span>
            <span>Weight</span>
            <span>Status</span>
            <span className="w-4" />
          </div>
          <ul>
            {loads.map((load) => {
              const left = storedDaysLeft(load, new Date(), lifeline);
              return (
                <li key={load.id} className="border-b border-line/70 last:border-0">
                  <Link
                    href={`/loads/${load.id}`}
                    className="grid items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3 hover:bg-surface md:grid-cols-[0.9fr_1.5fr_1.1fr_0.8fr_1.6fr_auto]"
                  >
                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs font-bold text-brand">#{jobRef(load.id)}</span>
                      <span className="text-xs text-muted-foreground md:hidden">
                        {load.sacks} sacks · {kg.format(load.kilos)} kg
                      </span>
                    </div>
                    <span className="truncate text-sm font-bold text-ink">{load.customer_name}</span>
                    <span className="text-xs text-muted-foreground">{load.service_type}</span>
                    <span className="hidden text-xs font-bold text-ink md:block">
                      {kg.format(load.kilos)} kg
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StageBadge stage={load.stage} />
                      <PaidBadge isPaid={load.is_paid} amount={load.amount_paid} />
                      {left !== null && <ExpiryBadge daysLeft={left} warningDays={warning_days} />}
                    </span>
                    <ChevronRight
                      className="hidden size-4 text-muted-foreground md:block"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
