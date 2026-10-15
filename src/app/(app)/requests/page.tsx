import { BadgeCheck, CalendarDays, Inbox, Phone } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";
import { Badge } from "@/components/rps/badge";
import { HarvestAddress } from "@/components/rps/harvest-address";
import { PageTitle } from "@/components/rps/page-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorNote } from "@/components/rps/error-note";
import { jobRef, needsHarvestAddress, isServiceType } from "@/lib/loads";
import { feeAtIntake } from "@/lib/pricing";
import { canManage } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { acceptRequest, rejectRequest } from "../loads/actions";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

type Request = {
  id: string;
  created_at: string;
  customer_name: string;
  sacks: number;
  kilos: number;
  service_type: string;
  preferred_date: string | null;
  customer_note: string | null;
  harvest_address: string | null;
  customer: { full_name: string; phone: string; is_member: boolean } | null;
};

// Incoming requests: members first, then oldest first.
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const { supabase, role } = await requireRole((r) => canManage(r) || r === "auditor");
  const { error } = await searchParams;
  const manager = canManage(role);

  const { data, error: loadError } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, preferred_date, customer_note, harvest_address, customer:profiles!loads_customer_id_fkey(full_name, phone, is_member)",
    )
    .eq("request_status", "pending")
    .order("created_at", { ascending: true });

  const requests = ((data ?? []) as unknown as Request[]).sort(
    (a, b) => Number(b.customer?.is_member ?? false) - Number(a.customer?.is_member ?? false),
  );

  return (
    <div>
      <PageTitle
        eyebrow="Incoming"
        title="Requests"
        description={
          requests.length > 0
            ? `${requests.length} waiting. Members are listed first.`
            : "Service requests from customers appear here."
        }
      />

      <ErrorNote code={loadError ? "load_failed" : error} />

      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title="No requests waiting">
          You&rsquo;re all caught up. New requests from customers appear here.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-brand">#{jobRef(r.id)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="truncate font-extrabold text-ink">
                      {r.customer?.full_name || r.customer_name}
                    </span>
                    {r.customer?.is_member && (
                      <Badge tone="green">
                        <BadgeCheck className="mr-1 size-3.5" aria-hidden />
                        Member
                      </Badge>
                    )}
                  </div>
                  {r.customer?.phone && (
                    <a href={`tel:${r.customer.phone}`} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="size-3.5" aria-hidden />
                      {r.customer.phone}
                    </a>
                  )}
                </div>
                <Badge tone="amber">Pending</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">Service</div>
                  <div className="mt-1 text-xs font-extrabold text-ink">{r.service_type}</div>
                </div>
                <div className="border-x border-line">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Sacks</div>
                  <div className="mt-1 text-xs font-extrabold text-ink">{r.sacks || r.kilos ? r.sacks : "After harvest"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">Est. weight</div>
                  <div className="mt-1 text-xs font-extrabold text-ink">{r.sacks || r.kilos ? `${kg.format(r.kilos)} kg` : "After harvest"}</div>
                </div>
              </div>

              <HarvestAddress address={r.harvest_address} />

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Asked {formatDate(r.created_at)}
                  {r.preferred_date && ` · prefers ${formatDate(r.preferred_date)}`}
                </div>
                {r.customer_note && <p className="text-sm text-ink">&ldquo;{r.customer_note}&rdquo;</p>}
              </div>

              {manager && (
                <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                  <form action={acceptRequest} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="text-xs font-bold text-ink" htmlFor={`fee-${r.id}`}>
                      Processing fee (₱)
                    </label>
                    <input
                      id={`fee-${r.id}`}
                      name="agreed_price"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      defaultValue={feeAtIntake(r.service_type, r.sacks)}
                      required
                      className="min-h-12 rounded-xl border border-field bg-card px-3 text-base text-ink focus-visible:border-brand md:text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isServiceType(r.service_type) && needsHarvestAddress(r.service_type)
                        ? "Worked out from the price list after the harvest count."
                        : "From the price list. Change it for a discount."}
                    </p>
                    <SubmitButton>Accept</SubmitButton>
                  </form>
                  <form action={rejectRequest} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="text-xs font-bold text-ink" htmlFor={`reason-${r.id}`}>
                      Reason (shown to the customer)
                    </label>
                    <input
                      id={`reason-${r.id}`}
                      name="reject_reason"
                      type="text"
                      maxLength={300}
                      required
                      placeholder="e.g. dryer fully booked this week"
                      className="min-h-12 rounded-xl border border-field bg-card px-3 text-base text-ink focus-visible:border-brand md:text-sm"
                    />
                    <SubmitButton variant="outline" className="text-danger hover:text-danger">
                      Reject
                    </SubmitButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
