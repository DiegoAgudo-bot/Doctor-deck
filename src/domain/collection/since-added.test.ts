import { describe, expect, it } from "vitest";
import { dayLabel, sinceAddedTrend } from "./since-added";

describe("sinceAddedTrend", () => {
  it("sube, baja o se queda igual, con el mes desde el que se cuenta", () => {
    expect(sinceAddedTrend({ paid: 1, now: 1.5, since: "2025-11-14" })).toMatchObject({
      tone: "up",
      arrow: "▲",
      percent: "+50 %",
      month: "nov 2025",
      day: "14 nov 2025",
      diff: 0.5,
    });
    expect(sinceAddedTrend({ paid: 10, now: 9.65, since: "2026-09-01" })).toMatchObject({
      tone: "down",
      percent: "−3,5 %",
      diff: -0.35,
    });
    expect(sinceAddedTrend({ paid: 100, now: 100.2, since: "2026-01-05" })).toMatchObject({
      tone: "flat",
      arrow: "=",
      percent: "0 %",
    });
  });

  it("sin precio de entonces, nada", () => {
    expect(sinceAddedTrend(null)).toBeNull();
    expect(sinceAddedTrend({ paid: 0, now: 2, since: "2026-01-05" })).toBeNull();
  });

  it("fecha legible", () => {
    expect(dayLabel("2026-09-03")).toBe("3 sept 2026");
  });
});
