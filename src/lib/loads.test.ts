import { describe, expect, it } from "vitest";
import {
  cancelDeadline,
  countsAfter,
  describeCount,
  customerSummary,
  customerStatus,
  daysLeft,
  expiryDate,
  expiryLabel,
  expiryTone,
  firstStage,
  jobRef,
  moneyStats,
  moneySummary,
  type LoadRow,
  needsHarvestAddress,
  nextStage,
  parseAmountPaid,
  parseCount,
  parseLoadInput,
  prevStage,
  productFor,
  SERVICE_TYPES,
  parseDisposition,
  parseHarvestAddress,
  parseStatsRange,
  settlement,
  stepsFor,
  summarize,
  withinCancelWindow,
} from "./loads";

describe("service steps", () => {
  it("starts each service at its own first step", () => {
    expect(firstStage("Package Deal")).toBe("Harvesting");
    expect(firstStage("Harvesting + Drying")).toBe("Harvesting");
    expect(firstStage("Drying only")).toBe("Received");
    expect(firstStage("Milling only")).toBe("Received");
  });

  it("walks a Package Deal through every step and stops at Released", () => {
    expect(nextStage("Package Deal", "Harvesting")).toBe("Drying");
    expect(nextStage("Package Deal", "Drying")).toBe("Milling");
    expect(nextStage("Package Deal", "Milling")).toBe("Ready");
    expect(nextStage("Package Deal", "Ready")).toBe("Released");
    expect(nextStage("Package Deal", "Released")).toBeNull();
  });

  it("skips steps a service does not have", () => {
    expect(nextStage("Harvesting + Drying", "Drying")).toBe("Ready");
    expect(nextStage("Drying only", "Received")).toBe("Drying");
    expect(nextStage("Milling only", "Received")).toBe("Milling");
    expect(stepsFor("Drying only")).not.toContain("Harvesting");
    expect(stepsFor("Drying only")).not.toContain("Milling");
    expect(stepsFor("Milling only")).not.toContain("Drying");
  });

  it("moves back one step and stops at the first", () => {
    expect(prevStage("Package Deal", "Drying")).toBe("Harvesting");
    expect(prevStage("Milling only", "Ready")).toBe("Milling");
    expect(prevStage("Drying only", "Received")).toBeNull();
  });

  it("has no next or back for a step the service does not have", () => {
    expect(nextStage("Drying only", "Milling")).toBeNull();
    expect(prevStage("Drying only", "Milling")).toBeNull();
  });

  it("round-trips every middle step of every service", () => {
    for (const service of SERVICE_TYPES) {
      for (const stage of stepsFor(service).slice(0, -1)) {
        expect(prevStage(service, nextStage(service, stage)!)).toBe(stage);
      }
    }
  });
});

describe("parseLoadInput", () => {
  const valid = {
    customer_name: "  Mang Tonio  ",
    sacks: "12",
    kilos: "600.5",
    service_type: "Package Deal",
    agreed_price: "15000",
  };

  it("accepts a good load and trims the name", () => {
    const result = parseLoadInput(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        customer_name: "Mang Tonio",
        sacks: 12,
        kilos: 600.5,
        service_type: "Package Deal",
        agreed_price: 15000,
      });
    }
  });

  it("accepts zero sacks, kilos and price", () => {
    const result = parseLoadInput({
      ...valid,
      sacks: "0",
      kilos: "0",
      agreed_price: "0",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(parseLoadInput({ ...valid, customer_name: "   " }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, customer_name: "" }).ok).toBe(false);
  });

  it("rejects empty, negative or fractional sacks", () => {
    expect(parseLoadInput({ ...valid, service_type: "Drying only", sacks: "" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, sacks: "-1" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, sacks: "1.5" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, sacks: "abc" }).ok).toBe(false);
  });

  it("rejects empty or negative kilos", () => {
    expect(parseLoadInput({ ...valid, service_type: "Drying only", kilos: "" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, kilos: "-3" }).ok).toBe(false);
  });

  it("rejects a service type that is not on the list", () => {
    expect(parseLoadInput({ ...valid, service_type: "" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, service_type: "Harvesting" }).ok).toBe(
      false,
    );
  });

  it("rejects empty or negative price", () => {
    // Empty = use the price list.
    const priceList = parseLoadInput({ ...valid, agreed_price: "" });
    expect(priceList.ok && priceList.value.agreed_price).toBe(0);
    expect(parseLoadInput({ ...valid, agreed_price: "-5" }).ok).toBe(false);
  });
});

