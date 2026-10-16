import Link from "next/link";
import { BadgeCheck, CalendarDays, Inbox, Phone, Search } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";
import { Badge } from "@/components/rps/badge";
import { HarvestAddress } from "@/components/rps/harvest-address";
import { FilterSelect, FilterTabs, SearchBox } from "@/components/rps/list-controls";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorNote } from "@/components/rps/error-note";
import { listHref, parseChoice, parseSearch } from "@/lib/list";
import { jobRef, needsHarvestAddress, isServiceType, SERVICE_TYPES } from "@/lib/loads";
import { feeAtIntake } from "@/lib/pricing";
import { formatPhMobile } from "@/lib/phone";
import { matchesRequest, WHO } from "@/lib/requests";
import { canManage } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { acceptRequest, rejectRequest } from "../loads/actions";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

type Request = {
  id: string;
  created_at: string;
  customer_name: string;
  contact_phone: string | null;
  sacks: number;
  kilos: number;
  service_type: string;
  preferred_date: string | null;
  customer_note: string | null;
  harvest_address: string | null;
  customer: { full_name: string; phone: string; is_member: boolean } | null;
};

// Incoming requests: members first, then oldest first. Search, a service
// tab and members / non-members narrow the list; all of it lives in the
// address (?q=&service=&who=), so Back and shared links keep the view.
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const { supabase, role } = await requireRole((r) => canManage(r) || r === "auditor");
  const { error, q: rawQ, service: rawService, who: rawWho } = await searchParams;
  const q = parseSearch(rawQ);
  const service = typeof rawService === "string" && isServiceType(rawService) ? rawService : "";
  const who = parseChoice(rawWho, WHO);
  const { rates } = await getSettings();
  const manager = canManage(role);

  const { data, error: loadError } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, contact_phone, sacks, kilos, service_type, preferred_date, customer_note, harvest_address, customer:profiles!loads_customer_id_fkey(full_name, phone, is_member)",
    )
    .eq("request_status", "pending")
    .order("created_at", { ascending: true });

  const waiting = ((data ?? []) as unknown as Request[]).sort(
    (a, b) => Number(b.customer?.is_member ?? false) - Number(a.customer?.is_member ?? false),
  );

  // Only one co-op's waiting requests (RLS, and at most 3 per customer), so
  // the list is small: search and filters are worked out here.
  const searched = waiting.filter(
    (r) =>
      matchesRequest(r, q) &&
      (who === "all" || (who === "members") === Boolean(r.customer?.is_member)),
  );
  const requests = service ? searched.filter((r) => r.service_type === service) : searched;
  const count = (s: string) => searched.filter((r) => r.service_type === s).length;
  const href = (changes: Record<string, string>) =>
    listHref("/requests", { q, service, who, ...changes }, { who: "all" });
  const filtering = Boolean(q || service || who !== "all");

  return (
    <div>
      <PageTitle
        eyebrow="Incoming"
        title="Requests"
        description={
          waiting.length > 0
            ? `${waiting.length} waiting. Members are listed first.`
            : "Service requests from customers appear here."
        }
      />

      <ErrorNote code={loadError ? "load_failed" : error} />

      {waiting.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
          <SearchBox
            action="/requests"
            q={q}
            placeholder="Name, mobile, RPS- number, farm or note"
            label="Search requests by name, mobile number, reference, farm address or note"
            keep={service ? { service } : {}}
          >
            <FilterSelect
              name="who"
              label="Who"
              value={who}
              options={[
                { value: "all", label: "Everyone" },
                { value: "members", label: "Members" },
                { value: "others", label: "Non-members" },
              ]}
            />
          </SearchBox>
          <FilterTabs
            label="Service"
            tabs={[
              { label: "All services", href: href({ service: "" }), active: !service, count: searched.length },
              ...SERVICE_TYPES.map((s) => ({ label: s, href: href({ service: s }), active: service === s, count: count(s) })),
            ]}
          />
          {filtering && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Showing {requests.length} of {waiting.length}.{" "}
              <Link href="/requests" className="font-bold text-brand underline">
                Show all
              </Link>
            </p>
          )}
        </div>
      )}

      {waiting.length === 0 ? (
        <EmptyState icon={Inbox} title="No requests waiting">
          You&rsquo;re all caught up. New requests from customers appear here.
        </EmptyState>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No request matches"
          action={
            <Link href="/requests" className={buttonVariants({ variant: "outline" })}>
              Clear search
            </Link>
          }
        >
          Try another name, number or service.
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
                      {r.customer_name || r.customer?.full_name}
                    </span>
                    {r.customer?.is_member && (
                      <Badge tone="green">
                        <BadgeCheck className="mr-1 size-3.5" aria-hidden />
                        Member
                      </Badge>
                    )}
                  </div>
                  {r.customer?.full_name && r.customer.full_name !== r.customer_name && (
                    <div className="text-xs text-muted-foreground">Account: {r.customer.full_name}</div>
                  )}
                  {(r.contact_phone || r.customer?.phone) && (
                    <a
                      href={`tel:${r.contact_phone || r.customer?.phone}`}
                      className="mt-1 flex min-h-11 items-center gap-1 text-xs font-bold text-brand"
                    >
                      <Phone className="size-3.5" aria-hidden />
                      {formatPhMobile(r.contact_phone || r.customer?.phone)}
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
                      defaultValue={feeAtIntake(r.service_type, r.sacks, rates)}
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
