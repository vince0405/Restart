import { Leaf } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Shown at once while any signed-in screen loads its data, so a slow
// connection shows the page "taking shape" instead of nothing — with a
// swaying leaf and words, so nobody thinks the app froze (Ticket 37).
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-card">
        <Leaf className="sway size-4 text-brand" aria-hidden />
        Loading…
      </div>
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="mb-6 h-8 w-64 max-w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-2xl" />
    </div>
  );
}
