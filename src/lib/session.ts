import { cache } from "react";
import { redirect } from "next/navigation";
import { DEFAULT_LIFELINE, type Lifeline } from "@/lib/loads";
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
    full_name: data?.full_name || user.email || "",
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
  };
});
