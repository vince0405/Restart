import { describe, expect, it } from "vitest";
import { type CoopRow, coopListHref, parseCoopQuery, searchCoops } from "./admin";

const coop = (i: number, extra: Partial<CoopRow> = {}): CoopRow => ({
  id: `id-${i}`,
  name: `Co-op ${i}`,
  town: i % 2 ? "Batad" : "Iloilo City",
  created_at: "2026-10-15T00:00:00Z",
  chairpersons: i % 3 ? "Maria" : "",
  people: 3,
  ...extra,
});
const coops = Array.from({ length: 25 }, (_, i) => coop(i + 1));

describe("admin co-op list", () => {
  it("reads the address bar safely", () => {
    expect(parseCoopQuery({ q: "  batad ", show: "no-chair", page: "2" })).toEqual({ q: "batad", show: "no-chair", page: 2 });
    expect(parseCoopQuery({ q: ["x"], show: "weird", page: "-3" })).toEqual({ q: "", show: "all", page: 1 });
    expect(parseCoopQuery({ page: "1.5" }).page).toBe(1);
  });

  it("pages ten at a time", () => {
    const r = searchCoops(coops, { q: "", show: "all", page: 3 });
    expect(r.rows.map((c) => c.id)).toEqual(["id-21", "id-22", "id-23", "id-24", "id-25"]);
    expect([r.total, r.page, r.pages]).toEqual([25, 3, 3]);
  });

  it("shows the last page when asked for one past the end", () => {
    expect(searchCoops(coops, { q: "", show: "all", page: 99 }).page).toBe(3);
  });

  it("searches name and town, any case", () => {
    expect(searchCoops(coops, { q: "ILOILO", show: "all", page: 1 }).total).toBe(12);
    expect(searchCoops(coops, { q: "co-op 2", show: "all", page: 1 }).rows.map((c) => c.id)).toEqual([
      "id-2", "id-20", "id-21", "id-22", "id-23", "id-24", "id-25",
    ]);
  });

  it("filters co-ops that still need a Chairperson", () => {
    const r = searchCoops(coops, { q: "", show: "no-chair", page: 1 });
    expect(r.total).toBe(8);
    expect(r.rows.every((c) => c.chairpersons === "")).toBe(true);
  });

  it("has one page even with no matches", () => {
    expect(searchCoops(coops, { q: "nowhere", show: "all", page: 1 })).toEqual({ rows: [], total: 0, page: 1, pages: 1 });
  });

  it("builds short addresses", () => {
    expect(coopListHref({ q: "", show: "all", page: 1 })).toBe("/admin");
    expect(coopListHref({ q: "san jose", show: "no-chair", page: 2 })).toBe("/admin?q=san+jose&show=no-chair&page=2");
  });
});
