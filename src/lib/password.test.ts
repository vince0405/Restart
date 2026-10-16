import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("password rule", () => {
  it("accepts passwords with 8+ characters, letters and numbers", () => {
    for (const pw of ["sakahan2024", "Ani-ng-palay7", "tubig 9 ulan", "x7k2m9q4"]) {
      expect(passwordProblem(pw)).toBeNull();
    }
  });

  it("refuses short passwords", () => {
    expect(passwordProblem("abc1234")).toBe("too short");
    expect(passwordProblem("")).toBe("too short");
  });

  it("refuses all-number and all-letter passwords", () => {
    expect(passwordProblem("12345678")).toBe("needs letters and numbers");
    expect(passwordProblem("09171234567")).toBe("needs letters and numbers");
    expect(passwordProblem("password")).toBe("needs letters and numbers");
  });

  it("refuses well-known passwords, whatever the capitals", () => {
    expect(passwordProblem("password1")).toBe("too common");
    expect(passwordProblem("Password123")).toBe("too common");
    expect(passwordProblem("RPS12345")).toBe("too common");
  });

  it("refuses the person's own mobile number inside the password", () => {
    expect(passwordProblem("a9171234567", "+639171234567")).toBe("contains the mobile number");
    expect(passwordProblem("juan0917-123-4567", "+639171234567")).toBe("contains the mobile number");
    expect(passwordProblem("a9171234567", "+639180000000")).toBeNull();
  });
});
