import { describe, expect, it } from "vitest";
import { formatShort, pesoShort } from "./format";

describe("short numbers (Ticket 37)", () => {
  it("follows the team's examples", () => {
    expect(formatShort(1000)).toBe("1k");
    expect(formatShort(10000)).toBe("10k");
    expect(formatShort(1000000)).toBe("1m");
  });

  it("keeps small numbers and one decimal", () => {
    expect(formatShort(0)).toBe("0");
    expect(formatShort(950)).toBe("950");
    expect(formatShort(1500)).toBe("1.5k");
    expect(formatShort(6230.77)).toBe("6.2k");
    expect(formatShort(2_750_000)).toBe("2.8m");
  });

  it("never shows 1000k", () => {
    expect(formatShort(999_950)).toBe("1m");
    expect(formatShort(999_400)).toBe("999.4k");
  });

  it("adds the peso sign, also for negatives", () => {
    expect(pesoShort(12500)).toBe("₱12.5k");
    expect(pesoShort(-2000)).toBe("-₱2k");
  });
});
