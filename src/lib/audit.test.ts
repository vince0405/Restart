import { describe, expect, it } from "vitest";
import { describeChanges, fieldLabel, formatValue } from "./audit";

describe("history of changes", () => {
  it("turns a change into readable lines", () => {
    const lines = describeChanges({
      changes: {
        stage: { from: "Drying", to: "Milling" },
        agreed_price: { from: 27000, to: 38400 },
        is_paid: { from: false, to: true },
      },
    });
    expect(lines).toEqual([
      { field: "Fee", from: "27000", to: "38400" },
      { field: "Paid", from: "no", to: "yes" },
      { field: "Stage", from: "Drying", to: "Milling" },
    ]);
  });

  it("shows empty values as a dash and hides bookkeeping columns", () => {
    const lines = describeChanges({
      changes: {
        reject_reason: { from: null, to: "Dryer full" },
        created_at: { to: "2026-10-15T01:00:00Z" },
      },
    });
    expect(lines).toEqual([{ field: "Reject reason", from: "—", to: "Dryer full" }]);
  });

  it("has a fallback label for a column it does not know", () => {
    expect(fieldLabel("new_column")).toBe("new column");
    expect(formatValue(undefined)).toBe("—");
  });
});
