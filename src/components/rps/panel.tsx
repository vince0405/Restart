import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A card section. Use for every block on a detail page. */
export function Panel({
  children,
  className,
  highlight,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  /** Gold edge: something here needs doing now. */
  highlight?: boolean;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-card sm:p-5",
        highlight ? "border-2 border-gold" : "border-line",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A panel's heading row: tinted icon, title, and something on the right. */
export function PanelHead({
  icon: Icon,
  tone = "bg-brand-soft text-brand",
  title,
  id,
  right,
}: {
  icon: LucideIcon;
  tone?: string;
  title: string;
  id?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 id={id} className="text-base font-extrabold text-ink">
        {title}
      </h2>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/** A small labelled fact: "WEIGHT / 1,850 kg". Use inside a <dl>. */
export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-extrabold text-ink">{value}</dd>
    </div>
  );
}

/** A money line with the amount right-aligned in even-width digits. */
export function MoneyRow({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        strong ? "font-extrabold text-ink" : "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className={cn("text-right tabular-nums", !strong && "font-bold text-ink")}>{value}</span>
    </div>
  );
}
