import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadRow } from "@/lib/loads";
import { type SupplyEntry, supplyLevels } from "@/lib/supply";

/**
 * The co-op's supply levels and its hand entries, newest first (Ticket 37).
 * RLS only returns the signed-in person's own co-op (supabase/sql/019).
 */
export async function getSupply(supabase: SupabaseClient) {
  const [{ data: loads, error: loadsError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase
      .from("loads")
      .select(
        "id, created_at, customer_name, sacks, kilos, service_type, stage, agreed_price, is_paid, amount_paid, stored_at, request_status, output_kg, keep_percent, disposition, buyout_status, price_per_kg, harvest_kept_kg",
      )
      .eq("request_status", "accepted")
      .or("buyout_status.eq.approved,harvest_kept_kg.not.is.null"),
    supabase.from("supply_entries").select("*").order("created_at", { ascending: false }),
  ]);
  const rows = (entries ?? []).map((e) => ({ ...e, kg: Number(e.kg) })) as SupplyEntry[];
  return {
    levels: supplyLevels((loads ?? []) as LoadRow[], rows),
    entries: rows,
    error: loadsError ?? entriesError,
  };
}
