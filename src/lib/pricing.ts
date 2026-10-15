// The co-op's price list (Ticket 24). The database works out the real fee
// with the SAME rules (supabase/sql/009-service-pricing.sql), so if a rate
// changes here, change it there too.
//
//   harvesting = 15% of the harvested kg x market price of palay per kg
//   drying     = P9,000 per dryer load (up to 130 sacks; fewer still costs
//                a full load, more needs another load)
//   milling    = P120 per sack, counted after drying

export const HARVEST_SHARE = 0.15;
export const DRYER_LOAD_FEE = 9000;
export const DRYER_LOAD_MAX_SACKS = 130;
export const MILLING_FEE_PER_SACK = 120;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 15% of the harvest, in kg. */
export function harvestShareKg(kilos: number): number {
  return round2(kilos * HARVEST_SHARE);
}

/** The harvesting fee in pesos: 15% of the kg x today's market price. */
export function harvestFee(kilos: number, marketPricePerKg: number): number {
  return round2(kilos * HARVEST_SHARE * marketPricePerKg);
}

/** Dryer loads needed: up to 130 sacks per load, at least one load. */
export function dryerLoads(sacks: number): number {
  return Math.max(1, Math.ceil(sacks / DRYER_LOAD_MAX_SACKS));
}

export function dryingFee(sacks: number): number {
  return dryerLoads(sacks) * DRYER_LOAD_FEE;
}

export function millingFee(sacks: number): number {
  return round2(sacks * MILLING_FEE_PER_SACK);
}

/** The fee parts saved on a job (null = not worked out yet / not part of it). */
export type FeeParts = {
  harvest_fee?: number | null;
  drying_fee?: number | null;
  milling_fee?: number | null;
};

/** The price-list total of the parts worked out so far. */
export function priceListTotal(parts: FeeParts): number {
  return round2(
    Number(parts.harvest_fee ?? 0) + Number(parts.drying_fee ?? 0) + Number(parts.milling_fee ?? 0),
  );
}

/** The fee from the price list when a Drying only or Milling only job is logged. */
export function feeAtIntake(service: string, sacks: number): number {
  if (service === "Drying only") return dryingFee(sacks);
  if (service === "Milling only") return millingFee(sacks);
  return 0; // harvesting services: worked out after the harvest count
}