describe("parseAmountPaid", () => {
  it("accepts zero and positive amounts", () => {
    expect(parseAmountPaid("0")).toEqual({ ok: true, value: 0 });
    expect(parseAmountPaid("1250.75")).toEqual({ ok: true, value: 1250.75 });
  });

  it("rejects empty and negative amounts", () => {
    expect(parseAmountPaid("").ok).toBe(false);
    expect(parseAmountPaid("-1").ok).toBe(false);
    expect(parseAmountPaid(undefined).ok).toBe(false);
  });
});

describe("storage", () => {
  it("adds a Stored step before Released only for stored loads", () => {
    expect(stepsFor("Drying only", true)).toEqual([
      "Received",
      "Drying",
      "Ready",
      "Stored",
      "Released",
    ]);
    expect(nextStage("Package Deal", "Ready")).toBe("Released");
    expect(nextStage("Package Deal", "Ready", true)).toBe("Stored");
    expect(nextStage("Package Deal", "Stored", true)).toBe("Released");
    expect(prevStage("Package Deal", "Released", true)).toBe("Stored");
    expect(prevStage("Package Deal", "Stored", true)).toBe("Ready");
  });

  it("stores rice when the service mills, palay otherwise", () => {
    expect(productFor("Package Deal")).toBe("rice");
    expect(productFor("Milling only")).toBe("rice");
    expect(productFor("Drying only")).toBe("palay");
    expect(productFor("Harvesting + Drying")).toBe("palay");
  });

  it("keeps rice 30 days and palay 90 days by default", () => {
    const stored = new Date("2026-10-15T02:00:00Z");
    expect(expiryDate(stored, "Milling only").toISOString()).toBe(
      "2026-11-14T02:00:00.000Z",
    );
    expect(expiryDate(stored, "Drying only").toISOString()).toBe(
      "2027-01-13T02:00:00.000Z",
    );
  });

  it("uses the co-op's own lifeline when given", () => {
    const stored = new Date("2026-10-15T02:00:00Z");
    expect(
      expiryDate(stored, "Package Deal", { rice: 10, palay: 60 }).toISOString(),
    ).toBe("2026-10-25T02:00:00.000Z");
  });

  it("counts days left, going negative once expired", () => {
    const expiry = new Date("2026-11-15T02:00:00Z");
    expect(daysLeft(expiry, new Date("2026-11-08T02:00:00Z"))).toBe(7);
    expect(daysLeft(expiry, new Date("2026-11-14T20:00:00Z"))).toBe(1);
    expect(daysLeft(expiry, new Date("2026-11-17T02:00:00Z"))).toBe(-2);
  });
});

