export const WORKOUT_TYPES = {
  home: { label: "居家徒手訓練", group: "肌力與體能", treadmill: false },
  strength: {
    label: "重量訓練／健身房",
    group: "肌力與體能",
    treadmill: false,
  },
  jumprope: { label: "跳繩", group: "肌力與體能", treadmill: false },
  walk: { label: "上坡快走／健走", group: "有氧", treadmill: true },
  run: { label: "跑步／慢跑", group: "有氧", treadmill: true },
  cycling: { label: "騎車／飛輪", group: "有氧", treadmill: false },
  swim: { label: "游泳", group: "有氧", treadmill: false },
  hike: { label: "健行／登山", group: "有氧", treadmill: false },
  yoga: { label: "瑜伽", group: "柔軟與核心", treadmill: false },
  pilates: { label: "皮拉提斯", group: "柔軟與核心", treadmill: false },
  stretch: { label: "伸展／放鬆", group: "柔軟與核心", treadmill: false },
  ball: { label: "球類運動", group: "其他", treadmill: false },
  other: { label: "其他運動", group: "其他", treadmill: false },
} as const;
export type WorkoutType = keyof typeof WORKOUT_TYPES;
export const isWorkoutType = (v: unknown): v is WorkoutType =>
  typeof v === "string" && Object.hasOwn(WORKOUT_TYPES, v);
/** One treadmill block: speed in km/h, incline in percent grade. */
export type Segment = { minutes: number; speed: number; incline: number };
export const SEGMENT_LIMITS = {
  minutes: [0.5, 300],
  speed: [0.5, 25],
  incline: [-5, 40],
  count: 50,
} as const;
export type Workout = {
  id: string;
  date: string;
  type: WorkoutType;
  minutes: number;
  calories: number;
  note: string;
  segments?: Segment[];
};
const round = (n: number, digits: number) =>
  Math.round(n * 10 ** digits) / 10 ** digits;
/** Time-weighted totals; distance = speed × time, elevation ≈ distance × grade. */
export function treadmillSummary(segments: Segment[]) {
  let minutes = 0,
    km = 0,
    inclineTime = 0,
    climb = 0;
  for (const s of segments) {
    const d = (s.speed * s.minutes) / 60;
    minutes += s.minutes;
    km += d;
    inclineTime += s.incline * s.minutes;
    climb += Math.max(0, d * 1000 * (s.incline / 100));
  }
  return {
    minutes: round(minutes, 1),
    distanceKm: round(km, 2),
    avgSpeed: minutes ? round(km / (minutes / 60), 1) : 0,
    avgIncline: minutes ? round(inclineTime / minutes, 1) : 0,
    maxSpeed: segments.length ? Math.max(...segments.map((s) => s.speed)) : 0,
    maxIncline: segments.length
      ? Math.max(...segments.map((s) => s.incline))
      : 0,
    elevationM: Math.round(climb),
  };
}
export type Metric = {
  id: string;
  date: string;
  weight?: number;
  fat?: number;
  heart?: number;
  steps?: number;
};
/** Videos maintained in the user's spreadsheet (cloud view only). */
export type SheetVideo = {
  id: string;
  youtubeId: string;
  title: string;
  category: string;
  minutes?: number;
};
/** ISO weekday 1 = Monday. Disabled plans remain available for editing. */
export type WorkoutPlan = {
  id: string;
  weekday: number;
  type: WorkoutType;
  title: string;
  minMinutes: number;
  maxMinutes: number;
  tutorialUrl: string;
  active: boolean;
};
export type Data = {
  version: 1;
  workouts: Workout[];
  metrics: Metric[];
  videos?: SheetVideo[];
  plans?: WorkoutPlan[];
};
export const empty: Data = { version: 1, workouts: [], metrics: [] };
export const today = () => dateKey(new Date());
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekDays(reference = new Date()) {
  const d = new Date(reference);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return dateKey(day);
  });
}
export const defaultPlans: readonly WorkoutPlan[] = [
  {
    id: "home-mon",
    weekday: 1,
    type: "home",
    title: "居家徒手訓練",
    minMinutes: 20,
    maxMinutes: 30,
    tutorialUrl: "",
    active: true,
  },
  {
    id: "walk-wed",
    weekday: 3,
    type: "walk",
    title: "健身房上坡快走",
    minMinutes: 30,
    maxMinutes: 60,
    tutorialUrl: "",
    active: true,
  },
  {
    id: "home-sat",
    weekday: 6,
    type: "home",
    title: "居家徒手訓練",
    minMinutes: 20,
    maxMinutes: 30,
    tutorialUrl: "",
    active: true,
  },
];
/** Only missing legacy data uses defaults; an explicit empty list stays empty. */
export const workoutPlans = (data: Pick<Data, "plans">): WorkoutPlan[] =>
  (data.plans ?? defaultPlans).map((p) => ({ ...p }));
