import { cn } from "@/lib/utils";

/** A grey placeholder shape shown while a screen loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-surface", className)} />;
}
