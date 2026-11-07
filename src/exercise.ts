import {
  SEGMENT_LIMITS,
  treadmillSummary,
  weekDays,
  type Metric,
  type Segment,
  type Workout,
  type WorkoutType,
} from "./model";
import type { VideoCategory } from "./videos";

export type WorkoutDraft = {
  type: WorkoutType;
  minutes: number;
  note: string;
  treadmill?: boolean;
  videoId?: string;
  countWatch?: boolean;
  segments?: Segment[];
  fromDate?: string;
};
/** Reuse settings as a new draft; identity, date, calories and watch counts are not copied. */
export function repeatWorkoutDraft(workout: Workout): WorkoutDraft {
  return {
    type: workout.type,
    minutes: workout.minutes,
    note: workout.note,
    treadmill: !!workout.segments,
    fromDate: workout.date,
    ...(workout.segments
      ? { segments: workout.segments.map((segment) => ({ ...segment })) }
      : {}),
  };
}
export const CATEGORY_WORKOUT: Record<VideoCategory, WorkoutType> = {
  暖身: "stretch",
  居家徒手: "home",
  "快走／跑步機": "walk",
  跑步: "run",
  重量訓練: "strength",
  瑜伽: "yoga",
  皮拉提斯: "pilates",
  伸展放鬆: "stretch",
  "飛輪／騎車": "cycling",
  跳繩: "jumprope",
  其他: "other",
};
export const TREADMILL_PRESETS: {
  id: string;
  title: string;
  type: "walk" | "run";
  segments: Segment[];
}[] = [
  {
    id: "easy-20",
    title: "平地健走 20 分",
    type: "walk",
    segments: [
      { minutes: 5, speed: 4, incline: 0 },
      { minutes: 10, speed: 4.5, incline: 0 },
      { minutes: 5, speed: 4, incline: 0 },
    ],
  },
  {
    id: "incline-30",
    title: "緩坡快走 30 分",
    type: "walk",
    segments: [
      { minutes: 5, speed: 4, incline: 0 },
      { minutes: 20, speed: 5, incline: 3 },
      { minutes: 5, speed: 4, incline: 0 },
    ],
  },
  {
    id: "run-30",
    title: "走跑交替 30 分",
    type: "run",
    segments: [
      { minutes: 5, speed: 4.5, incline: 0 },
      ...Array.from({ length: 4 }, () => [
        { minutes: 3, speed: 8.5, incline: 1 },
        { minutes: 2, speed: 4.5, incline: 0 },
      ]).flat(),
      { minutes: 5, speed: 4, incline: 0 },
    ],
  },
];
export function segmentErrors(segments: Segment[]): string[] {
  if (!segments.length || segments.length > SEGMENT_LIMITS.count)
    return [`請填寫 1–${SEGMENT_LIMITS.count} 段跑步機設定。`];
  const errors: string[] = [];
  for (const [i, s] of segments.entries())
    for (const [key, label, unit] of [
      ["minutes", "分鐘", ""],
      ["speed", "速度", " km/h"],
      ["incline", "坡度", "%"],
    ] as const) {
      const [min, max] = SEGMENT_LIMITS[key];
      if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
        errors.push(`第 ${i + 1} 段${label}需為 ${min}–${max}${unit}。`);
    }
  const total = segments.reduce((sum, s) => sum + s.minutes, 0);
  if (Number.isFinite(total) && (total < 1 || total > 1440))
    errors.push("分段總時間需為 1–1440 分鐘。");
  return errors;
}
export function pace(speedKmh: number): string | null {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return null;
  const seconds = Math.round(3600 / speedKmh);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function weightForDate(metrics: Metric[], date: string) {
  return [...metrics]
    .filter((m) => m.date <= date && m.weight !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
// 2024 Adult Compendium; activity codes and scope are documented in docs/energy-estimates.md.
export const MET_ACTIVITIES: Partial<
  Record<WorkoutType, { met: number; label: string; code: string }>
> = {
  home: { met: 2.8, label: "輕量徒手訓練", code: "02024" },
  strength: {
    met: 3.5,
    label: "一般阻力訓練（多動作、8–15 次）",
    code: "02054",
  },
  jumprope: { met: 8.3, label: "慢速跳繩（每分低於 100 下）", code: "15552" },
  walk: { met: 3.8, label: "平地健走（約 4.5–5.5 km/h）", code: "17190" },
  run: { met: 7.5, label: "一般慢跑", code: "12020" },
  cycling: { met: 4.3, label: "輕鬆騎車（非飛輪功率估算）", code: "01015" },
  swim: { met: 6, label: "休閒游泳（非泳池來回訓練）", code: "18310" },
  hike: { met: 3.8, label: "慢速健行、無負重", code: "17081" },
  yoga: { met: 2.3, label: "一般瑜伽", code: "02175" },
  pilates: { met: 2.8, label: "一般皮拉提斯", code: "02105" },
  stretch: { met: 2.3, label: "輕度伸展", code: "02101" },
};
export type EnergyEstimate = {
  calories: number | null;
  method: string;
  reason: string;
};
export function estimateEnergy(
  type: WorkoutType,
  minutes: number,
  weight: number,
  segments?: Segment[],
): EnergyEstimate {
  const unavailable = (reason: string): EnergyEstimate => ({
    calories: null,
    method: "",
    reason,
  });
  if (!Number.isFinite(weight) || weight < 1 || weight > 500)
    return unavailable("填寫或選用體重後可估算熱量。");
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440)
    return unavailable("先填寫有效的運動分鐘數。");
  let kcal = 0,
    method = "";
  if (segments) {
    if (!(type === "walk" || type === "run") || segmentErrors(segments).length)
      return unavailable("先完成有效的跑步機分段設定。");
    for (const [i, s] of segments.entries()) {
      if (s.minutes < 3)
        return unavailable(
          `第 ${i + 1} 段少於 3 分鐘，短間歇請參考機台熱量；分段仍能正常儲存。`,
        );
      // Speed alone does not establish walking gait during a running session.
      const walking = type === "walk" && s.speed >= 3.2 && s.speed <= 5.6;
      const running = type === "run" && s.speed > 8.04 && s.speed <= 20;
      if ((!walking && !running) || s.incline < 0 || s.incline > 10)
        return unavailable(
          `第 ${i + 1} 段超出此估算範圍；可填機台熱量，分段仍能正常儲存。`,
        );
      const speed = (s.speed * 1000) / 60,
        grade = s.incline / 100;
      const oxygen =
        (walking ? 0.1 : 0.2) * speed +
        (walking ? 1.8 : 0.9) * speed * grade +
        3.5;
      kcal += ((oxygen * weight) / 200) * s.minutes;
    }
    method = "ACSM 跑步機分段估算";
  } else {
    const activity = MET_ACTIVITIES[type];
    if (!activity)
      return unavailable("此類型的強度差異較大，請填機台或自行記錄的熱量。");
    kcal = ((activity.met * 3.5 * weight) / 200) * minutes;
    method = `${activity.label} · ${activity.met} MET`;
  }
  if (!Number.isFinite(kcal) || kcal > 20000)
    return unavailable("估算超出紀錄範圍，請確認時間與體重。");
  return {
    calories: Math.round(kcal),
    method,
    reason: `${segments ? "以穩定配速模型" : "依所列活動強度"}粗估，含靜息消耗；不等同機台或 Apple 健康的活動熱量。`,
  };
}
export function weeklyActivity(
  workouts: Workout[],
  reference: string,
  count = 8,
) {
  const start = weekDays(new Date(reference + "T12:00:00"))[0];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + "T12:00:00");
    date.setDate(date.getDate() - (count - 1 - index) * 7);
    const days = weekDays(date),
      rows = workouts.filter(
        (w) => days.includes(w.date) && w.date <= reference,
      );
    const segments = rows.flatMap((w) => w.segments || []),
      treadmill = treadmillSummary(segments);
    return {
      week: days[0],
      label: days[0].slice(5).replace("-", "/"),
      workoutCount: rows.length,
      treadmillCount: rows.filter((w) => w.segments?.length).length,
      minutes: Math.round(rows.reduce((n, w) => n + w.minutes, 0) * 10) / 10,
      distance: treadmill.distanceKm,
      incline: segments.length ? treadmill.avgIncline : null,
    };
  });
}
