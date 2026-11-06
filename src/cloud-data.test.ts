import { describe, expect, it } from "vitest";
import { projectCloudData } from "./cloud-data";
import { HEADERS, TAB_NAMES, type Grids } from "./sheet-schema";
const grids = () =>
  Object.fromEntries(
    TAB_NAMES.map((tab) => [tab, [[...HEADERS[tab]]]]),
  ) as Grids;
const metric = (
  id: string,
  time: string,
  type: string,
  value: number,
  deleted = "",
) => [
  id,
  id,
  time,
  "2026-11-06",
  "Asia/Taipei",
  type,
  value,
  type === "weight" ? "kg" : type === "bodyFat" ? "percent" : "bpm",
  "health",
  "phone",
  time,
  deleted,
];
describe("cloud daily summaries", () => {
  it("takes the last real measurement, independent of row order, and ignores tombstones", () => {
    const g = grids();
    g.HealthMetrics.push(
      metric("late", "2026-11-06T10:00:00Z", "weight", 68.4),
      metric("early", "2026-11-06T00:00:00Z", "weight", 68.9),
      metric(
        "deleted",
        "2026-11-06T11:00:00Z",
        "weight",
        80,
        "2026-11-06T12:00:00Z",
      ),
    );
    expect(projectCloudData(g, "Asia/Taipei").metrics[0].weight).toBe(68.4);
  });
  it("keeps missing metrics absent, uses the daily steps total and labels heart as arithmetic mean", () => {
    const g = grids();
    g.HealthMetrics.push(
      metric("h1", "2026-11-06T00:00:00Z", "heartRate", 60),
      metric("h2", "2026-11-06T01:00:00Z", "heartRate", 80),
    );
    g.DailySteps.push([
      "s",
      "2026-11-06",
      "Asia/Taipei",
      6200,
      "health",
      "phone",
      2,
      "2026-11-06T12:00:00Z",
    ]);
    const result = projectCloudData(g, "Asia/Taipei");
    expect(result.metrics).toEqual([
      {
        id: "cloud-day-2026-11-06",
        date: "2026-11-06",
        heart: 70,
        steps: 6200,
      },
    ]);
    expect(result.metrics[0]).not.toHaveProperty("weight");
  });
  it("rejects a timezone mismatch rather than mixing calendar days", () => {
    const g = grids();
    g.DailySteps.push([
      "s",
      "2026-11-06",
      "UTC",
      100,
      "health",
      "phone",
      1,
      "2026-11-06T12:00:00Z",
    ]);
    expect(() => projectCloudData(g, "Asia/Taipei")).toThrow("timezone");
  });
  it("does not bring deleted workouts back to the UI", () => {
    const g = grids();
    g.WorkoutLogs.push([
      "w",
      "2026-11-06",
      "Asia/Taipei",
      "home",
      30,
      100,
      "",
      "manual",
      2,
      "2026-11-06T12:00:00Z",
      "2026-11-06T12:00:00Z",
    ]);
    expect(projectCloudData(g, "Asia/Taipei").workouts).toEqual([]);
  });
});
