import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarDaysEnding } from "./calendar";
import { healthTrend, weeklyValue, weeklyMissing, trendValue } from "./trends";
import { weeklyActivity } from "./exercise";
import type { Metric, Workout } from "./model";
afterEach(() => vi.unstubAllEnvs());
describe("calendar-aligned health trends", () => {
  it("keeps year/leap-day/DST boundaries independent of device timezone", () => {
    for (const zone of [
      "UTC",
      "Asia/Taipei",
      "America/New_York",
      "Pacific/Honolulu",
    ]) {
      vi.stubEnv("TZ", zone);
      expect(calendarDaysEnding("2027-01-02", 4)).toEqual([
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
      ]);
      expect(calendarDaysEnding("2024-03-01", 3)).toEqual([
        "2024-02-28",
        "2024-02-29",
        "2024-03-01",
      ]);
      expect(calendarDaysEnding("2026-03-09", 3)).toEqual([
        "2026-03-07",
        "2026-03-08",
        "2026-03-09",
      ]);
    }
  });
  it("rejects malformed calendar keys and unbounded ranges", () => {
    for (const date of [
      "2026-02-30",
      "2026-2-3",
      "invalid",
      "2026-11-07T00:00:00Z",
    ])
      expect(() => calendarDaysEnding(date, 7)).toThrow();
    for (const count of [0, -1, 1.5, 367, Infinity])
      expect(() => calendarDaysEnding("2026-11-07", count)).toThrow();
  });
  it("retains calendar gaps and a real zero while excluding old/future/wrong-metric records", () => {
    const data: Metric[] = [
      { id: "future", date: "2027-01-02", steps: 99999 },
      { id: "last", date: "2027-01-01", steps: 1234 },
      { id: "zero", date: "2026-12-30", steps: 0 },
      { id: "other", date: "2026-12-31", weight: 60 },
      { id: "old", date: "2026-12-29", steps: 88888 },
    ];
    const before = structuredClone(data),
      result = healthTrend(data, "2027-01-01", 3, "steps");
    expect(result.rows).toEqual([
      { date: "2026-12-30", value: 0 },
      { date: "2026-12-31", value: null },
      { date: "2027-01-01", value: 1234 },
    ]);
    expect(result.observed).toHaveLength(2);
    expect(result.latest).toEqual(result.rows[2]);
    expect(data).toEqual(before);
    expect(trendValue(0, "步")).toBe("0 步");
    expect(trendValue(null, "步")).toBe("未記錄");
  });
  it("does not move an old measurement into today or invent an empty-range latest value", () => {
    const data = [{ id: "old", date: "2026-11-05", weight: 60 }];
    expect(healthTrend(data, "2026-11-07", 7, "weight").latest?.date).toBe(
      "2026-11-05",
    );
    const result = healthTrend(data, "2026-11-07", 1, "weight");
    expect(result.rows).toEqual([{ date: "2026-11-07", value: null }]);
    expect(result.latest).toBeUndefined();
  });
});
it("distinguishes absent workout/treadmill data from flat recorded incline without changing totals", () => {
  const w: Workout = {
    id: "home",
    date: "2026-12-21",
    type: "home",
    minutes: 30,
    calories: 0,
    note: "",
  };
  const t: Workout = {
    ...w,
    id: "flat",
    date: "2026-12-28",
    type: "walk",
    minutes: 10,
    segments: [{ minutes: 10, speed: 6, incline: 0 }],
  };
  const rows = weeklyActivity(
    [w, t, { ...w, id: "future", date: "2027-01-02" }],
    "2027-01-01",
  );
  expect(rows.at(-1)).toMatchObject({
    workoutCount: 1,
    treadmillCount: 1,
    minutes: 10,
  });
  expect(weeklyValue(rows.at(-1)!, "incline")).toBe(0);
  expect(weeklyValue(rows.at(-1)!, "distance")).toBe(1);
  expect(weeklyValue(rows.at(-2)!, "minutes")).toBe(30);
  expect(weeklyValue(rows.at(-2)!, "distance")).toBeNull();
  expect(weeklyMissing(rows.at(-2)!, "distance")).toBe("無跑步機分段");
  expect(weeklyValue(rows[0], "minutes")).toBeNull();
  expect(weeklyMissing(rows[0], "minutes")).toBe("未記錄運動");
  expect(rows[0].minutes).toBe(0);
});
