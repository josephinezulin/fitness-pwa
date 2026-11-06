import type { Workout } from "./model";

export type HealthSample = {
  sampleKey: string;
  measuredAt: string;
  date: string;
  timezone: string;
  metricType: "weight" | "bodyFat" | "heartRate";
  value: number;
  unit: "kg" | "percent" | "bpm";
  source: string;
  deviceId: string;
};
const sampleFields = [
  "sampleKey",
  "measuredAt",
  "date",
  "timezone",
  "metricType",
  "value",
  "unit",
  "source",
  "deviceId",
] as const;
/** Inputs must first pass the shared schema validator. Same-day measurements remain distinct. */
export function mergeSamples(
  existing: HealthSample[],
  incoming: HealthSample[],
) {
  const byKey = new Map<string, HealthSample>();
  let duplicates = 0;
  for (const row of [...existing, ...incoming]) {
    if (!row.sampleKey) throw Error("健康樣本缺少穩定識別碼。");
    const old = byKey.get(row.sampleKey);
    if (old) {
      if (sampleFields.some((field) => old[field] !== row[field]))
        throw Error("相同樣本識別碼對應不同內容，停止同步以免覆蓋資料。");
      duplicates++;
    } else byKey.set(row.sampleKey, { ...row });
  }
  return { samples: [...byKey.values()], duplicates };
}
export type StepSnapshot = {
  date: string;
  timezone: string;
  totalSteps: number;
  computedAt: string;
  source: string;
  deviceId: string;
};
export type VersionedSteps = StepSnapshot & { revision: number };
/** Compare snapshot time, not arrival order; a delayed retry cannot roll steps backward. */
export function mergeSteps(
  existing: VersionedSteps[],
  incoming: StepSnapshot[],
) {
  const byDay = new Map<string, VersionedSteps>();
  const key = (row: StepSnapshot) => JSON.stringify([row.timezone, row.date]);
  let stale = 0,
    duplicates = 0;
  for (const row of existing) {
    if (byDay.has(key(row))) throw Error("現有每日步數含重複日期，需先修復。");
    byDay.set(key(row), { ...row });
  }
  for (const row of incoming) {
    if (
      !Number.isInteger(row.totalSteps) ||
      row.totalSteps < 0 ||
      row.totalSteps > 200000 ||
      !Number.isFinite(Date.parse(row.computedAt))
    )
      throw Error("步數或快照時間不符規格。");
    const old = byDay.get(key(row));
    if (old) {
      const difference =
        Date.parse(row.computedAt) - Date.parse(old.computedAt);
      if (difference < 0) {
        stale++;
        continue;
      }
      if (difference === 0) {
        if (
          old.totalSteps !== row.totalSteps ||
          old.source !== row.source ||
          old.deviceId !== row.deviceId
        )
          throw Error("同時間的步數快照內容衝突，停止同步。");
        duplicates++;
        continue;
      }
    }
    // Newer totals may decrease if Health corrected its data. Never add to the old total.
    byDay.set(key(row), { ...row, revision: (old?.revision || 0) + 1 });
  }
  return { steps: [...byDay.values()], stale, duplicates };
}
export type RemoteWorkout = Workout & {
  revision: number;
  updatedAt: string;
  deletedAt: string;
};
export type WorkoutChange = {
  id: string;
  expectedRevision: number | null;
  kind: "create" | "update" | "delete";
  value?: Workout;
};
const workoutFields = [
  "id",
  "date",
  "type",
  "minutes",
  "calories",
  "note",
] as const;
const same = (a: Workout | undefined, b: Workout | undefined) =>
  (!a && !b) ||
  (!!a &&
    !!b &&
    workoutFields.every((field) => a[field] === b[field]) &&
    a.segments?.length === b.segments?.length &&
    (a.segments || []).every((segment, index) => {
      const other = b.segments![index];
      return (
        segment.minutes === other.minutes &&
        segment.speed === other.speed &&
        segment.incline === other.incline
      );
    }));
function unique<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (map.has(row.id)) throw Error("運動紀錄 ID 重複。");
    map.set(row.id, row);
  }
  return map;
}
/**
 * Pure plan only. The writer must read fresh revisions before applying it.
 * A preflight comparison does not provide a cross-device atomic revision lock.
 */
export function planWorkoutChanges(
  base: RemoteWorkout[],
  local: Workout[],
  remote: RemoteWorkout[],
) {
  const before = unique(base),
    after = unique(local),
    current = unique(remote);
  const changes: WorkoutChange[] = [],
    conflicts: string[] = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const original = before.get(id),
      edit = after.get(id),
      server = current.get(id);
    const originalActive = original?.deletedAt ? undefined : original;
    const serverActive = server?.deletedAt ? undefined : server;
    if (same(originalActive, edit) || same(serverActive, edit)) continue;
    const remoteChanged = original
      ? !server ||
        original.revision !== server.revision ||
        original.deletedAt !== server.deletedAt ||
        !same(original, server)
      : !!server;
    if (remoteChanged || (original?.deletedAt && edit)) {
      conflicts.push(id);
      continue;
    }
    changes.push({
      id,
      expectedRevision: server?.revision ?? null,
      kind: !edit ? "delete" : original ? "update" : "create",
      ...(edit
        ? {
            value: {
              ...Object.fromEntries(
                workoutFields.map((field) => [field, edit[field]]),
              ),
              ...(edit.segments
                ? {
                    segments: edit.segments.map(({ minutes, speed, incline }) => ({
                      minutes,
                      speed,
                      incline,
                    })),
                  }
                : {}),
            } as Workout,
          }
        : {}),
    });
  }
  return { changes, conflicts };
}
