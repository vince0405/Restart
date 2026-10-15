// The history of changes (Ticket 26). The database writes one audit_log
// row per change (supabase/sql/011-audit-log.sql); these helpers turn a
// row into lines a person can read: "Stage: Drying → Milling".

export type AuditEntry = {
  id: number;
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  changed_by: string | null;
  changed_at: string;
  changes: Record<string, { from?: unknown; to?: unknown }>;
};

export type ChangeLine = { field: string; from: string; to: string };

const FIELD_LABELS: Record<string, string> = {
  customer_name: "Customer name",
  sacks: "Sacks",
  kilos: "Kilos",
  service_type: "Service",
  agreed_price: "Fee",
  stage: "Stage",
  stored_at: "Stored on",
  is_paid: "Paid",
  amount_paid: "Amount paid",
  request_status: "Request",
  reject_reason: "Reject reason",
  output_kg: "Output kg",
  disposition: "Keep / sell / split",
  keep_percent: "Kept %",
  buyout_status: "Buyout",
  price_per_kg: "Buyout price per kg",
  payout_done_at: "Paid out on",
  market_price_per_kg: "Market price per kg",
  harvest_fee: "Harvesting fee",
  drying_fee: "Drying fee",
  milling_fee: "Milling fee",
  harvest_address: "Harvest address",
  full_name: "Name",
  phone: "Mobile number",
  role: "Role",
  is_member: "Member",
  coop_name: "Co-op name",
  farmgate_price_per_kg: "Farmgate price per kg",
  cancel_window_hours: "Cancel window (hours)",
  harvest_share_percent: "Harvesting share %",
  dryer_load_fee: "Dryer load fee",
  dryer_load_max_sacks: "Sacks per dryer load",
  milling_fee_per_sack: "Milling fee per sack",
};

/** Columns that only repeat who/when, which the entry already shows. */
const HIDDEN = new Set(["created_at", "owner_id", "customer_id", "cancelled_by", "cancelled_at"]);

export const TABLE_LABELS: Record<string, string> = {
  loads: "Job",
  profiles: "Person",
  settings: "Settings",
};

export const ACTION_LABELS: Record<AuditEntry["action"], string> = {
  insert: "created",
  update: "changed",
  delete: "deleted",
};

export function fieldLabel(column: string): string {
  return FIELD_LABELS[column] ?? column.replaceAll("_", " ");
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  return String(value);
}

/** The readable lines for one entry, in a steady order. */
export function describeChanges(entry: Pick<AuditEntry, "changes">): ChangeLine[] {
  return Object.entries(entry.changes ?? {})
    .filter(([column]) => !HIDDEN.has(column))
    .map(([column, change]) => ({
      field: fieldLabel(column),
      from: formatValue(change?.from),
      to: formatValue(change?.to),
    }))
    .sort((a, b) => a.field.localeCompare(b.field));
}