describe("dashboard summary", () => {
  const now = new Date("2026-10-15T04:00:00Z"); // midday in Manila
  const base = {
    created_at: "2026-10-01T02:00:00Z",
    sacks: 10,
    kilos: 500,
    agreed_price: 1000,
    is_paid: false,
    amount_paid: null,
    stored_at: null,
  };
  const loads: LoadRow[] = [
    { ...base, id: "a", customer_name: "A", service_type: "Package Deal", stage: "Drying", created_at: "2026-10-15T01:00:00Z" },
    { ...base, id: "b", customer_name: "B", service_type: "Milling only", stage: "Stored", stored_at: "2026-09-20T02:00:00Z", is_paid: true, amount_paid: 1000, output_kg: 320 },
    { ...base, id: "c", customer_name: "C", service_type: "Drying only", stage: "Stored", stored_at: "2026-10-10T02:00:00Z", kilos: 800, sacks: 16, output_kg: 1000, keep_percent: 70, disposition: "split", buyout_status: "requested" },
    { ...base, id: "d", customer_name: "D", service_type: "Drying only", stage: "Released" },
  ];

  it("counts active jobs, storage, expiry and money owed", () => {
    expect(summarize(loads, now)).toEqual({
      activeJobs: 1,
      addedToday: 1,
      palayKg: 700, // 70% of 1,000 kg output was kept, not the 800 kg brought in
      palayLots: 1,
      riceKg: 320,
      riceLots: 1,
      expiringSoon: 1, // the rice stored 20 Sep expires 20 Oct: 5 days left
      unpaidTotal: 3000,
      unpaidCount: 3,
      releasedUnpaid: 1,
    });
  });

  it("counts 'expiring soon' with the co-op's own warning days", () => {
    // The rice in storage has 5 days left: inside a 14-day warning, outside a 3-day one.
    expect(summarize(loads, now, undefined, 14).expiringSoon).toBe(1);
    expect(summarize(loads, now, undefined, 3).expiringSoon).toBe(0);
  });

  it("does not count a fee covered by an approved buyout as unpaid", () => {
    const sold: LoadRow = {
      ...base, id: "e", customer_name: "E", service_type: "Milling only", stage: "Released",
      output_kg: 500, keep_percent: 0, disposition: "sell", buyout_status: "approved", price_per_kg: 40,
    };
    const s = summarize([sold], now);
    expect(s.unpaidCount).toBe(0);
    expect(s.releasedUnpaid).toBe(0);
  });

  it("colours expiry red within a week, amber within two, green after", () => {
    expect(expiryTone(-1)).toBe("red");
    expect(expiryTone(7)).toBe("red");
    expect(expiryTone(8)).toBe("amber");
    expect(expiryTone(14)).toBe("amber");
    expect(expiryTone(15)).toBe("green");
    expect(expiryTone(20, 30)).toBe("amber"); // a 30-day warning period
    expect(expiryTone(5, 3)).toBe("green");   // a 3-day warning period
    expect(expiryLabel(0)).toBe("Expired");
    expect(expiryLabel(1)).toBe("1 day left");
  });

  it("makes a short job reference from the id", () => {
    expect(jobRef("af8d1854-ba29-49ad-b813-5618fd3f68b1")).toBe("RPS-AF8D1");
  });
});

describe("keep, sell or split", () => {
  it("turns each choice into the right columns", () => {
    expect(parseDisposition("keep", "")).toEqual({
      ok: true,
      value: { disposition: "keep", keep_percent: 100, buyout_status: "none" },
    });
    expect(parseDisposition("sell", "")).toEqual({
      ok: true,
      value: { disposition: "sell", keep_percent: 0, buyout_status: "requested" },
    });
    expect(parseDisposition("split", "70")).toEqual({
      ok: true,
      value: { disposition: "split", keep_percent: 70, buyout_status: "requested" },
    });
  });

  it("refuses a split that is not 1 to 99 percent", () => {
    expect(parseDisposition("split", "0").ok).toBe(false);
    expect(parseDisposition("split", "100").ok).toBe(false);
    expect(parseDisposition("split", "33.5").ok).toBe(false);
    expect(parseDisposition("maybe", "").ok).toBe(false);
  });
});

