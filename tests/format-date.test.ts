import { describe, expect, it } from "vitest";
import { formatCommitDate } from "../client/format-date";

describe("formatCommitDate", () => {
  it("keeps hours, minutes and seconds", () => {
    const formatted = formatCommitDate("2026-10-17T16:13:42");

    expect(formatted).toContain("16:13:42");
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it("keeps the seconds in compact mode", () => {
    expect(formatCommitDate("2026-10-17T16:13:42", true)).toContain("16:13:42");
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatCommitDate("not-a-date")).toBe("");
  });
});
