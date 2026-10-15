// Who may do what. This mirrors the permissions table in docs/SPEC.md.
//
// These rules decide which buttons and pages each role SEES. The database
// enforces the same rules again (RLS plus the loads_guard triggers in
// supabase/sql/004), so hiding a button is never the only protection.

export const ROLES = ["customer", "operator", "monitor", "chairperson", "auditor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  operator: "Operator",
  monitor: "Monitor",
  chairperson: "Chairperson",
  auditor: "Auditor",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Staff see every job. Customers see only their own. */
export const isStaff = (r: Role) => r !== "customer";

/** Accept or reject requests, log walk-ins, record payments, delete jobs. */
export const canManage = (r: Role) => r === "monitor" || r === "chairperson";

/** Move steps, weigh batches, store grain. */
export const canWork = (r: Role) => r === "operator" || canManage(r);

/** Approve or decline buyouts and record payouts. */
export const canApproveBuyout = (r: Role) => r === "chairperson";

/** Change people's roles and member flags, and the co-op settings. */
export const canManagePeople = (r: Role) => r === "chairperson";

/** See the money summary. */
export const canSeeMoney = (r: Role) =>
  r === "chairperson" || r === "monitor" || r === "auditor";
