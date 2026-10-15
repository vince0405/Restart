// The co-op's own rice and palay supply (Ticket 37). Kept free of Next.js
// and Supabase so it can be unit-tested.
//
//   supply = bought in approved buyouts (rice for milling services, palay
//            for the rest)
//          + palay kept as harvest shares (Ticket 30)
//          + what staff added by hand − what they took out

import type { ErrorCode } from "@/lib/errors";
import { isServiceType, type LoadRow, productFor, settlement } from "@/lib/loads";

export type Product = "rice" | "palay";

export type SupplyEntry = {
  id: string;
  product: Product;
  /** Positive = added, negative = taken out. */
  kg: number;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

export type SupplyLevel = { bought: number; harvestShare: number; manual: number; total: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function supplyLevels(loads: LoadRow[], entries: Pick<SupplyEntry, "product" | "kg">[]) {
  const level = (): SupplyLevel => ({ bought: 0, harvestShare: 0, manual: 0, total: 0 });
  const out: Record<Product, SupplyLevel> = { rice: level(), palay: level() };

  for (const load of loads) {
    if (load.request_status && load.request_status !== "accepted") continue;
    if (load.buyout_status === "approved" && isServiceType(load.service_type)) {
      out[productFor(load.service_type)].bought += settlement(load).soldKg;
    }
    out.palay.harvestShare += Number(load.harvest_kept_kg ?? 0);
  }
  for (const e of entries) out[e.product].manual += Number(e.kg);

  for (const p of ["rice", "palay"] as const) {
    const l = out[p];
    l.bought = round2(l.bought);
    l.harvestShare = round2(l.harvestShare);
    l.manual = round2(l.manual);
    l.total = round2(l.bought + l.harvestShare + l.manual);
  }
  return out;
}

/** Is this level low? At or below the co-op's level counts as low. */
export function isLow(total: number, lowAt: number): boolean {
  return total <= lowAt;
}

/**
 * The "Add or take out supply" form. Taking out more than the co-op has is
 * refused (`available` is the current total for that product).
 */
export function parseSupplyEntry(
  raw: { product: unknown; direction: unknown; kg: unknown; note: unknown },
  available: Record<Product, number>,
): { ok: true; value: { product: Product; kg: number; note: string | null } } | { ok: false; error: ErrorCode } {
  const product = raw.product === "rice" || raw.product === "palay" ? raw.product : null;
  if (!product) return { ok: false, error: "supply_invalid" };

  const amount = Number(String(raw.kg ?? "").trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return { ok: false, error: "supply_invalid" };

  const out = raw.direction === "out";
  const kg = round2(out ? -amount : amount);
  if (out && amount > available[product]) return { ok: false, error: "supply_too_much" };

  const note = String(raw.note ?? "").trim().slice(0, 200);
  return { ok: true, value: { product, kg, note: note || null } };
}
