// Searching and filtering a customer's own list (My transactions). The
// groups match the tiles at the top of that page. Kept free of Next.js and
// Supabase so it can be unit-tested.

import { customerStatus, jobRef, type LoadRow } from "./loads";

/** The filter tabs, in order. "all" is the default. */
export const MY_GROUPS = ["all", "waiting", "in_progress", "to_choose", "stored", "completed", "closed"] as const;
export type MyGroup = (typeof MY_GROUPS)[number];

export const MY_GROUP_LABELS: Record<MyGroup, string> = {
  all: "All",
  waiting: "Waiting",
  in_progress: "Being processed",
  to_choose: "Your choice",
  stored: "Stored",
  completed: "Completed",
  closed: "Not accepted or cancelled",
};

/** Which tab a transaction belongs in — the same rules as customerSummary(). */
export function myGroup(load: LoadRow): Exclude<MyGroup, "all"> {
  if (load.request_status === "pending") return "waiting";
  if (load.request_status !== "accepted") return "closed";
  if (load.stage === "Stored") return "stored";
  if (load.stage === "Released") return "completed";
  if (load.stage === "Ready" && load.output_kg != null && !load.disposition) return "to_choose";
  return "in_progress";
}

/**
 * Does this transaction match the search? Looks at the reference (RPS-AB12C,
 * with or without "RPS-" or "#"), the service, what is happening with it
 * (e.g. "stored", "drying") and the co-op's reason if it was not accepted.
 */
export function matchesMyTransaction(load: LoadRow, q: string): boolean {
  const text = q.trim().toLowerCase().replace(/^#/, "");
  if (!text) return true;
  return [jobRef(load.id), load.service_type, customerStatus(load).label, load.stage, load.reject_reason ?? ""].some(
    (field) => field.toLowerCase().includes(text),
  );
}
