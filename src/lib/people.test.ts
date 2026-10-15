import { describe, expect, it } from "vitest";
import { matchesPerson } from "./people";

const maria = { full_name: "Maria Dela Cruz", phone: "+639171234567" };

describe("searching people (Ticket 37)", () => {
  it("finds by any part of the name, any case", () => {
    expect(matchesPerson(maria, "dela")).toBe(true);
    expect(matchesPerson(maria, "MARIA")).toBe(true);
    expect(matchesPerson(maria, "juan")).toBe(false);
  });

  it("finds by mobile number however it is typed", () => {
    expect(matchesPerson(maria, "0917 123")).toBe(true);
    expect(matchesPerson(maria, "+63 917 123 4567")).toBe(true);
    expect(matchesPerson(maria, "4567")).toBe(true);
    expect(matchesPerson(maria, "0918")).toBe(false);
  });

  it("ignores too-short number searches and shows everyone for an empty one", () => {
    expect(matchesPerson(maria, "09")).toBe(false);
    expect(matchesPerson(maria, "  ")).toBe(true);
    expect(matchesPerson({ full_name: "No Phone", phone: "" }, "0917")).toBe(false);
  });
});
