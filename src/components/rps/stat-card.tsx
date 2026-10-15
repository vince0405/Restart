import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  green: "bg-brand-soft text-brand",
  amber: "bg-gold-soft text-gold-dark",
  blue: "bg-info-soft text-info-dark",
  red: "bg-danger-soft text-danger",
} as const;

/**
 * A dashboard number: icon, label, big value, and a note. "attention" adds
 * a gold edge AND the words "Needs attention" — never colour alone.
 */
export function StatCard({
  label,
  value,
  unit,
  note,
  icon: Icon,
  tone = "green",
  href,
  attention,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
  attention?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className={cn("grid size-10 place-items-center rounded-xl", TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </div>
        {attention && (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
            Needs attention
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold tracking-tight tabular-nums text-ink">{value}</span>
        {unit && <span className="text-xs font-bold text-muted-foreground">{unit}</span>}
      </div>
      {note && <div className="mt-1.5 text-xs font-semibold text-muted-foreground">{note}</div>}
    </>
  );
  const box = cn(
    "block rounded-2xl border bg-card p-4 shadow-card",
    attention ? "border-2 border-gold" : "border-line",
    href && "transition-colors hover:border-brand",
    className,
  );
  return href ? (
    <Link href={href} className={box}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}
