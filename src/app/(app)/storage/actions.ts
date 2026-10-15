"use server";

import { redirect } from "next/navigation";
import { codeForDbError } from "@/lib/errors";
import { canWork } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { parseSupplyEntry } from "@/lib/supply";
import { getSupply } from "./supply";

/**
 * Add rice or palay to the co-op's supply, or take some out (sold, used),
 * by hand (Ticket 37). Operators, Monitors and the Chairperson; the
 * database checks the same and records who and when (supabase/sql/019).
 */
export async function addSupply(formData: FormData) {
  const { supabase } = await requireRole(canWork);
  const { levels } = await getSupply(supabase);

  const parsed = parseSupplyEntry(
    {
      product: formData.get("product"),
      direction: formData.get("direction"),
      kg: formData.get("kg"),
      note: formData.get("note"),
    },
    { rice: levels.rice.total, palay: levels.palay.total },
  );
  if (!parsed.ok) redirect(`/storage?error=${parsed.error}#supply`);

  const { error } = await supabase.from("supply_entries").insert(parsed.value);
  if (error) redirect(`/storage?error=${codeForDbError(error)}#supply`);

  redirect("/storage?supply=saved#supply");
}
