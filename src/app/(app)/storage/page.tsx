import Link from "next/link";
import { EmptyState } from "@/components/rps/empty-state";
import { AlertTriangle, ChevronRight, Leaf, Minus, Package, Plus, Warehouse } from "lucide-react";
import { Badge, ExpiryBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { ErrorNote } from "@/components/rps/error-note";
import { Notice } from "@/components/rps/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { isLow, type Product } from "@/lib/supply";
import { addSupply } from "./actions";
import { getSupply } from "./supply";
import {
  isServiceType,
  jobRef,
  type LoadRow,
  productFor,
  settlement,
  storedDaysLeft,
} from "@/lib/loads";
import { canWork, isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

export default async function StoragePage({ searchParams }: PageProps<"/storage">) {
  const { supabase, role } = await requireRole(isStaff);
  const { lifeline, warning_days, low_supply } = await getSettings();

  const { type, error: supplyError, supply: supplySaved } = await searchParams;
  // The co-op's own supply (Ticket 37): buyouts, palay harvest shares and
  // hand entries.
  const supply = await getSupply(supabase);
  const recent = supply.entries.slice(0, 8);
  const lowCount = (["rice", "palay"] as const).filter((p) => isLow(supply.levels[p].total, low_supply[p])).length;
  const filter = type === "palay" || type === "rice" ? type : null;

  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, output_kg, keep_percent, buyout_status, price_per_kg",
    )
    .eq("stage", "Stored")
    .eq("request_status", "accepted");

  const now = new Date();
  const lots = ((data ?? []) as LoadRow[])
    .filter((l) => isServiceType(l.service_type))
    .map((load) => ({
      load,
      product: productFor(load.service_type as Parameters<typeof productFor>[0]),
      left: storedDaysLeft(load, now, lifeline) ?? 0,
      // What the customer kept, by output weight (not the palay brought in).
      keptKg: settlement(load).keptKg,
      storedAt: new Date(load.stored_at ?? load.created_at),
    }))
    .sort((a, b) => a.left - b.left);

  const totals = (product: "palay" | "rice") => {
    const mine = lots.filter((l) => l.product === product);
    return {
      kilos: mine.reduce((sum, l) => sum + l.keptKg, 0),
      count: mine.length,
      urgent: mine.filter((l) => l.left <= warning_days).length,
    };
  };
  const palay = totals("palay");
  const rice = totals("rice");
  const shown = filter ? lots.filter((l) => l.product === filter) : lots;
  const expired = shown.filter((l) => l.left <= 0).length;
  const soon = shown.filter((l) => l.left > 0 && l.left <= warning_days).length;

  return (
    <div>
      <PageTitle
        eyebrow="Warehouse"
        title="Storage"
        description="Palay and rice kept at the mill for customers, and how long each lot has left."
      />

      <ErrorNote code={error || supply.error ? "load_failed" : null} />

      <section id="supply" aria-labelledby="supply-title" className="mb-8 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="supply-title" className="text-lg font-extrabold text-ink">Co-op supply</h2>
            <p className="text-xs text-muted-foreground">
              Rice and palay the co-op owns: bought in buyouts, kept as harvest shares, and added by hand.
            </p>
          </div>
          {lowCount > 0 && (
            <Badge tone="red">
              <AlertTriangle className="mr-1 size-3.5" aria-hidden />
              Low supply
            </Badge>
          )}
        </div>

        {supplySaved && <Notice tone="success">Supply updated.</Notice>}
        <ErrorNote code={typeof supplyError === "string" ? supplyError : null} />

        <div className="grid gap-3 sm:grid-cols-2">
          {(["rice", "palay"] as const).map((p: Product) => {
            const l = supply.levels[p];
            const low = isLow(l.total, low_supply[p]);
            return (
              <div
                key={p}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-card",
                  low ? "border-2 border-danger" : "border-line",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl",
                        p === "rice" ? "bg-gold-soft text-gold-dark" : "bg-brand-soft text-brand",
                      )}
                    >
                      {p === "rice" ? <Package className="size-5" aria-hidden /> : <Leaf className="size-5" aria-hidden />}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground">{p === "rice" ? "Milled rice" : "Palay"}</div>
                      <div className="text-2xl font-extrabold tabular-nums tracking-tight text-ink">
                        {kg.format(l.total)} <span className="text-xs font-bold text-muted-foreground">kg</span>
                      </div>
                    </div>
                  </div>
                  {low ? (
                    <Badge tone="red">
                      <AlertTriangle className="mr-1 size-3.5" aria-hidden />
                      Low
                    </Badge>
                  ) : (
                    <Badge tone="green">OK</Badge>
                  )}
                </div>
                {low && (
                  <p className="mt-2 text-sm font-semibold text-danger">
                    At or below the low-supply level of {kg.format(low_supply[p])} kg.
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface/70 p-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Buyouts</dt>
                    <dd className="font-bold tabular-nums text-ink">{kg.format(l.bought)} kg</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Harvest share</dt>
                    <dd className="font-bold tabular-nums text-ink">{kg.format(l.harvestShare)} kg</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">By hand</dt>
                    <dd className="font-bold tabular-nums text-ink">
                      {l.manual > 0 ? "+" : ""}
                      {kg.format(l.manual)} kg
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
          {canWork(role) && (
            <form action={addSupply} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
              <h3 className="font-extrabold text-ink">Add or take out supply</h3>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or take out">
                {[
                  ["in", "Add", Plus],
                  ["out", "Take out", Minus],
                ].map(([value, label, Icon]) => {
                  const I = Icon as typeof Plus;
                  return (
                    <label
                      key={value as string}
                      className="press flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-line text-sm font-bold text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                    >
                      <input type="radio" name="direction" value={value as string} defaultChecked={value === "in"} className="sr-only" />
                      <I className="size-4" aria-hidden />
                      {label as string}
                    </label>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="supply_product">What</Label>
                  <Select id="supply_product" name="product" defaultValue="rice">
                    <option value="rice">Milled rice</option>
                    <option value="palay">Palay</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="supply_kg">Amount (kg)</Label>
                  <Input id="supply_kg" name="kg" type="number" inputMode="decimal" min={0.01} step={0.01} required />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="supply_note">Note (optional)</Label>
                <Input id="supply_note" name="note" maxLength={200} placeholder="e.g. Sold to a buyer, bought from a farmer" />
              </div>
              <SubmitButton className="sm:self-start">Save</SubmitButton>
              <p className="text-xs text-muted-foreground">
                Entries can&rsquo;t be edited. To fix a mistake, add the opposite amount with a note.
              </p>
            </form>
          )}
          <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <h3 className="font-extrabold text-ink">Latest hand entries</h3>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing added or taken out by hand yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {recent.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">
                        {e.kg > 0 ? "Added" : "Took out"} {e.product === "rice" ? "rice" : "palay"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(new Date(e.created_at))}
                        {e.note ? ` · ${e.note}` : ""}
                      </span>
                    </span>
                    <span className={cn("shrink-0 font-extrabold tabular-nums", e.kg > 0 ? "text-brand" : "text-danger")}>
                      {e.kg > 0 ? "+" : "−"}
                      {kg.format(Math.abs(e.kg))} kg
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <h2 className="mb-1 text-lg font-extrabold text-ink">Customers&rsquo; grain in storage</h2>
      <p className="mb-3 text-xs text-muted-foreground">Kept at the mill for customers, and how long each lot has left.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          href={filter === "palay" ? "/storage" : "/storage?type=palay"}
          className={cn(
            "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
            filter === "palay" ? "border-brand bg-brand-soft" : "border-line bg-card",
          )}
        >
          <div className="grid size-11 place-items-center rounded-xl bg-brand text-on-brand">
            <Leaf className="size-5" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-ink">Dried palay</div>
            <div className="text-xs text-muted-foreground">
              Keeps {lifeline.palay} days · {kg.format(palay.kilos)} kg
            </div>
          </div>
          <Badge tone={palay.urgent > 0 ? "red" : "green"}>
            {palay.urgent > 0 ? `${palay.urgent} urgent` : `${palay.count} lots`}
          </Badge>
        </Link>
        <Link
          href={filter === "rice" ? "/storage" : "/storage?type=rice"}
          className={cn(
            "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
            filter === "rice" ? "border-gold bg-gold-soft" : "border-line bg-card",
          )}
        >
          <div className="grid size-11 place-items-center rounded-xl bg-gold text-on-gold">
            <Package className="size-5" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-ink">Milled rice</div>
            <div className="text-xs text-muted-foreground">
              Keeps {lifeline.rice} days · {kg.format(rice.kilos)} kg
            </div>
          </div>
          <Badge tone={rice.urgent > 0 ? "red" : "amber"}>
            {rice.urgent > 0 ? `${rice.urgent} urgent` : `${rice.count} lots`}
          </Badge>
        </Link>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-ink">
              {filter === "rice" ? "Rice lots" : filter === "palay" ? "Palay lots" : "All storage lots"}
            </h2>
            <p className="text-xs text-muted-foreground">Sorted by earliest expiry</p>
          </div>
          <div className="flex gap-2">
            {soon > 0 && <Badge tone="amber">Expiring soon {soon}</Badge>}
            {expired > 0 && <Badge tone="red">Expired {expired}</Badge>}
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={Warehouse} title="Nothing in storage">
            When a job is Ready and the customer keeps some grain, open it and tap &ldquo;Store at
            the mill&rdquo;.
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map(({ load, product, left, storedAt, keptKg }) => {
              const age = Math.max(
                0,
                Math.floor((now.getTime() - storedAt.getTime()) / 86_400_000),
              );
              return (
                <Link
                  key={load.id}
                  href={`/loads/${load.id}`}
                  className="rounded-2xl border border-line bg-card p-5 shadow-card transition hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-brand">
                        {product === "rice" ? "RICE" : "PALAY"} · #{jobRef(load.id)}
                      </div>
                      <div className="mt-1 truncate font-extrabold text-ink">
                        {load.customer_name}
                      </div>
                    </div>
                    <ExpiryBadge daysLeft={left} warningDays={warning_days} />
                  </div>
                  <div className="my-4 grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 text-center">
                    <div>
                      <div className="text-xs font-bold uppercase text-muted-foreground">
                        Quantity
                      </div>
                      <div className="mt-1 text-xs font-extrabold text-ink">
                        {kg.format(keptKg)} kg
                      </div>
                    </div>
                    <div className="border-l border-line">
                      <div className="text-xs font-bold uppercase text-muted-foreground">
                        Age
                      </div>
                      <div className="mt-1 text-xs font-extrabold text-ink">
                        {age} {age === 1 ? "day" : "days"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Stored {formatDate(storedAt)}</span>
                    <span className="flex items-center gap-1 font-bold text-brand">
                      Details <ChevronRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
