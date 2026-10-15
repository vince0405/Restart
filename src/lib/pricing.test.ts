import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATES,
  dryerLoads,
  dryingFee,
  feeAtIntake,
  feeWithAdjustment,
  harvestFee,
  harvestShareInPalay,
  splitDryerLoad,
  harvestShareKg,
  millingFee,
  parseRates,
  priceListTotal,
} from "./pricing";

describe("price list", () => {
  it("charges 15% of the harvest at the market price", () => {
    expect(harvestShareKg(6000)).toBe(900);
    expect(harvestFee(6000, 20)).toBe(18000);
    expect(harvestFee(6000, 0)).toBe(0);
  });

  it("charges P9,000 per dryer load of up to 130 sacks", () => {
    expect(dryerLoads(50)).toBe(1);
    expect(dryerLoads(120)).toBe(1);
    expect(dryerLoads(130)).toBe(1);
    expect(dryerLoads(131)).toBe(2);
    expect(dryerLoads(200)).toBe(2);
    expect(dryerLoads(0)).toBe(1);
    expect(dryingFee(125)).toBe(9000);
    expect(dryingFee(200)).toBe(18000);
  });

  it("charges P120 per sack for milling", () => {
    expect(millingFee(95)).toBe(11400);
  });

  it("works out the ticket's Package Deal example", () => {
    // 100 sacks harvested at 6,000 kg, P20/kg; 95 sacks after drying.
    const total = priceListTotal({
      harvest_fee: harvestFee(6000, 20),
      drying_fee: dryingFee(100),
      milling_fee: millingFee(95),
    });
    expect(total).toBe(38400);
  });

  it("prices Drying only and Milling only at intake", () => {
    expect(feeAtIntake("Drying only", 125)).toBe(9000);
    expect(feeAtIntake("Milling only", 10)).toBe(1200);
    expect(feeAtIntake("Package Deal", 100)).toBe(0);
  });

  it("uses the Chairperson's rates when they change", () => {
    const rates = {
      harvest_share_percent: 12,
      dryer_load_fee: 10000,
      dryer_load_max_sacks: 100,
      milling_fee_per_sack: 150,
    };
    expect(harvestFee(6000, 20, rates)).toBe(14400);
    expect(dryerLoads(130, rates)).toBe(2);
    expect(dryingFee(130, rates)).toBe(20000);
    expect(millingFee(95, rates)).toBe(14250);
    expect(feeAtIntake("Milling only", 10, rates)).toBe(1500);
    // The defaults are still today's price list.
    expect(DEFAULT_RATES.harvest_share_percent).toBe(15);
  });

  it("reads the rates from the Settings form and refuses bad ones", () => {
    const form = (v: Record<string, string>) => (name: string) => v[name];
    const good = {
      harvest_share_percent: "15",
      dryer_load_fee: "9000",
      dryer_load_max_sacks: "130",
      milling_fee_per_sack: "120",
    };
    expect(parseRates(form(good))).toEqual(DEFAULT_RATES);
    expect(parseRates(form({ ...good, harvest_share_percent: "120" }))).toBeNull();
    expect(parseRates(form({ ...good, dryer_load_max_sacks: "0" }))).toBeNull();
    expect(parseRates(form({ ...good, dryer_load_max_sacks: "12.5" }))).toBeNull();
    expect(parseRates(form({ ...good, milling_fee_per_sack: "" }))).toBeNull();
    expect(parseRates(form({ ...good, dryer_load_fee: "-1" }))).toBeNull();
  });

  it("keeps a discount after the next count", () => {
    // Harvest count: list says P27,000; staff make it P26,000 (-1,000).
    const adjustment = 26000 - priceListTotal({ harvest_fee: 18000, drying_fee: 9000 });
    expect(adjustment).toBe(-1000);
    // After drying, milling adds P11,400: the discount is still there.
    const list = priceListTotal({ harvest_fee: 18000, drying_fee: 9000, milling_fee: 11400 });
    expect(feeWithAdjustment(list, adjustment)).toBe(37400);
    // An extra charge works the same way, and the fee never goes below zero.
    expect(feeWithAdjustment(list, 500)).toBe(38900);
    expect(feeWithAdjustment(1000, -5000)).toBe(0);
  });
});

describe("harvest share paid in palay (Ticket 30)", () => {
  it("keeps 15% of the kilos and sacks; the farmer has the rest", () => {
    expect(harvestShareInPalay(2000, 40)).toEqual({ keptKg: 300, farmerKg: 1700, farmerSacks: 34 });
  });

  it("follows the co-op's own share", () => {
    const rates = { ...DEFAULT_RATES, harvest_share_percent: 10 };
    expect(harvestShareInPalay(2000, 40, rates)).toEqual({ keptKg: 200, farmerKg: 1800, farmerSacks: 36 });
  });

  it("rounds the kept sacks to whole sacks", () => {
    // 15% of 25 sacks = 3.75, kept as 4.
    expect(harvestShareInPalay(1250.5, 25).farmerSacks).toBe(21);
    expect(harvestShareInPalay(1250.5, 25).keptKg).toBe(187.58);
  });
});

describe("sharing one dryer load (Ticket 29)", () => {
  it("splits the fee by sacks, as in the ticket", () => {
    expect(splitDryerLoad(9000, [90, 40])).toEqual([6230.77, 2769.23]);
  });

  it("charges a job alone the whole load", () => {
    expect(splitDryerLoad(9000, [25])).toEqual([9000]);
  });

  it("always adds up to the full fee, to the centavo", () => {
    const parts = splitDryerLoad(9000, [43, 43, 44]);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100).toBe(9000);
    expect(parts).toEqual([2976.92, 2976.93, 3046.15]);
  });

  it("keeps the order the jobs were given in", () => {
    expect(splitDryerLoad(9000, [40, 90])).toEqual([2769.23, 6230.77]);
  });
});

describe("rates from the Settings form (Ticket 42)", () => {
  const form = { harvest_share_percent: "15", dryer_load_fee: "9000", dryer_load_max_sacks: "130", milling_fee_per_sack: "120" };
  const get = (f: Record<string, string>) => (name: string) => f[name];
  it("accepts normal rates and refuses Infinity", () => {
    expect(parseRates(get(form))).not.toBeNull();
    expect(parseRates(get({ ...form, dryer_load_fee: "Infinity" }))).toBeNull();
    expect(parseRates(get({ ...form, milling_fee_per_sack: "1e999" }))).toBeNull();
  });
});
