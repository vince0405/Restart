import { describe, expect, it } from "vitest";
import type { LoadRow } from "./loads";
import { matchesMyTransaction, myGroup } from "./my-transactions";

const base: LoadRow = {
  id: "ab12c345-0000-0000-0000-000000000000",
  created_at: "2026-10-01T00:00:00Z",
  customer_name: "Maria Santos",
  sacks: 10,
  kilos: 500,
  service_type: "Drying only",
  stage: "Drying",
  agreed_price: 9000,
  is_paid: false,
  amount_paid: null,
  stored_at: null,
  request_status: "accepted",
};

describe("my transactions: tabs", () => {
  it("puts each transaction in the same group as the tiles", () => {
    expect(myGroup({ ...base, request_status: "pending" })).toBe("waiting");
    expect(myGroup({ ...base, request_status: "rejected" })).toBe("closed");
    expect(myGroup({ ...base, request_status: "cancelled" })).toBe("closed");
    expect(myGroup(base)).toBe("in_progress");
    expect(myGroup({ ...base, stage: "Ready", output_kg: 450 })).toBe("to_choose");
    expect(myGroup({ ...base, stage: "Ready", output_kg: 450, disposition: "keep" })).toBe("in_progress");
    expect(myGroup({ ...base, stage: "Ready", output_kg: null })).toBe("in_progress");
    expect(myGroup({ ...base, stage: "Stored" })).toBe("stored");
    expect(myGroup({ ...base, stage: "Released" })).toBe("completed");
  });
});

describe("my transactions: search", () => {
  it("shows everything for an empty search", () => {
    expect(matchesMyTransaction(base, " ")).toBe(true);
  });

  it("finds by the reference, with or without RPS- and #", () => {
    expect(matchesMyTransaction(base, "RPS-AB12C")).toBe(true);
    expect(matchesMyTransaction(base, "#ab12")).toBe(true);
    expect(matchesMyTransaction(base, "zz99")).toBe(false);
  });

  it("finds by service, step or status, any case", () => {
    expect(matchesMyTransaction(base, "drying only")).toBe(true);
    expect(matchesMyTransaction(base, "DRYING")).toBe(true);
    expect(matchesMyTransaction({ ...base, stage: "Stored" }, "stored")).toBe(true);
    expect(matchesMyTransaction(base, "milling")).toBe(false);
  });

  it("finds by the co-op's reason for not accepting", () => {
    const rejected = { ...base, request_status: "rejected", reject_reason: "Dryer fully booked" };
    expect(matchesMyTransaction(rejected, "booked")).toBe(true);
  });
});
