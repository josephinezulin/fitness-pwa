import { describe, expect, it } from "vitest";
import {
  CATEGORY_WORKOUT,
  estimateEnergy,
  pace,
  segmentErrors,
  TREADMILL_PRESETS,
  weeklyActivity,
  weightForDate,
} from "./exercise";
import { validate, type Workout } from "./model";
import { VIDEO_CATEGORIES } from "./videos";
const record = (date: string, minutes = 30): Workout => ({
  id: date,
  date,
  type: "home",
  minutes,
  calories: 0,
  note: "",
});
describe("recording calculations", () => {
  it("uses grade as a fraction and converts km/h to m/min for walking", () => {
    expect(
      estimateEnergy("walk", 30, 60, [{ minutes: 30, speed: 5, incline: 3 }])
        .calories,
    ).toBe(147);
  });
  it("estimates steady running but does not infer walking gait from a running session's slow speeds", () => {
    expect(
      estimateEnergy("run", 30, 60, [{ minutes: 30, speed: 10, incline: 0 }])
        .calories,
    ).toBe(332);
    expect(
      estimateEnergy("run", 30, 60, [
        { minutes: 10, speed: 4, incline: 0 },
        { minutes: 20, speed: 9, incline: 1 },
      ]).calories,
    ).toBeNull();
  });
  it("does not extrapolate to unsupported speed or grade, or estimate only some segments", () => {
    for (const segment of [
      { minutes: 30, speed: 1, incline: 0 },
      { minutes: 30, speed: 7, incline: 0 },
      { minutes: 30, speed: 5, incline: -1 },
      { minutes: 30, speed: 5, incline: 11 },
    ])
      expect(estimateEnergy("walk", 30, 60, [segment]).calories).toBeNull();
    expect(
      estimateEnergy("run", 30, 60, [
        { minutes: 10, speed: 4, incline: 0 },
        { minutes: 20, speed: 7, incline: 0 },
      ]).calories,
    ).toBeNull();
  });
  it("does not treat rapid intervals as steady-state calorimetry", () => {
    expect(
      estimateEnergy("walk", 30, 60, [
        { minutes: 1, speed: 4, incline: 0 },
        { minutes: 29, speed: 5, incline: 3 },
      ]).calories,
    ).toBeNull();
  });
  it("uses documented MET estimates and avoids guessing ball or other activities", () => {
    expect(estimateEnergy("yoga", 30, 60).calories).toBe(72);
    expect(estimateEnergy("ball", 30, 60).calories).toBeNull();
    expect(estimateEnergy("other", 30, 60).calories).toBeNull();
    for (const weight of [NaN, 0, -1, Infinity, 501])
      expect(estimateEnergy("home", 30, weight).calories).toBeNull();
  });
  it("chooses the latest weight on or before the exercise date", () => {
    const metrics = [
      { id: "old", date: "2026-10-01", weight: 65 },
      { id: "future", date: "2026-12-01", weight: 60 },
      { id: "nearest", date: "2026-11-01", weight: 63 },
      { id: "steps", date: "2026-11-02", steps: 100 },
    ];
    expect(weightForDate(metrics, "2026-11-06")?.weight).toBe(63);
    expect(weightForDate(metrics, "2026-09-01")).toBeUndefined();
  });
  it("formats pace with seconds rollover and no divide-by-zero result", () => {
    expect(pace(10)).toBe("6:00");
    expect(pace(8)).toBe("7:30");
    expect(pace(3600 / 359.6)).toBe("6:00");
    expect(pace(0)).toBeNull();
    expect(pace(NaN)).toBeNull();
  });
  it("provides complete, valid presets without sharing mutable segment references", () => {
    for (const p of TREADMILL_PRESETS) {
      expect(segmentErrors(p.segments)).toEqual([]);
      validate({
        version: 1,
        metrics: [],
        workouts: [
          {
            ...record("2026-11-06"),
            type: p.type,
            minutes: p.segments.reduce((n, s) => n + s.minutes, 0),
            segments: p.segments,
          },
        ],
      });
    }
    expect(new Set(TREADMILL_PRESETS.map((p) => p.id)).size).toBe(
      TREADMILL_PRESETS.length,
    );
    expect(VIDEO_CATEGORIES.every((c) => CATEGORY_WORKOUT[c])).toBe(true);
  });
  it("reports the particular segment and field, including too-short totals", () => {
    const errors = segmentErrors([{ minutes: 0.5, speed: 30, incline: 41 }]);
    expect(errors.some((e) => e.includes("第 1 段速度"))).toBe(true);
    expect(errors.some((e) => e.includes("第 1 段坡度"))).toBe(true);
    expect(errors.some((e) => e.includes("總時間"))).toBe(true);
  });
  it("groups across a year boundary, excludes future records and weights grades by time", () => {
    const treadmill = {
      ...record("2026-12-30"),
      type: "walk" as const,
      minutes: 40,
      segments: [
        { minutes: 10, speed: 4, incline: 0 },
        { minutes: 30, speed: 4, incline: 8 },
      ],
    };
    const rows = weeklyActivity(
      [
        record("2026-12-28"),
        treadmill,
        record("2027-01-03"),
        record("2026-12-21"),
      ],
      "2027-01-01",
    );
    expect(rows).toHaveLength(8);
    expect(rows.at(-1)).toMatchObject({
      week: "2026-12-28",
      minutes: 70,
      distance: 2.67,
      incline: 6,
    });
    expect(rows.at(-2)?.minutes).toBe(30);
    expect(rows.at(-2)?.incline).toBeNull();
  });
});
