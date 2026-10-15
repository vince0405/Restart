import type { ReactNode } from "react";
import { expiryLabel, expiryTone } from "@/lib/loads";
import { cn } from "@/lib/utils";

export type Tone = "green" | "amber" | "red" | "gray" | "blue";

const TONES: Record<Tone, string> = {
  green: "bg-brand-soft text-brand",
  amber: "bg-gold-soft text-gold-dark",
  red: "bg-danger-soft text-danger",
  gray: "bg-surface text-muted-foreground",
  blue: "bg-info-soft text-info-dark",
};

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Amber while work is happening, green when ready, blue when stored, grey once released. */
export function stageTone(stage: string): Tone {
  if (stage === "Ready") return "green";
  if (stage === "Stored") return "blue";
  if (stage === "Released") return "gray";
  return "amber";
}

export function StageBadge({ stage }: { stage: string }) {
  return <Badge tone={stageTone(stage)}>{stage}</Badge>;
}

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function PaidBadge({ isPaid, amount }: { isPaid: boolean; amount?: number | null }) {
  return (
    <Badge tone={isPaid ? "green" : "red"}>
      {isPaid ? (amount != null ? `Paid ${peso.format(amount)}` : "Paid") : "Not paid"}
    </Badge>
  );
}

/** "12 days left" etc. Pass the co-op's warning_days from settings. */
export function ExpiryBadge({ daysLeft, warningDays }: { daysLeft: number; warningDays?: number }) {
  return <Badge tone={expiryTone(daysLeft, warningDays)}>{expiryLabel(daysLeft)}</Badge>;
}