export const validTutorialUrl = (value: unknown): value is string => {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
};
export function validatePlans(raw: unknown): WorkoutPlan[] {
  if (!Array.isArray(raw) || raw.length > 5000) throw Error("課表資料格式錯誤");
  const ids = new Set<string>(),
    slots = new Set<string>();
  return raw.map((p: WorkoutPlan) => {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      !Number.isInteger(p.weekday) ||
      p.weekday < 1 ||
      p.weekday > 7 ||
      !isWorkoutType(p.type) ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 200 ||
      !Number.isInteger(p.minMinutes) ||
      p.minMinutes < 1 ||
      !Number.isInteger(p.maxMinutes) ||
      p.maxMinutes > 1440 ||
      p.minMinutes > p.maxMinutes ||
      typeof p.active !== "boolean" ||
      !validTutorialUrl(p.tutorialUrl)
    )
      throw Error("課表日期、名稱、分鐘數或教學網址格式錯誤");
    const slot = `${p.weekday}:${p.type}`;
    if (p.active && slots.has(slot))
      throw Error("同一天、同類型只能啟用一個課表，請先停用重複課表。");
    ids.add(p.id);
    if (p.active) slots.add(slot);
    return {
      id: p.id,
      weekday: p.weekday,
      type: p.type,
      title: p.title,
      minMinutes: p.minMinutes,
      maxMinutes: p.maxMinutes,
      tutorialUrl: p.tutorialUrl,
      active: p.active,
    };
  });
}
export function completed(workouts: Workout[], date: string, type: string) {
  return workouts.some(
    (w) => w.date === date && w.type === type && w.minutes > 0,
  );
}
const validDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  dateKey(new Date(v + "T12:00:00")) === v;
const number = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function validate(raw: unknown): Data {
  const d = raw as Data;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.workouts) ||
    !Array.isArray(d.metrics) ||
    d.workouts.length > 50000 ||
    d.metrics.length > 50000
  )
    throw Error("備份格式或版本不符");
  const ids = new Set<string>();
  for (const w of d.workouts) {
    if (
      !w ||
      typeof w.id !== "string" ||
      !w.id ||
      ids.has(w.id) ||
      !validDate(w.date) ||
      !isWorkoutType(w.type) ||
      !number(w.minutes, 1, 1440) ||
      !number(w.calories, 0, 20000) ||
      typeof w.note !== "string" ||
      w.note.length > 2000
    )
      throw Error("運動紀錄格式錯誤");
    if (w.segments !== undefined) {
      const segs = w.segments;
      if (
        !WORKOUT_TYPES[w.type].treadmill ||
        !Array.isArray(segs) ||
        segs.length < 1 ||
        segs.length > SEGMENT_LIMITS.count ||
        segs.some(
          (s) =>
            !s ||
            !number(s.minutes, ...SEGMENT_LIMITS.minutes) ||
            !number(s.speed, ...SEGMENT_LIMITS.speed) ||
            !number(s.incline, ...SEGMENT_LIMITS.incline),
        ) ||
        Math.abs(treadmillSummary(segs).minutes - w.minutes) > 0.051
      )
        throw Error("跑步機分段格式錯誤");
    }
    ids.add(w.id);
  }
  const mids = new Set<string>();
  const dates = new Set<string>();
  for (const m of d.metrics) {
    if (
      !m ||
      typeof m.id !== "string" ||
      !m.id ||
      mids.has(m.id) ||
      !validDate(m.date) ||
      dates.has(m.date)
    )
      throw Error("健康資料重複或日期錯誤");
    mids.add(m.id);
    dates.add(m.date);
    for (const [k, min, max] of [
      ["weight", 1, 500],
      ["fat", 0, 100],
      ["heart", 20, 250],
      ["steps", 0, 200000],
    ] as const) {
      if (m[k] !== undefined && !number(m[k], min, max))
        throw Error("健康數值超出範圍");
    }
    if (
      ["weight", "fat", "heart", "steps"].every(
        (k) => m[k as keyof Metric] === undefined,
      )
    )
      throw Error("健康資料不可為空");
  }
  if (d.videos !== undefined) {
    const vids = new Set<string>();
    if (
      !Array.isArray(d.videos) ||
      d.videos.length > 5000 ||
      d.videos.some(
        (v) =>
          !v ||
          typeof v.id !== "string" ||
          !v.id ||
          vids.has(v.id) ||
          !vids.add(v.id) ||
          typeof v.youtubeId !== "string" ||
          !/^[\w-]{11}$/.test(v.youtubeId) ||
          typeof v.title !== "string" ||
          !v.title ||
          v.title.length > 200 ||
          typeof v.category !== "string" ||
          (v.minutes !== undefined && !number(v.minutes, 1, 600)),
      )
    )
      throw Error("影片資料格式錯誤");
  }
  return {
    version: 1,
    ...(d.plans !== undefined ? { plans: validatePlans(d.plans) } : {}),
    ...(d.videos
      ? {
          videos: d.videos.map(
            ({ id, youtubeId, title, category, minutes }) => ({
              id,
              youtubeId,
              title,
              category,
              ...(minutes !== undefined ? { minutes } : {}),
            }),
          ),
        }
      : {}),
    workouts: d.workouts.map(
      ({ id, date, type, minutes, calories, note, segments }) => ({
        id,
        date,
        type,
        minutes,
        calories,
        note,
        ...(segments
          ? {
              segments: segments.map(({ minutes, speed, incline }) => ({
                minutes,
                speed,
                incline,
              })),
            }
          : {}),
      }),
    ),
    metrics: d.metrics.map((m) => {
      const result: Metric = { id: m.id, date: m.date };
      for (const field of ["weight", "fat", "heart", "steps"] as const) {
        if (m[field] !== undefined) result[field] = m[field];
      }
      return result;
    }),
  };
}
export function demo(): Data {
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return dateKey(d);
  });
  return {
    version: 1,
    metrics: dates.map((date, i) => ({
      id: `demo-${i}`,
      date,
      weight: Math.round((68.6 - i * 0.035 + Math.sin(i) * 0.15) * 10) / 10,
      fat: Math.round((24 - i * 0.04) * 10) / 10,
      heart: 67 + (i % 5),
      steps: 4200 + ((i * 719) % 6200),
    })),
    workouts: weekDays()
      .filter((_, i) => i === 0)
      .map(
        (date): Workout => ({
          id: "demo-workout",
          date,
          type: "home",
          minutes: 25,
          calories: 130,
          note: "全身循環，完成後伸展 5 分鐘",
        }),
      )
      .concat({
        id: "demo-treadmill",
        date: dates[11],
        type: "walk",
        minutes: 40,
        calories: 260,
        note: "跑步機上坡快走",
        segments: [
          { minutes: 5, speed: 4.5, incline: 1 },
          { minutes: 30, speed: 5.5, incline: 8 },
          { minutes: 5, speed: 4.5, incline: 0 },
        ],
      } as Workout),
  };
}