describe("settlement", () => {
  const job = {
    agreed_price: 5000,
    is_paid: false,
    amount_paid: null,
    output_kg: 1000,
    keep_percent: 70,
    buyout_status: "approved",
    price_per_kg: 40,
  };

  it("pays the customer the sale value minus the fee", () => {
    // 300 kg sold x 40 = 12,000; minus 5,000 fee = 7,000 payout
    expect(settlement(job)).toEqual({
      keptKg: 700,
      soldKg: 300,
      saleValue: 12000,
      paidCash: 0,
      feeOwed: 5000,
      payout: 7000,
      stillOwes: 0,
    });
  });

  it("makes the customer pay the difference when the fee is bigger", () => {
    const s = settlement({ ...job, keep_percent: 95 }); // 50 kg x 40 = 2,000
    expect(s.payout).toBe(0);
    expect(s.stillOwes).toBe(3000);
  });

  it("does not deduct a fee that was already paid in cash", () => {
    const s = settlement({ ...job, is_paid: true, amount_paid: 5000 });
    expect(s.feeOwed).toBe(0);
    expect(s.payout).toBe(12000);
  });

  it("counts no sale until the buyout is approved", () => {
    const s = settlement({ ...job, buyout_status: "requested" });
    expect(s.saleValue).toBe(0);
    expect(s.stillOwes).toBe(5000);
  });

  it("gives the customer everything when the buyout is declined", () => {
    const s = settlement({ ...job, buyout_status: "declined" });
    expect(s.keptKg).toBe(1000);
    expect(s.soldKg).toBe(0);
    expect(s.saleValue).toBe(0);
  });

  it("keeps everything when nothing was chosen yet", () => {
    const s = settlement({ ...job, keep_percent: null, buyout_status: "none" });
    expect(s.keptKg).toBe(1000);
    expect(s.soldKg).toBe(0);
  });
});

describe("money summary", () => {
  const base = {
    created_at: "2026-10-01T02:00:00Z",
    customer_name: "X",
    sacks: 10,
    kilos: 1000,
    stage: "Ready",
    stored_at: null,
    request_status: "accepted",
  };
  const loads: LoadRow[] = [
    // Paid 3,000 cash, kept everything.
    { ...base, id: "a", service_type: "Drying only", agreed_price: 3000, is_paid: true, amount_paid: 3000 },
    // Sold 300 kg of rice at 40 = 12,000; 5,000 fee deducted; 7,000 paid out.
    {
      ...base, id: "b", service_type: "Package Deal", agreed_price: 5000, is_paid: false, amount_paid: null,
      output_kg: 1000, keep_percent: 70, disposition: "split", buyout_status: "approved",
      price_per_kg: 40, payout_done_at: "2026-10-10T02:00:00Z",
    },
    // Still owes 2,000; a buyout is waiting.
    {
      ...base, id: "c", service_type: "Milling only", agreed_price: 2000, is_paid: false, amount_paid: null,
      output_kg: 500, keep_percent: 0, disposition: "sell", buyout_status: "requested",
    },
    // Rejected requests never count.
    { ...base, id: "d", service_type: "Drying only", agreed_price: 9999, is_paid: false, amount_paid: null, request_status: "rejected" },
  ];

  it("adds up cash, payouts, money owed and co-op stock", () => {
    expect(moneySummary(loads)).toEqual({
      cashReceived: 3000,
      feesCoveredByBuyouts: 5000,
      payoutsMade: 7000,
      payoutsToMake: 0,
      owedByCustomers: 2000,
      stockRiceKg: 300,
      stockPalayKg: 0,
      buyoutsWaiting: 1,
    });
  });
});

describe("cancelling a request", () => {
  it("allows cancelling until the window closes", () => {
    expect(cancelDeadline("2026-10-15T02:00:00Z", 2).toISOString()).toBe("2026-10-15T04:00:00.000Z");
    expect(cancelDeadline("2026-10-15T02:00:00Z", 24).toISOString()).toBe("2026-10-16T02:00:00.000Z");
    expect(withinCancelWindow("2026-10-15T02:00:00Z", 2, new Date("2026-10-15T03:59:00Z"))).toBe(true);
    expect(withinCancelWindow("2026-10-15T02:00:00Z", 2, new Date("2026-10-15T04:00:00Z"))).toBe(false);
  });

  it("tells the customer a cancelled request is cancelled", () => {
    const load = {
      id: "x", created_at: "2026-10-15T02:00:00Z", customer_name: "X", sacks: 1, kilos: 1,
      service_type: "Drying only", stage: "Received", agreed_price: 0, is_paid: false,
      amount_paid: null, stored_at: null, request_status: "cancelled",
    };
    expect(customerStatus(load)).toEqual({ label: "Cancelled", tone: "gray" });
  });
});

