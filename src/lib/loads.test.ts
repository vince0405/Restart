import { describe, expect, it } from "vitest";
import {
  daysLeft,
  expiryDate,
  firstStage,
  nextStage,
  parseAmountPaid,
  parseLoadInput,
  prevStage,
  productFor,
  SERVICE_TYPES,
  stepsFor,
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

  it("keeps rice 1 month and palay 3 months", () => {
    const stored = new Date("2026-10-15T02:00:00Z");
    expect(expiryDate(stored, "Milling only").toISOString()).toBe(
      "2026-11-15T02:00:00.000Z",
    );
    expect(expiryDate(stored, "Drying only").toISOString()).toBe(
      "2027-01-15T02:00:00.000Z",
    );
  });

  it("does not spill into the next month at the end of a month", () => {
    const stored = new Date("2027-01-31T02:00:00Z");
    expect(expiryDate(stored, "Package Deal").toISOString()).toBe(
      "2027-02-28T02:00:00.000Z",
    );
    const palay = new Date("2026-11-30T02:00:00Z");
    expect(expiryDate(palay, "Drying only").toISOString()).toBe(
      "2027-02-28T02:00:00.000Z",
    );
  });

  it("counts days left, going negative once expired", () => {
    const expiry = new Date("2026-11-15T02:00:00Z");
    expect(daysLeft(expiry, new Date("2026-11-08T02:00:00Z"))).toBe(7);
    expect(daysLeft(expiry, new Date("2026-11-14T20:00:00Z"))).toBe(1);
    expect(daysLeft(expiry, new Date("2026-11-17T02:00:00Z"))).toBe(-2);
  });
});
