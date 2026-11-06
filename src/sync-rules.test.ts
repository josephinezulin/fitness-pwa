import { describe, expect, it } from "vitest";
import {
  mergeSamples,
  mergeSteps,
  planWorkoutChanges,
  type HealthSample,
  type RemoteWorkout,
} from "./sync-rules";
const sample: HealthSample = {
  sampleKey: "uuid-1",
  measuredAt: "2026-11-06T00:00:00Z",
  date: "2026-11-06",
  timezone: "Asia/Taipei",
  metricType: "weight",
  value: 68.5,
  unit: "kg",
  source: "health",
  deviceId: "phone",
};
const steps = {
  date: "2026-11-06",
  timezone: "Asia/Taipei",
  totalSteps: 5000,
  computedAt: "2026-11-06T10:00:00Z",
  source: "health",
  deviceId: "phone",
};
const workout: RemoteWorkout = {
  id: "w1",
  date: "2026-11-06",
  type: "home",
  minutes: 30,
  calories: 100,
  note: "",
  revision: 1,
  updatedAt: "2026-11-06T00:00:00Z",
  deletedAt: "",
};
describe("seven-day overlapping synchronization rules", () => {
  it("re-sending the same samples does not increase record count", () => {
    const once = mergeSamples([], [sample]);
    const again = mergeSamples(once.samples, [sample, sample]);
    expect(again.samples).toHaveLength(1);
    expect(again.duplicates).toBe(2);
  });
  it("keeps separate same-day measurements but refuses conflicting reuse of a sample key", () => {
    expect(
      mergeSamples([sample], [{ ...sample, sampleKey: "uuid-2", value: 68.2 }])
        .samples,
    ).toHaveLength(2);
    expect(() => mergeSamples([sample], [{ ...sample, value: 80 }])).toThrow(
      "不同內容",
    );
  });
  it("updates 5000 to 6200 rather than summing and ignores delayed older retries", () => {
    const newer = {
      ...steps,
      totalSteps: 6200,
      computedAt: "2026-11-06T11:00:00Z",
    };
    const result = mergeSteps([{ ...steps, revision: 1 }], [newer, steps]);
    expect(result.steps[0].totalSteps).toBe(6200);
    expect(result.steps[0].revision).toBe(2);
    expect(result.stale).toBe(1);
    expect(mergeSteps(result.steps, [newer]).steps[0].revision).toBe(2);
  });
  it("accepts a genuine newer correction to a lower total", () => {
    expect(
      mergeSteps(
        [{ ...steps, revision: 1 }],
        [{ ...steps, totalSteps: 4000, computedAt: "2026-11-06T11:00:00Z" }],
      ).steps[0].totalSteps,
    ).toBe(4000);
  });
  it("detects same-time conflicting snapshots instead of taking arrival order", () => {
    expect(() =>
      mergeSteps([{ ...steps, revision: 1 }], [{ ...steps, totalSteps: 99 }]),
    ).toThrow("衝突");
  });
});
describe("workout conflict plans (no network writes)", () => {
  const treadmill: RemoteWorkout = {
    ...workout,
    type: "walk",
    segments: [
      { minutes: 10, speed: 5, incline: 2 },
      { minutes: 20, speed: 6, incline: 5 },
    ],
  };

  it("detects a speed-only edit and preserves independent segment snapshots", () => {
    const edited = {
      ...treadmill,
      segments: treadmill.segments!.map((s) => ({ ...s, speed: s.speed + 1 })),
    };
    const result = planWorkoutChanges([treadmill], [edited], [treadmill]);
    expect(result.conflicts).toEqual([]);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].value?.segments).toEqual(edited.segments);
    edited.segments[0].speed = 20;
    expect(result.changes[0].value?.segments?.[0].speed).toBe(6);
  });

  it("treats reread segment arrays as equal and acknowledges successful retries", () => {
    const reread = {
      ...treadmill,
      revision: 2,
      segments: treadmill.segments!.map((s) => ({ ...s })),
    };
    expect(planWorkoutChanges([treadmill], [reread], [reread])).toEqual({
      changes: [],
      conflicts: [],
    });
  });

  it("protects manual remote incline edits even when revision was unchanged", () => {
    const remote = {
      ...treadmill,
      segments: treadmill.segments!.map((s) => ({ ...s, incline: 8 })),
    };
    expect(
      planWorkoutChanges([treadmill], [{ ...treadmill, note: "local" }], [remote]),
    ).toEqual({ changes: [], conflicts: ["w1"] });
  });

  it("detects adding or removing treadmill details without changing total minutes", () => {
    const { segments: _segments, ...withoutSegments } = treadmill;
    const adding = planWorkoutChanges([withoutSegments], [treadmill], [withoutSegments]);
    expect(adding.changes[0].value?.segments).toEqual(treadmill.segments);
    const removing = planWorkoutChanges([treadmill], [withoutSegments], [treadmill]);
    expect(removing.changes).toHaveLength(1);
    expect(removing.changes[0].value).not.toHaveProperty("segments");
  });

  it("retains segment order when a session is rearranged", () => {
    const edited = { ...treadmill, segments: [...treadmill.segments!].reverse() };
    const result = planWorkoutChanges([treadmill], [edited], [treadmill]);
    expect(result.changes[0].value?.segments?.[0].minutes).toBe(20);
  });

  it("plans an update with the expected revision", () => {
    const result = planWorkoutChanges(
      [workout],
      [{ ...workout, minutes: 40 }],
      [workout],
    );
    expect(result.conflicts).toEqual([]);
    expect(result.changes[0]).toMatchObject({
      kind: "update",
      id: "w1",
      expectedRevision: 1,
    });
  });
  it("does not overwrite a concurrent change or resurrect a remote tombstone", () => {
    expect(
      planWorkoutChanges(
        [workout],
        [{ ...workout, minutes: 40 }],
        [{ ...workout, revision: 2, note: "remote edit" }],
      ).conflicts,
    ).toEqual(["w1"]);
    expect(
      planWorkoutChanges(
        [workout],
        [{ ...workout, minutes: 40 }],
        [{ ...workout, revision: 2, deletedAt: "2026-11-06T12:00:00Z" }],
      ).changes,
    ).toEqual([]);
  });
  it("detects manual edits even if a spreadsheet user forgot to bump revision", () => {
    expect(
      planWorkoutChanges(
        [workout],
        [{ ...workout, minutes: 40 }],
        [{ ...workout, calories: 900 }],
      ).conflicts,
    ).toEqual(["w1"]);
  });
  it("plans deletions explicitly and does not repeat an acknowledged edit", () => {
    expect(planWorkoutChanges([workout], [], [workout]).changes[0].kind).toBe(
      "delete",
    );
    const edited = { ...workout, minutes: 40 };
    expect(
      planWorkoutChanges([workout], [edited], [{ ...edited, revision: 2 }])
        .changes,
    ).toEqual([]);
  });
});
