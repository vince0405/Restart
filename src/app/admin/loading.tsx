import { Leaf } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// The Admin console's loading screen (Ticket 39), shaped like the page:
// header, title, four summary cards and the co-op list.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8" role="status" aria-live="polite">
      <div className="mb-8 flex items-center justify-between">
        <Skeleton className="h-10 w-40" />
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-card">
          <Leaf className="sway size-4 text-brand" aria-hidden />
          Loading…
        </div>
      </div>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
