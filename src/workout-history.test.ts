import { describe, expect, it } from "vitest";
import { emptyWorkoutFilters, workoutHistory } from "./workout-history";
import type { Workout } from "./model";

const records: Workout[] = [
  {
    id: "old",
    date: "2026-10-31",
    type: "walk",
    minutes: 10,
    calories: 5,
    note: "虛構河濱",
  },
  {
    id: "first",
    date: "2026-11-01",
    type: "walk",
    minutes: 10.5,
    calories: 0,
    note: "虛構健身房 A",
    segments: [{ minutes: 10.5, speed: 4, incline: 1 }],
  },
  {
    id: "last",
    date: "2026-11-07",
    type: "walk",
    minutes: 20,
    calories: 80,
    note: "虛構健身房 B",
    segments: [{ minutes: 20, speed: 5, incline: 3 }],
  },
  {
    id: "same-day",
    date: "2026-11-07",
    type: "yoga",
    minutes: 15,
    calories: 30,
    note: "虛構 Yoga Ａ .*",
  },
  {
    id: "future",
    date: "2026-11-08",
    type: "walk",
    minutes: 5,
    calories: 10,
    note: "虛構河濱",
  },
];
describe("workout history views", () => {
  it("combines inclusive calendar boundaries, type and keyword without mutating source records", () => {
    const original = structuredClone(records);
    const result = workoutHistory(records, {
      query: "健身房 跑步機",
      type: "walk",
      from: "2026-11-01",
      to: "2026-11-07",
    });
    expect(result.error).toBe("");
    expect(result.rows.map((row) => row.id)).toEqual(["last", "first"]);
    expect(result.minutes).toBe(30.5);
    expect(result.calories).toBe(80);
    expect(result.rows[0]).toBe(records[2]);
    expect(records).toEqual(original);
  });
  it("searches literal keywords, normalized notes, type labels, dates and treadmill metadata", () => {
    for (const [query, expected] of [
      ["  YOGA a  ", ["same-day"]],
      [".*", ["same-day"]],
      ["瑜伽", ["same-day"]],
      ["２０２６-１１-０１", ["first"]],
      ["跑步機", ["last", "first"]],
      ["河濱", ["future", "old"]],
    ] as const) {
      expect(
        workoutHistory(records, { ...emptyWorkoutFilters, query }).rows.map(
          (row) => row.id,
        ),
      ).toEqual(expected);
    }
  });
  it("supports either open boundary and includes all dates with stable same-day ordering", () => {
    expect(
      workoutHistory(records, emptyWorkoutFilters).rows.map((row) => row.id),
    ).toEqual(["future", "last", "same-day", "first", "old"]);
    expect(
      workoutHistory(records, { ...emptyWorkoutFilters, from: "2026-11-07" })
        .rows,
    ).toHaveLength(3);
    expect(
      workoutHistory(records, { ...emptyWorkoutFilters, to: "2026-11-01" })
        .rows,
    ).toHaveLength(2);
    expect(
      workoutHistory(records, {
        ...emptyWorkoutFilters,
        from: "2026-11-07",
        to: "2026-11-07",
      }).rows,
    ).toHaveLength(2);
  });
  it.each(["2026-02-30", "2026-11-7", "not-a-date"])(
    "rejects invalid date %s without discarding stored history",
    (from) => {
      const result = workoutHistory(records, { ...emptyWorkoutFilters, from });
      expect(result.error).toContain("有效");
      expect(result.rows).toEqual([]);
      expect(result.minutes).toBe(0);
      expect(records).toHaveLength(5);
    },
  );
  it("explains reversed boundaries and returns a valid empty view for unmatched filters", () => {
    expect(
      workoutHistory(records, {
        ...emptyWorkoutFilters,
        from: "2026-11-07",
        to: "2026-11-01",
      }).error,
    ).toContain("不能晚於");
    expect(
      workoutHistory(records, { ...emptyWorkoutFilters, type: "cycling" }),
    ).toMatchObject({ rows: [], error: "", minutes: 0, calories: 0 });
    expect(workoutHistory([], emptyWorkoutFilters).rows).toEqual([]);
  });
});
