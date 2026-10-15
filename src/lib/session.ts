import { cache } from "react";
import { redirect } from "next/navigation";
import { DEFAULT_LIFELINE, type Lifeline } from "@/lib/loads";
import { formatPhMobile, isPhoneSignInEmail } from "@/lib/phone";
import { DEFAULT_RATES, type Rates } from "@/lib/pricing";
import { isRole, isStaff, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  is_member: boolean;
  /** The cooperative this person belongs to (Ticket 34). Null for the Admin. */
  coop_id: string | null;
};

export type Settings = {
  coop_name: string;
  town: string;
  farmgate_price_per_kg: number;
  lifeline: Lifeline;
  warning_days: number;
  /** How long after asking a customer may cancel a pending request. */
  cancel_window_hours: number;
  /** The price list the Chairperson sets (Ticket 25). */
  rates: Rates;
  /** Warn when the co-op's own supply is at or below these kg (Ticket 37). */
  low_supply: { rice: number; palay: number };
  /** How many requests one day can take before it is full (Ticket 41). */
  bookings_per_day: number;
};

/**
 * Who is signed in, and what role they have. Sends signed-out visitors to
 * /login. cache() means the layout and the page share one lookup per
 * request instead of asking the database twice.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, is_member, coop_id")
    .eq("id", user.id)
    .maybeSingle();

  // The main Admin (Ticket 34) is listed in its own table, not as a role.
  // RLS only ever shows a person their own admins row.
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();

  const profile: Profile = {
    id: user.id,
    // Never fall back to a phone account's internal sign-in name.
    full_name:
      data?.full_name || (isPhoneSignInEmail(user.email) ? formatPhMobile(data?.phone) : user.email) || "",
    phone: data?.phone ?? "",
    // No profile row yet? Treat them as a customer: the safest choice.
    role: isRole(data?.role) ? data.role : "customer",
    is_member: data?.is_member ?? false,
    coop_id: (data?.coop_id as string | null) ?? null,
  };

  return { supabase, user, profile, role: profile.role, isAdmin: !!admin };
});

/** Like getSession, but only lets the given roles through. */
export async function requireRole(allowed: (r: Role) => boolean) {
  const session = await getSession();
  // The Admin has no co-op: none of the co-op screens are for them.
  if (session.isAdmin) redirect("/admin");
  if (!allowed(session.role)) {
    redirect(isStaff(session.role) ? "/" : "/my");
  }
  return session;
}

export type PriceChange = { price_per_kg: number; set_at: string; set_by: string | null };

/**
 * Past farmgate reference prices, newest first (Ticket 28). The database
 * adds a line each time the Chairperson changes the price (supabase/sql/013).
 * Empty if 013 has not been run, or for a customer (RLS).
 */
export const getPriceHistory = cache(async (): Promise<PriceChange[]> => {
  const { supabase } = await getSession();
  const { data } = await supabase
    .from("price_history")
    .select("price_per_kg, set_at, set_by")
    .order("set_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((p) => ({ ...p, price_per_kg: Number(p.price_per_kg) }));
});

/**
 * The signed-in person's co-op and its settings (Ticket 34: each co-op has
 * its own row in `cooperatives`), with safe defaults if it cannot be read.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const { supabase, profile } = await getSession();
  const { data } = profile.coop_id
    ? await supabase.from("cooperatives").select("*").eq("id", profile.coop_id).maybeSingle()
    : { data: null };
  return {
    coop_name: data?.name ?? "Your cooperative",
    town: data?.town ?? "",
    farmgate_price_per_kg: Number(data?.farmgate_price_per_kg ?? 0),
    lifeline: {
      rice: data?.rice_lifeline_days ?? DEFAULT_LIFELINE.rice,
      palay: data?.palay_lifeline_days ?? DEFAULT_LIFELINE.palay,
    },
    warning_days: data?.warning_days ?? 14,
    cancel_window_hours: data?.cancel_window_hours ?? 2,
    bookings_per_day: Number(data?.bookings_per_day ?? 1),
    low_supply: {
      rice: Number(data?.low_rice_kg ?? 100),
      palay: Number(data?.low_palay_kg ?? 500),
    },
    rates: {
      harvest_share_percent: Number(data?.harvest_share_percent ?? DEFAULT_RATES.harvest_share_percent),
      dryer_load_fee: Number(data?.dryer_load_fee ?? DEFAULT_RATES.dryer_load_fee),
      dryer_load_max_sacks: Number(data?.dryer_load_max_sacks ?? DEFAULT_RATES.dryer_load_max_sacks),
      milling_fee_per_sack: Number(data?.milling_fee_per_sack ?? DEFAULT_RATES.milling_fee_per_sack),
    },
  };
});
