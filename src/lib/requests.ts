// Searching and filtering the Requests list. Kept free of Next.js and
// Supabase so it can be unit-tested.

import { jobRef } from "./loads";
import { matchesPerson } from "./people";

export type SearchableRequest = {
  id: string;
  customer_name: string;
  contact_phone: string | null;
  harvest_address: string | null;
  customer_note: string | null;
  customer: { full_name: string; phone: string } | null;
};

/** Who to show: everyone, only co-op members, or only non-members. */
export const WHO = ["all", "members", "others"] as const;
export type Who = (typeof WHO)[number];

/**
 * Does this request match the search? Looks at the name on the request, the
 * account's name, either mobile number, the reference (RPS-AB12C, with or
 * without "RPS-" or "#"), the farm address and the customer's note.
 */
export function matchesRequest(r: SearchableRequest, q: string): boolean {
  const text = q.trim().toLowerCase();
  if (!text) return true;

  const ref = jobRef(r.id).toLowerCase(); // "rps-ab12c"
  const typedRef = text.replace(/^#/, "");
  if (typedRef.length >= 3 && (ref.includes(typedRef) || ref.slice(4).startsWith(typedRef))) return true;

  for (const words of [r.harvest_address, r.customer_note]) {
    if (words && words.toLowerCase().includes(text)) return true;
  }

  // Names and phone numbers, the same way the People search works.
  return [
    { full_name: r.customer_name, phone: r.contact_phone ?? "" },
    { full_name: r.customer?.full_name ?? "", phone: r.customer?.phone ?? "" },
  ].some((p) => matchesPerson(p, text));
}
