import { describe, expect, it } from "vitest";
import { currentFilingWindow } from "@/features/dashboard/domain/filing-calendar";

describe("currentFilingWindow", () => {
  it("after the 11th, this month's return is open, due the 11th of next month", () => {
    expect(currentFilingWindow(new Date("2026-10-22T06:00:00Z"))).toEqual({
      period: "102026",
      periodLabel: "October 2026",
      dueLabel: "11 Nov 2026",
      daysLeft: 20,
    });
  });

  it("up to the 11th, last month's return is still open", () => {
    const w = currentFilingWindow(new Date("2026-11-05T06:00:00Z"));
    expect(w.periodLabel).toBe("October 2026");
    expect(w.daysLeft).toBe(6);
  });

  it("on the due date itself, the return is due today", () => {
    expect(currentFilingWindow(new Date("2026-11-11T06:00:00Z")).daysLeft).toBe(0);
  });

  it("rolls over the year", () => {
    const w = currentFilingWindow(new Date("2027-01-03T06:00:00Z"));
    expect(w).toMatchObject({
      period: "122026",
      periodLabel: "December 2026",
      dueLabel: "11 Jan 2027",
    });
  });

  it("uses India time: 11 Nov 20:00 UTC is already 12 Nov in India", () => {
    expect(currentFilingWindow(new Date("2026-11-11T20:00:00Z")).periodLabel).toBe("November 2026");
  });
});