describe("customer summary", () => {
  const now = new Date("2026-10-15T04:00:00Z");
  const base = {
    created_at: "2026-10-01T02:00:00Z", customer_name: "Me", sacks: 10, kilos: 1000,
    agreed_price: 1000, is_paid: false, amount_paid: null, stored_at: null, request_status: "accepted",
  };
  const loads: LoadRow[] = [
    { ...base, id: "p", service_type: "Drying only", stage: "Received", request_status: "pending", agreed_price: 0 },
    { ...base, id: "w", service_type: "Package Deal", stage: "Drying" },
    { ...base, id: "r", service_type: "Milling only", stage: "Ready", output_kg: 600 },
    { ...base, id: "s", service_type: "Milling only", stage: "Stored", stored_at: "2026-09-20T02:00:00Z",
      output_kg: 600, disposition: "keep", keep_percent: 100, is_paid: true, amount_paid: 1000 },
    { ...base, id: "b", service_type: "Package Deal", stage: "Released", output_kg: 1000, disposition: "sell",
      keep_percent: 0, buyout_status: "approved", price_per_kg: 40 },
    { ...base, id: "x", service_type: "Drying only", stage: "Received", request_status: "cancelled" },
  ];

  it("counts my jobs by what I need to know", () => {
    expect(customerSummary(loads, now)).toEqual({
      waiting: 1,
      inProgress: 1,
      toChoose: 1,
      stored: 1,
      soonestExpiryDays: 5, // rice stored 20 Sep, 30-day lifeline
      owes: 2000, // the in-progress and ready jobs' fees
      toReceive: 39000, // 1,000 kg x 40 = 40,000 minus the 1,000 fee
    });
  });
});

describe("harvest address", () => {
  it("is needed only for services that harvest", () => {
    expect(needsHarvestAddress("Package Deal")).toBe(true);
    expect(needsHarvestAddress("Harvesting + Drying")).toBe(true);
    expect(needsHarvestAddress("Drying only")).toBe(false);
    expect(needsHarvestAddress("Milling only")).toBe(false);
  });

  it("requires a sensible address for harvesting, ignores it otherwise", () => {
    expect(parseHarvestAddress("Package Deal", "  Purok 3, Brgy. Batad  ")).toEqual({
      ok: true,
      value: "Purok 3, Brgy. Batad",
    });
    expect(parseHarvestAddress("Package Deal", "").ok).toBe(false);
    expect(parseHarvestAddress("Harvesting + Drying", "x".repeat(301)).ok).toBe(false);
    expect(parseHarvestAddress("Drying only", "Purok 3")).toEqual({ ok: true, value: null });
  });
});

