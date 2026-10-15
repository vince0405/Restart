// The co-op's price list (Tickets 24 and 25). The Chairperson sets the
// rates in Settings; the database works out the real fee with the SAME
// rules (supabase/sql/010-configurable-rates.sql). These functions are for
// showing the numbers on screen.
//
//   harvesting = share % of the harvested kg x market price of palay per kg
//   drying     = fee per dryer load (a load holds up to max sacks; fewer
//                still costs a full load, more needs another load)
//   milling    = fee per sack, counted after drying

export type Rates = {
  /** Percent of the harvested kg, e.g. 15. */
  harvest_share_percent: number;
  dryer_load_fee: number;
  dryer_load_max_sacks: number;
  milling_fee_per_sack: number;
};

/** Today's rates, used until the settings row says otherwise. */
export const DEFAULT_RATES: Rates = {
  harvest_share_percent: 15,
  dryer_load_fee: 9000,
  dryer_load_max_sacks: 130,
  milling_fee_per_sack: 120,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The harvest share, in kg. */
export function harvestShareKg(kilos: number, rates: Rates = DEFAULT_RATES): number {
  return round2((kilos * rates.harvest_share_percent) / 100);
}

/** The harvesting fee in pesos: the share of the kg x today's market price. */
export function harvestFee(kilos: number, marketPricePerKg: number, rates: Rates = DEFAULT_RATES): number {
  return round2(((kilos * rates.harvest_share_percent) / 100) * marketPricePerKg);
}

/** Dryer loads needed: up to max sacks per load, at least one load. */
export function dryerLoads(sacks: number, rates: Rates = DEFAULT_RATES): number {
  return Math.max(1, Math.ceil(sacks / rates.dryer_load_max_sacks));
}

export function dryingFee(sacks: number, rates: Rates = DEFAULT_RATES): number {
  return dryerLoads(sacks, rates) * rates.dryer_load_fee;
}

export function millingFee(sacks: number, rates: Rates = DEFAULT_RATES): number {
  return round2(sacks * rates.milling_fee_per_sack);
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
export function feeAtIntake(service: string, sacks: number, rates: Rates = DEFAULT_RATES): number {
  if (service === "Drying only") return dryingFee(sacks, rates);
  if (service === "Milling only") return millingFee(sacks, rates);
  return 0; // harvesting services: worked out after the harvest count
}

/**
 * Reads the four rates from the Settings form. Returns null if any is
 * missing or out of range (the database refuses the same values).
 */
export function parseRates(get: (name: string) => unknown): Rates | null {
  const num = (name: string) => {
    const raw = String(get(name) ?? "").trim();
    return raw === "" ? NaN : Number(raw);
  };
  const rates: Rates = {
    harvest_share_percent: num("harvest_share_percent"),
    dryer_load_fee: num("dryer_load_fee"),
    dryer_load_max_sacks: num("dryer_load_max_sacks"),
    milling_fee_per_sack: num("milling_fee_per_sack"),
  };
  const ok =
    rates.harvest_share_percent >= 0 &&
    rates.harvest_share_percent <= 100 &&
    rates.dryer_load_fee >= 0 &&
    Number.isInteger(rates.dryer_load_max_sacks) &&
    rates.dryer_load_max_sacks > 0 &&
    rates.milling_fee_per_sack >= 0;
  return ok ? rates : null;
}

/**
 * The fee after a count (Ticket 27): the new price-list total plus the
 * saved adjustment (negative = discount), never below zero. Same rule as
 * the database (supabase/sql/012-discounts-stay.sql).
 */
export function feeWithAdjustment(listTotal: number, adjustment: number): number {
  return Math.max(0, round2(listTotal + adjustment));
}

/**
 * The harvest share paid in palay (Ticket 30): the co-op keeps the share
 * of the kilos and the same share of the sacks (rounded to whole sacks);
 * the farmer's grain is the rest, and the harvest fee is P0. Same rule as
 * the database (supabase/sql/015-harvest-fee-in-palay.sql).
 */
export function harvestShareInPalay(kilos: number, sacks: number, rates: Rates = DEFAULT_RATES) {
  const keptKg = harvestShareKg(kilos, rates);
  const keptSacks = Math.round((sacks * rates.harvest_share_percent) / 100);
  return { keptKg, farmerKg: round2(kilos - keptKg), farmerSacks: sacks - keptSacks };
}

/**
 * A shared dryer load's fee split between its jobs by sacks (Ticket 29).
 * Each job pays fee x its sacks / all sacks, to the centavo; the job with
 * the fewest sacks gets what is left, so the parts add up to the fee.
 * Returns the parts in the same order as `sacks`. Same rule as
 * share_dryer_load() in supabase/sql/016-shared-dryer-load.sql.
 */
export function splitDryerLoad(fee: number, sacks: number[]): number[] {
  const total = sacks.reduce((a, b) => a + b, 0);
  // Most sacks first; ties keep their order.
  const order = sacks.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const parts = new Array<number>(sacks.length).fill(0);
  let given = 0;
  order.forEach(({ s, i }, k) => {
    const part =
      k === order.length - 1
        ? round2(fee - given)
        : total > 0
          ? round2((fee * s) / total)
          : round2(fee / sacks.length);
    parts[i] = part;
    given = round2(given + part);
  });
  return parts;
}
