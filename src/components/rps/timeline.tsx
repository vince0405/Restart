import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The processing timeline: vertical on phones, one column per step on
 * wider screens. Finished steps get a tick; the current step is gold.
 */
export function Timeline({ steps, current }: { steps: readonly string[]; current: string }) {
  const index = steps.indexOf(current);
  const finished = current === "Released";

  return (
    <ol
      className="grid md:[grid-template-columns:repeat(var(--steps),minmax(0,1fr))]"
      style={{ ["--steps" as string]: steps.length }}
    >
      {steps.map((step, i) => {
        const done = i < index || (finished && i === index);
        const isCurrent = i === index && !finished;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0 md:block md:pb-0">
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-4 top-8 h-full w-0.5 md:left-1/2 md:top-4 md:h-0.5 md:w-full",
                  i < index ? "bg-brand" : "bg-line",
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold md:mx-auto",
                done && "bg-brand text-on-brand",
                isCurrent && "bg-gold text-on-gold ring-4 ring-gold-soft",
                !done && !isCurrent && "bg-surface text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </div>
            <div className="md:mt-3 md:text-center">
              <div className="text-xs font-extrabold text-ink">{step}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {done
                  ? "Done"
                  : isCurrent
                    ? step === "Ready"
                      ? "Waiting for customer"
                      : "In progress"
                    : "Pending"}
                {isCurrent && <span className="sr-only"> (current step)</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
