"use server";

import { redirect } from "next/navigation";
import { parseAmountPaid } from "@/lib/loads";
import { isRole } from "@/lib/roles";
import { getSession } from "@/lib/session";

/**
 * Chairperson only: change someone's role or member flag. This calls the
 * database function set_person(), which refuses anyone who is not the
 * Chairperson — so even a hand-made request from a customer cannot
 * promote anybody.
 */
export async function updatePerson(formData: FormData) {
  const { supabase } = await getSession();
  const target = String(formData.get("id") ?? "");
  const role = formData.get("role");

  if (!isRole(role)) redirect("/people?error=role");

  const { error } = await supabase.rpc("set_person", {
    target,
    new_role: role,
    new_is_member: formData.get("is_member") === "on",
  });

  if (error) redirect(`/people?error=${encodeURIComponent(error.message)}`);
  redirect("/people?saved=1");
}

/** Chairperson only (RLS on settings): the farmgate reference price. */
export async function updateSettings(formData: FormData) {
  const { supabase } = await getSession();

  const price = parseAmountPaid(formData.get("farmgate_price_per_kg"));
  if (!price.ok) redirect("/settings?error=price");

  const coopName = String(formData.get("coop_name") ?? "").trim().slice(0, 120);
  if (!coopName) redirect("/settings?error=name");

  const { error } = await supabase
    .from("settings")
    .update({ farmgate_price_per_kg: price.value, coop_name: coopName })
    .eq("id", 1);

  if (error) redirect("/settings?error=save");
  redirect("/settings?saved=1");
}
