import Link from "next/link";
import { ChevronRight, Leaf, Package } from "lucide-react";
import { Badge, ExpiryBadge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { ErrorNote } from "@/components/rps/error-note";
import {
  isServiceType,
  jobRef,
  type LoadRow,
  productFor,
  settlement,
  storedDaysLeft,
} from "@/lib/loads";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

export default async function StoragePage({ searchParams }: PageProps<"/storage">) {
  const { supabase } = await requireRole(isStaff);
  const { lifeline, warning_days } = await getSettings();

  const { type } = await searchParams;
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

      <ErrorNote code={error ? "load_failed" : null} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          href={filter === "palay" ? "/storage" : "/storage?type=palay"}
          className={cn(
            "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
            filter === "palay" ? "border-brand bg-brand-soft" : "border-line bg-white",
          )}
        >
          <div className="grid size-11 place-items-center rounded-xl bg-brand text-white">
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
            filter === "rice" ? "border-gold bg-gold-soft" : "border-line bg-white",
          )}
        >
          <div className="grid size-11 place-items-center rounded-xl bg-gold text-white">
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
          <div className="rounded-2xl border border-line bg-white p-10 text-center shadow-card">
            <p className="font-bold text-ink">Nothing in storage</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When a load is Ready, open it and tap &ldquo;Store at the mill&rdquo;.
            </p>
          </div>
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
                  className="rounded-2xl border border-line bg-white p-5 shadow-card transition hover:border-brand/40"
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
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">
                        Quantity
                      </div>
                      <div className="mt-1 text-xs font-extrabold text-ink">
                        {kg.format(keptKg)} kg
                      </div>
                    </div>
                    <div className="border-l border-line">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">
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
