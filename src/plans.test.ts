import { describe, expect, it } from "vitest";
import {
  defaultPlans,
  empty,
  validate,
  validatePlans,
  workoutPlans,
} from "./model";
import { makeBackup, parseBackup } from "./backup";
import { projectCloudData } from "./cloud-data";
import { testSource } from "./test-fixtures";
import { validateGrids } from "./sheet-schema";

describe("custom weekly plans and legacy data", () => {
  it("defaults only missing legacy plans, retaining empty and fully disabled plans", () => {
    expect(workoutPlans(validate(empty))).toHaveLength(3);
    expect(workoutPlans(validate({ ...empty, plans: [] }))).toEqual([]);
    const disabled = defaultPlans.map((p) => ({ ...p, active: false }));
    const restored = parseBackup(
      makeBackup({ ...empty, plans: disabled }),
    ).data;
    expect(workoutPlans(restored)).toEqual(disabled);
    expect(workoutPlans(restored).filter((p) => p.active)).toEqual([]);
    const copy = workoutPlans(empty);
    copy[0].active = false;
    expect(workoutPlans(empty)[0].active).toBe(true);
  });
  it("rejects ambiguous active slots, allowing distinct types and inactive duplicates", () => {
    const p = defaultPlans[0];
    expect(() => validatePlans([p, { ...p, id: "another" }])).toThrow("同一天");
    expect(
      validatePlans([p, { ...p, id: "another", type: "yoga" }]),
    ).toHaveLength(2);
    expect(
      validatePlans([p, { ...p, id: "another", active: false }]),
    ).toHaveLength(2);
    expect(() => validatePlans([p, p])).toThrow();
  });
  it("keeps only supported plan fields and rejects unsafe URLs and ranges", () => {
    const p = defaultPlans[0];
    expect(
      validatePlans([{ ...p, accessToken: "discard-me" }])[0],
    ).not.toHaveProperty("accessToken");
    for (const fields of [
      { weekday: 0 },
      { weekday: 2.5 },
      { minMinutes: 40, maxMinutes: 20 },
      { title: " " },
      { active: "TRUE" },
      { tutorialUrl: "javascript:alert(1)" },
      { tutorialUrl: "https://youtube.com.evil.example/watch?v=12345678901" },
      { tutorialUrl: "https://user:secret@youtube.com/watch?v=12345678901" },
    ])
      expect(() => validatePlans([{ ...p, ...fields }])).toThrow();
    expect(
      validatePlans([{ ...p, tutorialUrl: "https://youtu.be/v7AYKMP6rOE" }]),
    ).toHaveLength(1);
  });
  it("projects actual sheet plans including disabled rows, and accepts an empty sheet", () => {
    const source = testSource();
    source.grids.WorkoutPlans[1][7] = false;
    source.grids.WorkoutPlans[2][1] = 4;
    expect(validateGrids(source.grids).ok).toBe(true);
    const result = projectCloudData(source.grids, "Asia/Taipei");
    expect(result.plans?.[0].active).toBe(false);
    expect(result.plans?.[1].weekday).toBe(4);
    source.grids.WorkoutPlans.length = 1;
    expect(validateGrids(source.grids).ok).toBe(true);
    expect(projectCloudData(source.grids, "Asia/Taipei").plans).toEqual([]);
  });
  it("rejects duplicate active slots in the native schema without requiring default plans", () => {
    const source = testSource();
    source.grids.WorkoutPlans.push([...source.grids.WorkoutPlans[1]]);
    source.grids.WorkoutPlans[4][0] = "another";
    expect(
      validateGrids(source.grids).errors.some((e) => e.includes("同一天")),
    ).toBe(true);
    source.grids.WorkoutPlans[4][7] = false;
    expect(validateGrids(source.grids).ok).toBe(true);
  });
});
