import { calendarDaysEnding } from "./calendar";
import type { Metric } from "./model";
import type { weeklyActivity } from "./exercise";

export const HEALTH_SERIES = {
  weight: { label: "體重", unit: "kg" },
  fat: { label: "體脂率", unit: "%" },
  heart: { label: "心率", unit: "bpm" },
  steps: { label: "步數", unit: "步" },
} as const;
export type HealthField = keyof typeof HEALTH_SERIES;
export const WEEKLY_SERIES = {
  minutes: { label: "運動分鐘", unit: "分鐘" },
  distance: { label: "跑步機距離", unit: "km" },
  incline: { label: "平均坡度", unit: "%" },
} as const;
export type WeeklyField = keyof typeof WEEKLY_SERIES;
export type WeeklyRow = ReturnType<typeof weeklyActivity>[number];

/** The domain already guarantees one summary per day. Missing days stay explicit nulls. */
export function healthTrend(
  metrics: Metric[],
  reference: string,
  count: number,
  field: HealthField,
) {
  const days = new Map(metrics.map((m) => [m.date, m]));
  const rows = calendarDaysEnding(reference, count).map((date) => ({
    date,
    value: days.get(date)?.[field] ?? null,
  }));
  const observed = rows.filter(
    (r): r is { date: string; value: number } => r.value !== null,
  );
  return { rows, observed, latest: observed.at(-1) };
}
/** Zero is a measured/recorded value; no log or no treadmill segment is a different state. */
export function weeklyValue(row: WeeklyRow, field: WeeklyField): number | null {
  if (!row.workoutCount || (field !== "minutes" && !row.treadmillCount))
    return null;
  return row[field];
}
export const weeklyMissing = (row: WeeklyRow, field: WeeklyField) =>
  !row.workoutCount
    ? "未記錄運動"
    : field !== "minutes"
      ? "無跑步機分段"
      : "未記錄";
export const trendNumber = (value: number) =>
  value.toLocaleString("zh-TW", { maximumFractionDigits: 3 });
export const trendValue = (
  value: number | null | undefined,
  unit: string,
  missing = "未記錄",
) => (value == null ? missing : `${trendNumber(value)} ${unit}`);
