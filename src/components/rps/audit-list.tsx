import Link from "next/link";
import { ACTION_LABELS, type AuditEntry, describeChanges, TABLE_LABELS } from "@/lib/audit";
import { jobRef } from "@/lib/loads";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

/**
 * A list of changes, newest first: who, when, what, and each value before
 * and after. `names` maps an account id to the person's name.
 */
export function AuditList({
  entries,
  names,
  showTarget = true,
}: {
  entries: AuditEntry[];
  names: Map<string, string>;
  showTarget?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((e) => {
        const lines = describeChanges(e);
        const who = e.changed_by ? (names.get(e.changed_by) ?? "Someone") : "Supabase dashboard";
        const what = TABLE_LABELS[e.table_name] ?? e.table_name;
        return (
          <li key={e.id} className="rounded-xl border border-line bg-card p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <strong className="text-ink">{who}</strong>
              <span className="text-muted-foreground">
                {ACTION_LABELS[e.action]}{" "}
                {showTarget &&
                  (e.table_name === "loads" && e.action !== "delete" ? (
                    <Link href={`/loads/${e.row_id}`} className="font-bold text-brand underline-offset-2 hover:underline">
                      {what} #{jobRef(e.row_id)}
                    </Link>
                  ) : e.table_name === "loads" ? (
                    `${what} #${jobRef(e.row_id)}`
                  ) : e.table_name === "profiles" ? (
                    `${what}: ${names.get(e.row_id) ?? "an account"}`
                  ) : (
                    what
                  ))}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{when(e.changed_at)}</span>
            </div>
            {lines.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {lines.map((l) => (
                  <li key={l.field} className="break-words">
                    <span className="text-muted-foreground">{l.field}:</span>{" "}
                    {e.action === "update" ? (
                      <>
                        <span className="text-muted-foreground line-through">{l.from}</span>{" "}
                        → <span className="font-bold text-ink">{l.to}</span>
                      </>
                    ) : (
                      <span className="text-ink">{e.action === "delete" ? l.from : l.to}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
