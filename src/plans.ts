import type { WorkoutPlan } from "./model";
import type { Cell } from "./sheet-schema";

export type RemotePlan = WorkoutPlan & { updatedAt: string };
/** Called only after typed sheet validation. Keep inactive rows in the projection. */
export const planOf = (row: Cell[]): RemotePlan => ({
  id: String(row[0]),
  weekday: Number(row[1]),
  type: row[2] as WorkoutPlan["type"],
  title: String(row[3]),
  minMinutes: Number(row[4]),
  maxMinutes: Number(row[5]),
  tutorialUrl: String(row[6] || ""),
  active: row[7] === true,
  updatedAt: String(row[8] || ""),
});
export const samePlan = (
  a: WorkoutPlan | null | undefined,
  b: WorkoutPlan | null | undefined,
) =>
  (!a && !b) ||
  (!!a &&
    !!b &&
    (
      [
        "id",
        "weekday",
        "type",
        "title",
        "minMinutes",
        "maxMinutes",
        "tutorialUrl",
        "active",
      ] as const
    ).every((k) => a[k] === b[k]));
