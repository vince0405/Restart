"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Someone who skipped the co-op at sign-up chooses it now. The database
 * (join_cooperative, supabase/sql/026) only allows it for their own
 * Customer account, and only while it has no co-op yet.
 */
export async function joinCooperative(formData: FormData) {
  const { supabase } = await getSession();

  const coop = String(formData.get("coop_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(coop)) redirect("/no-coop?error=coop");

  const { error } = await supabase.rpc("join_cooperative", { coop });
  if (error) redirect("/no-coop?error=failed");

  redirect("/my");
}
