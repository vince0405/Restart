import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

// A fake table of n rows that answers .range(from, to) like Supabase.
const table = (n: number) => (from: number, to: number) =>
  Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(to, n - 1) - from + 1) }, (_, i) => from + i), error: null });

describe("fetching every row past Supabase's 1,000-row limit (Ticket 42)", () => {
  it("collects all pages", async () => {
    expect((await fetchAll(table(2500), 1000)).data).toHaveLength(2500);
    expect((await fetchAll(table(1000), 1000)).data).toHaveLength(1000);
    expect((await fetchAll(table(0), 1000)).data).toHaveLength(0);
  });

  it("stops and reports an error", async () => {
    const r = await fetchAll(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    expect(r.error?.message).toBe("boom");
  });
});