describe("counting sacks after harvesting and drying", () => {
  const request = { customer_name: "Mang Tonio", sacks: "", kilos: "", agreed_price: 0 };

  it("lets a harvesting request leave sacks and weight empty", () => {
    const r = parseLoadInput({ ...request, service_type: "Package Deal" });
    expect(r.ok && r.value.sacks).toBe(0);
    expect(r.ok && r.value.kilos).toBe(0);
  });

  it("still requires them when the customer brings the palay", () => {
    expect(parseLoadInput({ ...request, service_type: "Drying only" }).ok).toBe(false);
  });

  it("asks for a new count after harvesting and after drying only", () => {
    expect(countsAfter("Harvesting")).toBe("harvesting");
    expect(countsAfter("Drying")).toBe("drying");
    expect(countsAfter("Milling")).toBeNull();
    expect(countsAfter("Received")).toBeNull();
  });

  it("says 'to be counted' before the harvest, and the count after", () => {
    expect(describeCount({ sacks: 0, kilos: 0, service_type: "Package Deal" })).toBe("To be counted after harvest");
    expect(describeCount({ sacks: 38, kilos: 1850.5, service_type: "Package Deal" })).toBe("38 sacks · 1,850.5 kg");
    expect(describeCount({ sacks: 1, kilos: 50, service_type: "Drying only" })).toBe("1 sack · 50 kg");
  });

  it("checks the recorded count", () => {
    expect(parseCount("38", "1850.5")).toEqual({ ok: true, value: { sacks: 38, kilos: 1850.5 } });
    expect(parseCount("", "10").ok).toBe(false);
    expect(parseCount("3.5", "10").ok).toBe(false);
    expect(parseCount("3", "-1").ok).toBe(false);
  });
});

describe("money statistics", () => {
  const now = new Date("2026-10-15T04:00:00Z");
  const base = {
    customer_name: "X", sacks: 10, kilos: 500, stage: "Ready", stored_at: null,
    request_status: "accepted", is_paid: false, amount_paid: null,
  };
  const loads: LoadRow[] = [
    // October: 5,000 fee, nothing paid yet.
    { ...base, id: "a", created_at: "2026-10-02T02:00:00Z", service_type: "Package Deal", agreed_price: 5000 },
    // September: 3,000 fee paid in cash.
    { ...base, id: "b", created_at: "2026-09-10T02:00:00Z", service_type: "Drying only", agreed_price: 3000, is_paid: true, amount_paid: 3000 },
    // September: 2,000 fee taken out of a 300 kg buyout at 40/kg.
    { ...base, id: "c", created_at: "2026-09-20T02:00:00Z", service_type: "Milling only", agreed_price: 2000,
      output_kg: 1000, keep_percent: 70, disposition: "split", buyout_status: "approved", price_per_kg: 40 },
    // March: outside a 6-month window.
    { ...base, id: "d", created_at: "2026-03-05T02:00:00Z", service_type: "Drying only", agreed_price: 999 },
    // Rejected requests never count.
    { ...base, id: "e", created_at: "2026-10-03T02:00:00Z", service_type: "Drying only", agreed_price: 7777, request_status: "rejected" },
  ];

  it("shows the last six months, oldest first, ending this month", () => {
    const s = moneyStats(loads, "6m", now);
    expect(s.months.map((m) => m.key)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(s.months.at(-1)).toMatchObject({ collected: 0, owed: 5000, jobs: 1 });
    expect(s.months.at(-2)).toMatchObject({ collected: 5000, owed: 0, jobs: 2 });
  });

  it("totals only what is in the range, counting buyout-covered fees as collected", () => {
    const s = moneyStats(loads, "6m", now);
    expect(s.totals).toEqual({
      jobs: 3, fees: 10000, collected: 5000, owed: 5000, boughtKg: 300,
      averageFee: 3333.33, collectedShare: 0.5,
    });
  });

  it("widens to 12 months, or back to the first job", () => {
    expect(moneyStats(loads, "12m", now).months).toHaveLength(12);
    expect(moneyStats(loads, "12m", now).totals.jobs).toBe(4);
    expect(moneyStats(loads, "all", now).months[0].key).toBe("2026-03");
  });

  it("lists every service, most jobs first", () => {
    const s = moneyStats(loads, "6m", now);
    expect(s.byService.map((x) => x.service)).toHaveLength(4);
    expect(s.byService.find((x) => x.service === "Harvesting + Drying")).toEqual({ service: "Harvesting + Drying", jobs: 0, fees: 0 });
  });

  it("treats an unknown range as six months", () => {
    expect(parseStatsRange("nonsense")).toBe("6m");
    expect(parseStatsRange("12m")).toBe("12m");
  });
});
