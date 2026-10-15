import { describe, expect, it } from "vitest";
import type { LoadRow } from "./loads";
import { isLow, parseSupplyEntry, supplyLevels } from "./supply";

const base = {
  created_at: "2026-10-01T00:00:00Z", customer_name: "X", sacks: 10, kilos: 1000, stage: "Ready",
  agreed_price: 0, is_paid: false, amount_paid: null, stored_at: null, request_status: "accepted",
};

describe("co-op supply (Ticket 37)", () => {
  const loads: LoadRow[] = [
    // Bought 300 kg of rice (30% of 1,000 kg sold).
    { ...base, id: "a", service_type: "Package Deal", output_kg: 1000, keep_percent: 70, disposition: "split", buyout_status: "approved", price_per_kg: 40 },
    // Bought all 500 kg of dried palay.
    { ...base, id: "b", service_type: "Drying only", output_kg: 500, keep_percent: 0, disposition: "sell", buyout_status: "approved", price_per_kg: 20 },
    // A buyout still waiting does not count yet.
    { ...base, id: "c", service_type: "Milling only", output_kg: 800, keep_percent: 0, disposition: "sell", buyout_status: "requested" },
    // 300 kg palay kept as a harvest share.
    { ...base, id: "d", service_type: "Package Deal", stage: "Drying", harvest_fee_in: "palay", harvest_kept_kg: 300 },
    // Rejected requests never count.
    { ...base, id: "e", service_type: "Drying only", output_kg: 900, keep_percent: 0, buyout_status: "approved", request_status: "rejected" },
  ];

  it("adds buyouts, palay harvest shares and hand entries", () => {
    const s = supplyLevels(loads, [
      { product: "rice", kg: 100 },
      { product: "rice", kg: -50 },
      { product: "palay", kg: 25.5 },
    ]);
    expect(s.rice).toEqual({ bought: 300, harvestShare: 0, manual: 50, total: 350 });
    expect(s.palay).toEqual({ bought: 500, harvestShare: 300, manual: 25.5, total: 825.5 });
  });

  it("is low at or below the co-op's level", () => {
    expect(isLow(100, 100)).toBe(true);
    expect(isLow(100.01, 100)).toBe(false);
  });

  it("reads the add / take out form", () => {
    const available = { rice: 350, palay: 825.5 };
    expect(parseSupplyEntry({ product: "rice", direction: "in", kg: "200", note: " bought " }, available)).toEqual({
      ok: true,
      value: { product: "rice", kg: 200, note: "bought" },
    });
    expect(parseSupplyEntry({ product: "palay", direction: "out", kg: "25.5", note: "" }, available)).toEqual({
      ok: true,
      value: { product: "palay", kg: -25.5, note: null },
    });
  });

  it("refuses bad amounts and taking out more than there is", () => {
    const available = { rice: 350, palay: 0 };
    expect(parseSupplyEntry({ product: "corn", direction: "in", kg: "1", note: "" }, available).ok).toBe(false);
    expect(parseSupplyEntry({ product: "rice", direction: "in", kg: "0", note: "" }, available).ok).toBe(false);
    expect(parseSupplyEntry({ product: "rice", direction: "in", kg: "abc", note: "" }, available).ok).toBe(false);
    expect(parseSupplyEntry({ product: "rice", direction: "out", kg: "351", note: "" }, available)).toEqual({
      ok: false,
      error: "supply_too_much",
    });
  });
});
