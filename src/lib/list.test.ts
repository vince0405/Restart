import { describe, expect, it } from "vitest";
import { escapeLike, listHref, pageInfo, pageNumbers, pageRange, parseChoice, parsePage, parseSearch } from "./list";

describe("list helpers", () => {
  it("reads page, search and choices safely", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage(["2"])).toBe(1);
    expect(parseSearch("  Mang Tonio  ")).toBe("Mang Tonio");
    expect(parseSearch("x".repeat(150))).toHaveLength(100);
    expect(parseChoice("ready", ["all", "ready"] as const)).toBe("ready");
    expect(parseChoice("drop table", ["all", "ready"] as const)).toBe("all");
  });

  it("stops search text acting as a wildcard", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("Juan Dela Cruz")).toBe("Juan Dela Cruz");
  });

  it("works out page ranges and the 'showing' line", () => {
    expect(pageRange(1, 15)).toEqual([0, 14]);
    expect(pageRange(3, 15)).toEqual([30, 44]);
    expect(pageInfo(2, 15, 40)).toEqual({ page: 2, pages: 3, first: 16, last: 30 });
    expect(pageInfo(9, 15, 40)).toEqual({ page: 3, pages: 3, first: 31, last: 40 });
    expect(pageInfo(1, 15, 0)).toEqual({ page: 1, pages: 1, first: 0, last: 0 });
  });

  it("shows nearby page buttons", () => {
    expect(pageNumbers(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it("builds short addresses", () => {
    expect(listHref("/loads", { q: "", service: "all", status: "all", page: 1 }, { service: "all", status: "all" })).toBe("/loads");
    expect(listHref("/loads", { q: "juan", service: "Drying only", page: 2 }, { service: "all" })).toBe(
      "/loads?q=juan&service=Drying+only&page=2",
    );
  });
});
