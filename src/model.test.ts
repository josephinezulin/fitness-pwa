import { describe, it, expect } from "vitest";
import { validate, empty, completed, weekDays, type Workout } from "./model";
const workout: Workout = {
  id: "one",
  date: "2026-11-02",
  type: "home",
  minutes: 30,
  calories: 100,
  note: "",
};
describe("健康紀錄與備份", () => {
  it("正確處理跨年週一至週日", () =>
    expect(weekDays(new Date("2027-01-01T12:00:00"))).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]));
  it("同日同類型才打卡，刪除後取消", () => {
    expect(completed([workout], workout.date, "home")).toBe(true);
    expect(completed([workout], workout.date, "walk")).toBe(false);
    expect(completed([workout], "2026-11-09", "home")).toBe(false);
    expect(completed([], workout.date, "home")).toBe(false);
  });
  it("接受 JSON 往返", () =>
    expect(
      validate(JSON.parse(JSON.stringify({ ...empty, workouts: [workout] })))
        .workouts,
    ).toEqual([workout]));
  it("拒絕無效日期與重複 ID", () => {
    expect(() =>
      validate({ ...empty, workouts: [{ ...workout, date: "2026-02-30" }] }),
    ).toThrow();
    expect(() =>
      validate({ ...empty, workouts: [workout, workout] }),
    ).toThrow();
  });
  it("拒絕超出範圍或字串數值", () => {
    expect(() =>
      validate({
        ...empty,
        metrics: [{ id: "a", date: workout.date, fat: 101 }],
      }),
    ).toThrow();
    expect(() =>
      validate({
        ...empty,
        metrics: [{ id: "a", date: workout.date, steps: "100" }],
      }),
    ).toThrow();
  });
  it("拒絕重複日摘要與空摘要", () => {
    const m = { id: "a", date: workout.date, steps: 100 };
    expect(() =>
      validate({ ...empty, metrics: [m, { ...m, id: "b" }] }),
    ).toThrow();
    expect(() =>
      validate({ ...empty, metrics: [{ id: "a", date: workout.date }] }),
    ).toThrow();
  });
});
import { treadmillSummary, demo } from "./model";
describe("運動類型與跑步機分段", () => {
  const segments = [
    { minutes: 10, speed: 6, incline: 2 },
    { minutes: 20, speed: 9, incline: 5 },
  ];
  const run: Workout = {
    ...workout,
    id: "run",
    type: "run",
    minutes: 30,
    segments,
  };
  it("以時間加權計算總量與平均", () =>
    expect(treadmillSummary(segments)).toEqual({
      minutes: 30,
      distanceKm: 4,
      avgSpeed: 8,
      avgIncline: 4,
      maxSpeed: 9,
      maxIncline: 5,
      elevationM: 170,
    }));
  it("下坡不計入爬升，空分段為零", () => {
    expect(
      treadmillSummary([{ minutes: 60, speed: 5, incline: -2 }]).elevationM,
    ).toBe(0);
    expect(treadmillSummary([]).avgSpeed).toBe(0);
  });
  it("分段資料可 JSON 往返，舊紀錄不需分段", () => {
    const back = validate(
      JSON.parse(JSON.stringify({ ...empty, workouts: [run, workout] })),
    );
    expect(back.workouts).toEqual([run, workout]);
    expect("segments" in back.workouts[1]).toBe(false);
  });
  it("接受新增的常見運動類型，拒絕未知類型", () => {
    for (const type of [
      "strength",
      "yoga",
      "pilates",
      "cycling",
      "swim",
      "hike",
      "jumprope",
      "ball",
      "stretch",
    ])
      expect(() =>
        validate({ ...empty, workouts: [{ ...workout, type }] }),
      ).not.toThrow();
    expect(() =>
      validate({ ...empty, workouts: [{ ...workout, type: "dance" }] }),
    ).toThrow();
  });
  it("拒絕分鐘數與分段不符、非跑步機類型或超範圍", () => {
    expect(() =>
      validate({ ...empty, workouts: [{ ...run, minutes: 25 }] }),
    ).toThrow();
    expect(() =>
      validate({ ...empty, workouts: [{ ...run, type: "yoga" }] }),
    ).toThrow();
    expect(() =>
      validate({
        ...empty,
        workouts: [
          {
            ...run,
            minutes: 10,
            segments: [{ minutes: 10, speed: 40, incline: 0 }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      validate({ ...empty, workouts: [{ ...run, segments: [] }] }),
    ).toThrow();
  });
  it("示範資料通過驗證並含跑步機範例", () =>
    expect(validate(demo()).workouts.some((w) => w.segments)).toBe(true));
});
