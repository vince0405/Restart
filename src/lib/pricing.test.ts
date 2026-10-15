import { describe, expect, it } from "vitest";
import {
  dryerLoads,
  dryingFee,
  feeAtIntake,
  harvestFee,
  harvestShareKg,
  millingFee,
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
});
