import Link from "next/link";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { Badge, ExpiryBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNote } from "@/components/rps/error-note";
import { customerStatus, jobRef, type LoadRow, settlement, storedDaysLeft } from "@/lib/loads";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

// A customer's home screen: their requests and jobs, newest first.
export default async function MyJobsPage() {
  const { supabase, profile } = await requireRole((r) => !isStaff(r));
  const { coop_name, lifeline, warning_days } = await getSettings();

  // RLS only ever returns this customer's own rows.
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, request_status, reject_reason, output_kg, disposition, keep_percent, buyout_status, price_per_kg, payout_done_at",
    )
    .order("created_at", { ascending: false });
  const loads = (data ?? []) as LoadRow[];

  return (
    <div>
      <PageTitle
        eyebrow={coop_name}
        title={`Hello, ${profile.full_name.split(" ")[0] || "there"}`}
        description="Your requests and jobs at the mill."
        action={
          <Link href="/my/request" className={buttonVariants({ size: "lg" })}>
            <Plus className="size-5" aria-hidden />
            Request a service
          </Link>
        }
      />

      <ErrorNote code={error ? "load_failed" : null} />

      {loads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white px-6 py-14 text-center shadow-card">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ClipboardList className="size-7" aria-hidden />
          </span>
          <p className="font-extrabold text-ink">No requests yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ask the co-op to dry or mill your palay. You can follow every step from here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {loads.map((load) => {
            const status = customerStatus(load);
            const left = storedDaysLeft(load, new Date(), lifeline);
            const money = settlement(load);
            const accepted = load.request_status === "accepted";
            return (
              <li key={load.id}>
                <Link
                  href={`/my/${load.id}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-card transition hover:border-brand/40"
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
                    {load.sacks} sacks · {kg.format(load.kilos)} kg ·{" "}
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
