import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product, SupplyEntry, SupplyLevel } from "@/lib/supply";

/**
 * The co-op's supply levels and its latest hand entries (Ticket 37). The
 * totals are added up in the database by supply_levels() (023), so they
 * are right however many jobs there are; the database also refuses taking
 * out more than there is. RLS only returns the person's own co-op.
 */
export async function getSupply(supabase: SupabaseClient) {
  const [{ data: rows, error: levelsError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.rpc("supply_levels"),
    supabase.from("supply_entries").select("*").order("created_at", { ascending: false }).limit(8),
  ]);
  const empty = (): SupplyLevel => ({ bought: 0, harvestShare: 0, manual: 0, total: 0 });
  const levels: Record<Product, SupplyLevel> = { rice: empty(), palay: empty() };
  for (const r of (rows ?? []) as { product: Product; bought: number; harvest_share: number; manual: number; total: number }[]) {
    if (r.product !== "rice" && r.product !== "palay") continue;
    levels[r.product] = {
      bought: Number(r.bought),
      harvestShare: Number(r.harvest_share),
      manual: Number(r.manual),
      total: Number(r.total),
    };
  }
  return {
    levels,
    entries: ((entries ?? []) as SupplyEntry[]).map((e) => ({ ...e, kg: Number(e.kg) })),
    error: levelsError ?? entriesError,
  };
}
