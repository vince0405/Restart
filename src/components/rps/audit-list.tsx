import Link from "next/link";
import { Building2, ClipboardList, ReceiptText, Settings, UserRound, type LucideIcon } from "lucide-react";
import { Badge, type Tone } from "@/components/rps/badge";
import { ACTION_LABELS, type AuditEntry, describeChanges, TABLE_LABELS } from "@/lib/audit";
import { jobRef } from "@/lib/loads";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

const ICONS: Record<string, LucideIcon> = {
  loads: ClipboardList,
  payments: ReceiptText,
  profiles: UserRound,
  cooperatives: Building2,
  settings: Settings,
};
const ACTION_TONES: Record<AuditEntry["action"], Tone> = { insert: "green", update: "blue", delete: "red" };

/**
 * A list of changes, newest first: who, when, what, and each value before
 * and after. `names` maps an account id to the person's name. With
 * `timeOnly`, only the time is shown (when the list is already grouped by
 * day).
 */
export function AuditList({
  entries,
  names,
  showTarget = true,
  timeOnly: onlyTime = false,
}: {
  entries: AuditEntry[];
  names: Map<string, string>;
  showTarget?: boolean;
  timeOnly?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e) => {
        const lines = describeChanges(e);
        const who = e.changed_by ? (names.get(e.changed_by) ?? "Someone") : "Supabase dashboard";
        const what = TABLE_LABELS[e.table_name] ?? e.table_name;
        const Icon = ICONS[e.table_name] ?? ClipboardList;
        return (
          <li key={e.id} className="flex gap-3 rounded-xl border border-line bg-card p-3 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-ink">{who}</strong>
                <Badge tone={ACTION_TONES[e.action]}>{ACTION_LABELS[e.action]}</Badge>
                {showTarget && (
                  <span className="text-muted-foreground">
                    {e.table_name === "loads" && e.action !== "delete" ? (
                      <Link href={`/loads/${e.row_id}`} className="font-bold text-brand underline-offset-2 hover:underline">
                        {what} #{jobRef(e.row_id)}
                      </Link>
                    ) : e.table_name === "loads" ? (
                      `${what} #${jobRef(e.row_id)}`
                    ) : e.table_name === "profiles" ? (
                      `${what}: ${names.get(e.row_id) ?? "an account"}`
                    ) : e.table_name === "payments" && e.action !== "delete" ? (
                      <Link href={`/receipts/${e.row_id}`} className="font-bold text-brand underline-offset-2 hover:underline">
                        {what}
                      </Link>
                    ) : (
                      what
                    )}
                  </span>
                )}
                <time dateTime={e.changed_at} className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {onlyTime ? timeOnly(e.changed_at) : when(e.changed_at)}
                </time>
              </div>
              {lines.length > 0 && (
                <dl className="mt-2 grid gap-x-3 gap-y-1 rounded-lg bg-surface/70 p-2 text-xs sm:grid-cols-[auto_1fr]">
                  {lines.map((l) => (
                    <div key={l.field} className="contents">
                      <dt className="text-muted-foreground">{l.field}</dt>
                      <dd className="break-words">
                        {e.action === "update" ? (
                          <>
                            <span className="text-muted-foreground line-through">{l.from}</span>{" "}
                            <span aria-hidden>→</span>
                            <span className="sr-only">changed to</span>{" "}
                            <span className="font-bold text-ink">{l.to}</span>
                          </>
                        ) : (
                          <span className="text-ink">{e.action === "delete" ? l.from : l.to}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
