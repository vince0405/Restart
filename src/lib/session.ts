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
};

export type Settings = {
  coop_name: string;
  farmgate_price_per_kg: number;
  lifeline: Lifeline;
  warning_days: number;
  /** How long after asking a customer may cancel a pending request. */
  cancel_window_hours: number;
  /** The price list the Chairperson sets (Ticket 25). */
  rates: Rates;
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
    .select("id, full_name, phone, role, is_member")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = {
    id: user.id,
    // Never fall back to a phone account's internal sign-in name.
    full_name:
      data?.full_name || (isPhoneSignInEmail(user.email) ? formatPhMobile(data?.phone) : user.email) || "",
    phone: data?.phone ?? "",
    // No profile row yet? Treat them as a customer: the safest choice.
    role: isRole(data?.role) ? data.role : "customer",
    is_member: data?.is_member ?? false,
  };

  return { supabase, user, profile, role: profile.role };
});

/** Like getSession, but only lets the given roles through. */
export async function requireRole(allowed: (r: Role) => boolean) {
  const session = await getSession();
  if (!allowed(session.role)) {
    redirect(isStaff(session.role) ? "/" : "/my");
  }
  return session;
}

/** The co-op's settings row, with safe defaults if it cannot be read. */
export const getSettings = cache(async (): Promise<Settings> => {
  const { supabase } = await getSession();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return {
    coop_name: data?.coop_name ?? "Batad Multipurpose Cooperative",
    farmgate_price_per_kg: Number(data?.farmgate_price_per_kg ?? 0),
    lifeline: {
      rice: data?.rice_lifeline_days ?? DEFAULT_LIFELINE.rice,
      palay: data?.palay_lifeline_days ?? DEFAULT_LIFELINE.palay,
    },
    warning_days: data?.warning_days ?? 14,
    cancel_window_hours: data?.cancel_window_hours ?? 2,
    rates: {
      harvest_share_percent: Number(data?.harvest_share_percent ?? DEFAULT_RATES.harvest_share_percent),
      dryer_load_fee: Number(data?.dryer_load_fee ?? DEFAULT_RATES.dryer_load_fee),
      dryer_load_max_sacks: Number(data?.dryer_load_max_sacks ?? DEFAULT_RATES.dryer_load_max_sacks),
      milling_fee_per_sack: Number(data?.milling_fee_per_sack ?? DEFAULT_RATES.milling_fee_per_sack),
    },
  };
});
