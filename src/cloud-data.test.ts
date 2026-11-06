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

describe("cloud treadmill segments and videos", () => {
  it("attaches active segments in seq order and exposes the precise total", () => {
    const g = grids();
    g.WorkoutLogs.push(
      [
        "w1",
        "2026-11-05",
        "Asia/Taipei",
        "walk",
        31,
        0,
        "",
        "pwa",
        1,
        "2026-11-05T00:00:00Z",
        "",
      ],
      [
        "w2",
        "2026-11-05",
        "Asia/Taipei",
        "home",
        20,
        0,
        "",
        "pwa",
        1,
        "2026-11-05T00:00:00Z",
        "",
      ],
    );
    g.TreadmillSegments = [
      [...HEADERS.TreadmillSegments],
      ["s2", "w1", 2, 25.5, 5.5, 8, "", ""],
      ["s1", "w1", 1, 5, 4.5, 1, "", ""],
      ["gone", "w1", 3, 10, 5, 0, "", "2026-11-05T00:00:00Z"],
    ];
    g.Videos = [
      [...HEADERS.Videos],
      [
        "v1",
        "https://www.youtube.com/watch?v=v7AYKMP6rOE",
        " 新手瑜伽 ",
        "瑜伽",
        20,
        "",
        "",
      ],
      ["v2", "abcdefghijk", "已刪除", "其他", "", "", "2026-11-05T00:00:00Z"],
    ];
    const data = projectCloudData(g, "Asia/Taipei");
    const walk = data.workouts.find((w) => w.id === "w1")!;
    expect(walk.minutes).toBe(30.5);
    expect(walk.segments).toEqual([
      { minutes: 5, speed: 4.5, incline: 1 },
      { minutes: 25.5, speed: 5.5, incline: 8 },
    ]);
    expect(data.workouts.find((w) => w.id === "w2")!.segments).toBeUndefined();
    expect(data.videos).toEqual([
      {
        id: "v1",
        youtubeId: "v7AYKMP6rOE",
        title: "新手瑜伽",
        category: "瑜伽",
        minutes: 20,
      },
    ]);
  });
  it("leaves videos undefined when the spreadsheet has no Videos tab", () =>
    expect(projectCloudData(grids(), "Asia/Taipei").videos).toBeUndefined());
});
