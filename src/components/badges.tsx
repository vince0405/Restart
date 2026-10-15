import { cn } from "@/lib/utils";

const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

// Amber while work is happening, green when ready, blue when stored,
// grey once released.
const STAGE_COLOURS: Record<string, string> = {
  Ready: "bg-status-ready text-status-ready-foreground",
  Stored: "bg-status-stored text-status-stored-foreground",
  Released: "bg-status-done text-status-done-foreground",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={cn(
        base,
        STAGE_COLOURS[stage] ?? "bg-status-progress text-status-progress-foreground",
      )}
    >
      {stage}
    </span>
  );
}

export function PaidBadge({ isPaid }: { isPaid: boolean }) {
  return (
    <span
      className={cn(
        base,
        isPaid
          ? "bg-status-ready text-status-ready-foreground"
          : "bg-status-alert text-status-alert-foreground",
      )}
    >
      {isPaid ? "Paid" : "Not paid"}
    </span>
  );
}

// For stored loads: blue while there is time, amber in the last week,
// red once expired.
export function ExpiryBadge({ daysLeft, warnAt }: { daysLeft: number; warnAt: number }) {
  return (
    <span
      className={cn(
        base,
        daysLeft <= 0
          ? "bg-status-alert text-status-alert-foreground"
          : daysLeft <= warnAt
            ? "bg-status-progress text-status-progress-foreground"
            : "bg-status-stored text-status-stored-foreground",
      )}
    >
      {daysLeft <= 0
        ? "Expired"
        : `Expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}
    </span>
  );
}
