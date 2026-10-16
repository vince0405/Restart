import { describe, expect, it } from "vitest";
import { matchesRequest } from "./requests";

const request = {
  id: "ab12c345-0000-0000-0000-000000000000",
  customer_name: "Juan Santos",
  contact_phone: "+639181112222",
  harvest_address: "Purok 3, Brgy. San Isidro",
  customer_note: "Please come early",
  customer: { full_name: "Maria Santos", phone: "+639171234567" },
};

describe("searching requests", () => {
  it("shows everything for an empty search", () => {
    expect(matchesRequest(request, "  ")).toBe(true);
  });

  it("finds by the name on the request or the account's name", () => {
    expect(matchesRequest(request, "juan")).toBe(true);
    expect(matchesRequest(request, "MARIA")).toBe(true);
    expect(matchesRequest(request, "pedro")).toBe(false);
  });

  it("finds by either mobile number, however it is typed", () => {
    expect(matchesRequest(request, "0918 111")).toBe(true);
    expect(matchesRequest(request, "09171234567")).toBe(true);
  });

  it("finds by the reference, with or without RPS- and #", () => {
    expect(matchesRequest(request, "RPS-AB12C")).toBe(true);
    expect(matchesRequest(request, "#rps-ab1")).toBe(true);
    expect(matchesRequest(request, "ab12c")).toBe(true);
    expect(matchesRequest(request, "zz9")).toBe(false);
  });

  it("finds by farm address or note", () => {
    expect(matchesRequest(request, "san isidro")).toBe(true);
    expect(matchesRequest(request, "early")).toBe(true);
  });

  it("copes with a request that has no account, address or note", () => {
    const walkIn = { ...request, contact_phone: null, harvest_address: null, customer_note: null, customer: null };
    expect(matchesRequest(walkIn, "juan")).toBe(true);
    expect(matchesRequest(walkIn, "early")).toBe(false);
  });
});
