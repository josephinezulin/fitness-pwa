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
