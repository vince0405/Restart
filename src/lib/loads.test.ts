import { describe, expect, it } from "vitest";
import {
  nextStage,
  parseAmountPaid,
  parseLoadInput,
  prevStage,
  type Stage,
} from "./loads";

describe("stage order", () => {
  it("moves forward through every stage and stops at Released", () => {
    expect(nextStage("Received")).toBe("Drying");
    expect(nextStage("Milling")).toBe("Milled");
    expect(nextStage("Milled")).toBe("Released");
    expect(nextStage("Released")).toBeNull();
  });

  it("moves back one stage and stops at Received", () => {
    expect(prevStage("Drying")).toBe("Received");
    expect(prevStage("Released")).toBe("Milled");
    expect(prevStage("Received")).toBeNull();
  });

  it("round-trips a stage", () => {
    for (const stage of ["Drying", "Dried", "Milling", "Milled"] as Stage[]) {
      expect(prevStage(nextStage(stage)!)).toBe(stage);
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
    expect(parseLoadInput({ ...valid, sacks: "" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, sacks: "-1" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, sacks: "1.5" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, sacks: "abc" }).ok).toBe(false);
  });

  it("rejects empty or negative kilos", () => {
    expect(parseLoadInput({ ...valid, kilos: "" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, kilos: "-3" }).ok).toBe(false);
  });

  it("rejects a service type that is not on the list", () => {
    expect(parseLoadInput({ ...valid, service_type: "" }).ok).toBe(false);
    expect(parseLoadInput({ ...valid, service_type: "Harvesting" }).ok).toBe(
      false,
    );
  });

  it("rejects empty or negative price", () => {
    expect(parseLoadInput({ ...valid, agreed_price: "" }).ok).toBe(false);
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
