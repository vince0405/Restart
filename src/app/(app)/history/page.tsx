import { History } from "lucide-react";
import { AuditList } from "@/components/rps/audit-list";
import { EmptyState } from "@/components/rps/empty-state";
import { Notice } from "@/components/rps/notice";
import { PageTitle } from "@/components/rps/page-title";
import type { AuditEntry } from "@/lib/audit";
import { canSeeHistory } from "@/lib/roles";
import { requireRole } from "@/lib/session";

const LIMIT = 200;

// Chairperson and Auditor: every change to jobs, people and settings,
// newest first. The database writes this log itself (supabase/sql/011);
// nobody can edit it.
export default async function HistoryPage() {
  const { supabase } = await requireRole(canSeeHistory);

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(LIMIT);
  const entries = (data ?? []) as AuditEntry[];

  // Names for "who changed it" and for people whose details changed.
  const ids = [...new Set(entries.flatMap((e) => [e.changed_by, e.table_name === "profiles" ? e.row_id : null]))]
    .filter((id): id is string => !!id);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string) || "Unnamed"]));

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="History"
        description={`Who changed what, and when. The latest ${LIMIT} changes; nobody can edit this list.`}
      />
      {error ? (
        <Notice tone="error">Could not load the history. Has 011 been run in Supabase?</Notice>
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No changes yet">
          Changes are recorded from the day the history was switched on.
        </EmptyState>
      ) : (
        <AuditList entries={entries} names={names} />
      )}
    </div>
  );
}
