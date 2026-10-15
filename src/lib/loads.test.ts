import { describe, expect, it } from "vitest";
import {
  firstStage,
  nextStage,
  parseAmountPaid,
  parseLoadInput,
  prevStage,
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
