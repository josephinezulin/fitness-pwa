/** Shared contract for the PWA, Gemini template and future Apps Script writer. */
import { WORKOUT_TYPES, SEGMENT_LIMITS, isWorkoutType } from "./model";
import { VIDEO_CATEGORIES, parseYouTubeId } from "./videos";
export const SCHEMA_VERSION = "1";
export const SCHEMA_KEY = "fitnessSchemaVersion";
export const MAX_DATA_ROWS = 5000;
export const HEADERS = {
  HealthMetrics: [
    "id",
    "sampleKey",
    "measuredAt",
    "date",
    "timezone",
    "metricType",
    "value",
    "unit",
    "source",
    "deviceId",
    "updatedAt",
    "deletedAt",
  ],
  DailySteps: [
    "id",
    "date",
    "timezone",
    "totalSteps",
    "source",
    "deviceId",
    "revision",
    "updatedAt",
  ],
  WorkoutLogs: [
    "id",
    "date",
    "timezone",
    "type",
    "minutes",
    "calories",
    "note",
    "source",
    "revision",
    "updatedAt",
    "deletedAt",
  ],
  WorkoutPlans: [
    "id",
    "weekday",
    "type",
    "title",
    "minMinutes",
    "maxMinutes",
    "tutorialUrl",
    "active",
    "updatedAt",
  ],
  SyncLogs: [
    "requestId",
    "deviceId",
    "receivedAt",
    "rangeStart",
    "rangeEnd",
    "status",
    "acceptedCount",
    "rejectedCount",
    "errorCode",
  ],
  // Optional, additive tabs (same schema version 1). Older copies without them stay valid.
  TreadmillSegments: [
    "id",
    "workoutId",
    "seq",
    "minutes",
    "speed",
    "incline",
    "updatedAt",
    "deletedAt",
  ],
  Videos: [
    "id",
    "url",
    "title",
    "category",
    "minutes",
    "updatedAt",
    "deletedAt",
  ],
} as const;
export type TabName = keyof typeof HEADERS;
/** Required tabs, in template order. */
export const TAB_NAMES = [
  "HealthMetrics",
  "DailySteps",
  "WorkoutLogs",
  "WorkoutPlans",
  "SyncLogs",
] as const satisfies readonly TabName[];
export type CoreTab = (typeof TAB_NAMES)[number];
export const OPTIONAL_TABS = [
  "TreadmillSegments",
  "Videos",
] as const satisfies readonly TabName[];
export type OptionalTab = (typeof OPTIONAL_TABS)[number];
export const ALL_TABS: readonly TabName[] = [...TAB_NAMES, ...OPTIONAL_TABS];
export const WORKOUT_TYPE_KEYS = Object.keys(WORKOUT_TYPES);
export type Cell = string | number | boolean | null;
export type Grids = Record<CoreTab, Cell[][]> &
  Partial<Record<OptionalTab, Cell[][]>>;
export type ValidationReport = {
  ok: boolean;
  errors: string[];
  counts: Partial<Record<TabName, number>>;
};
const isoDate = (value: Cell | undefined) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
const timestamp = (value: Cell | undefined) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?Z$/.test(
    value,
  ) &&
  isoDate(value.slice(0, 10)) &&
  Number.isFinite(Date.parse(value));
const text = (value: Cell | undefined) =>
  typeof value === "string" && value.length > 0 && value.length <= 2000;
const missing = (value: Cell | undefined) =>
  value === undefined || value === null || value === "";
const number = (
  value: Cell | undefined,
  min: number,
  max: number,
  integer = false,
) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max &&
  (!integer || Number.isInteger(value));
const zone = (value: Cell | undefined) => {
  try {
    if (typeof value !== "string" || !value) return false;
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
export const populated = (row: Cell[]) => row.some((value) => !missing(value));

export function validateGrids(grids: Grids): ValidationReport {
  const errors: string[] = [];
  const present = OPTIONAL_TABS.filter((tab) => grids[tab] !== undefined);
  const counts: Partial<Record<TabName, number>> = Object.fromEntries(
    [...TAB_NAMES, ...present].map((tab) => [tab, 0]),
  );
  const add = (tab: string, row: number, detail: string) => {
    if (errors.length < 50) errors.push(`${tab} 第 ${row} 列：${detail}`);
  };
  for (const tab of [...TAB_NAMES, ...present] as TabName[]) {
    const rows = grids[tab];
    if (!Array.isArray(rows)) {
      add(tab, 1, "缺少工作表資料");
      continue;
    }
    const header = rows[0] || [];
    if (
      HEADERS[tab].some((name, i) => header[i] !== name) ||
      header.slice(HEADERS[tab].length).some((v) => !missing(v))
    ) {
      add(tab, 1, "欄名或順序不符，請使用原始英文欄名");
      continue;
    }
    const ids = new Set<string>();
    const sampleKeys = new Set<string>();
    const stepDates = new Set<string>();
    if (rows.length - 1 > MAX_DATA_ROWS)
      add(tab, MAX_DATA_ROWS + 2, "超出目前支援的 5,000 筆上限");
    rows.slice(1).forEach((cells, index) => {
      if (!populated(cells)) return;
      counts[tab] = (counts[tab] || 0) + 1;
      const row = index + 2;
      if (cells.slice(HEADERS[tab].length).some((v) => !missing(v)))
        add(tab, row, "含未定義的額外欄位");
      const record = Object.fromEntries(
        HEADERS[tab].map((name, i) => [name, cells[i]]),
      );
      const r = record;
      const id = tab === "SyncLogs" ? r.requestId : r.id;
      if (!text(id) || ids.has(String(id))) add(tab, row, "ID 缺少或重複");
      ids.add(String(id));
      if ("date" in r && !isoDate(r.date))
        add(tab, row, "date 必須為有效 YYYY-MM-DD 純文字");
      if ("timezone" in r && !zone(r.timezone))
        add(tab, row, "timezone 必須為有效 IANA 時區");
      const optionalStamp = tab === "TreadmillSegments" || tab === "Videos";
      if (
        "updatedAt" in r &&
        !(optionalStamp && missing(r.updatedAt)) &&
        !timestamp(r.updatedAt)
      )
        add(
          tab,
          row,
          optionalStamp
            ? "updatedAt 必須留白或使用 UTC ISO 8601"
            : "updatedAt 必須為 UTC ISO 8601",
        );
      if ("deletedAt" in r && !missing(r.deletedAt) && !timestamp(r.deletedAt))
        add(tab, row, "deletedAt 必須留白或使用 UTC ISO 8601");
      if (
        "revision" in r &&
        !number(r.revision, 1, Number.MAX_SAFE_INTEGER, true)
      )
        add(tab, row, "revision 必須為正整數");
      if (tab === "HealthMetrics") {
        if (!text(r.sampleKey) || sampleKeys.has(String(r.sampleKey)))
          add(tab, row, "sampleKey 缺少或重複");
        sampleKeys.add(String(r.sampleKey));
        if (!timestamp(r.measuredAt))
          add(tab, row, "measuredAt 必須為 UTC ISO 8601");
        if (timestamp(r.measuredAt) && zone(r.timezone) && isoDate(r.date)) {
          const parts = new Intl.DateTimeFormat("en", {
            timeZone: String(r.timezone),
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).formatToParts(new Date(String(r.measuredAt)));
          const part = (name: string) =>
            parts.find((p) => p.type === name)!.value;
          if (`${part("year")}-${part("month")}-${part("day")}` !== r.date)
            add(tab, row, "date 與 measuredAt 在指定時區的日期不一致");
        }
        const types: Record<string, [string, number, number]> = {
          weight: ["kg", 1, 500],
          bodyFat: ["percent", 0, 100],
          heartRate: ["bpm", 20, 250],
        };
        const spec = types[String(r.metricType)];
        if (!spec || r.unit !== spec[0] || !number(r.value, spec[1], spec[2]))
          add(tab, row, "metricType、value 或 unit 不符");
        if (!text(r.source) || !text(r.deviceId))
          add(tab, row, "source 與 deviceId 不可為空");
      }
      if (tab === "DailySteps") {
        const dateKey = `${r.timezone}|${r.date}`;
        if (stepDates.has(dateKey))
          add(tab, row, "同時區同一天只能有一筆 canonical 步數");
        stepDates.add(dateKey);
        if (!number(r.totalSteps, 0, 200000, true))
          add(tab, row, "totalSteps 必須為 0–200000 整數");
        if (!text(r.source) || !text(r.deviceId))
          add(tab, row, "source 與 deviceId 不可為空");
      }
      if (tab === "WorkoutLogs") {
        if (
          !isWorkoutType(r.type) ||
          !number(r.minutes, 1, 1440, true) ||
          !number(r.calories, 0, 20000)
        )
          add(tab, row, "運動類型、分鐘數或熱量超出規格");
        if (
          !missing(r.note) &&
          (typeof r.note !== "string" || r.note.length > 2000)
        )
          add(tab, row, "note 必須為至多 2000 字的文字");
        if (!text(r.source)) add(tab, row, "source 不可為空");
      }
      if (tab === "WorkoutPlans") {
        if (
          !number(r.weekday, 1, 7, true) ||
          !isWorkoutType(r.type) ||
          !text(r.title)
        )
          add(tab, row, "課表日期、類型或名稱不符");
        if (
          !number(r.minMinutes, 1, 1440, true) ||
          !number(r.maxMinutes, 1, 1440, true) ||
          Number(r.minMinutes) > Number(r.maxMinutes)
        )
          add(tab, row, "建議分鐘數範圍錯誤");
        if (typeof r.active !== "boolean")
          add(tab, row, "active 必須為真正的布林值");
        if (!missing(r.tutorialUrl)) {
          try {
            const url = new URL(String(r.tutorialUrl));
            if (
              url.protocol !== "https:" ||
              !["youtube.com", "www.youtube.com", "youtu.be"].includes(
                url.hostname,
              )
            )
              throw Error();
          } catch {
            add(tab, row, "tutorialUrl 必須為 HTTPS YouTube 網址");
          }
        }
      }
      if (tab === "TreadmillSegments") {
        if (!text(r.workoutId)) add(tab, row, "workoutId 不可為空");
        if (!number(r.seq, 1, SEGMENT_LIMITS.count, true))
          add(tab, row, `seq 必須為 1–${SEGMENT_LIMITS.count} 的整數`);
        if (
          !number(r.minutes, ...SEGMENT_LIMITS.minutes) ||
          !number(r.speed, ...SEGMENT_LIMITS.speed) ||
          !number(r.incline, ...SEGMENT_LIMITS.incline)
        )
          add(
            tab,
            row,
            `分鐘 ${SEGMENT_LIMITS.minutes.join("–")}、速度 ${SEGMENT_LIMITS.speed.join("–")} km/h、坡度 ${SEGMENT_LIMITS.incline.join("–")}% 超出範圍`,
          );
      }
      if (tab === "Videos") {
        if (typeof r.url !== "string" || !parseYouTubeId(r.url))
          add(tab, row, "url 必須為 YouTube 影片網址或 11 碼影片 ID");
        if (!text(r.title) || String(r.title).length > 200)
          add(tab, row, "title 必須為 1–200 字");
        if (!VIDEO_CATEGORIES.includes(r.category as never))
          add(tab, row, `category 必須為：${VIDEO_CATEGORIES.join("、")}`);
        if (!missing(r.minutes) && !number(r.minutes, 1, 600, true))
          add(tab, row, "minutes 必須留白或為 1–600 整數");
      }
      if (tab === "SyncLogs") {
        if (
          !text(r.deviceId) ||
          !timestamp(r.receivedAt) ||
          !timestamp(r.rangeStart) ||
          !timestamp(r.rangeEnd) ||
          Date.parse(String(r.rangeStart)) > Date.parse(String(r.rangeEnd))
        )
          add(tab, row, "同步裝置或時間範圍不符");
        if (!["committed", "failed", "partial"].includes(String(r.status)))
          add(tab, row, "status 必須為 committed／failed／partial");
        if (
          !number(r.acceptedCount, 0, Number.MAX_SAFE_INTEGER, true) ||
          !number(r.rejectedCount, 0, Number.MAX_SAFE_INTEGER, true)
        )
          add(tab, row, "同步筆數必須為非負整數");
        if (!missing(r.errorCode) && !text(r.errorCode))
          add(tab, row, "errorCode 必須為文字或留白");
      }
    });
  }
  crossCheckSegments(grids, add);
  const plans = grids.WorkoutPlans?.slice(1).filter(populated) || [];
  for (const [weekday, type, min, max] of [
    [1, "home", 20, 30],
    [3, "walk", 30, 60],
    [6, "home", 20, 30],
  ]) {
    if (
      !plans.some(
        (r) =>
          r[1] === weekday &&
          r[2] === type &&
          r[4] === min &&
          r[5] === max &&
          r[7] === true,
      )
    )
      add(
        "WorkoutPlans",
        2,
        `缺少預設週 ${weekday} ${type} 課表（${min}–${max} 分鐘）`,
      );
  }
  return { ok: errors.length === 0, errors, counts };
}

const SEGMENT_COL = Object.fromEntries(
  HEADERS.TreadmillSegments.map((name, i) => [name, i]),
) as Record<(typeof HEADERS.TreadmillSegments)[number], number>;
/** Active segments grouped by workout, sorted by seq. Rows must already pass validateGrids. */
export function activeSegments(grids: Grids) {
  const byWorkout = new Map<string, Cell[][]>();
  for (const cells of grids.TreadmillSegments?.slice(1) || []) {
    if (!populated(cells) || !missing(cells[SEGMENT_COL.deletedAt])) continue;
    const id = String(cells[SEGMENT_COL.workoutId]);
    byWorkout.set(id, [...(byWorkout.get(id) || []), cells]);
  }
  for (const rows of byWorkout.values())
    rows.sort(
      (a, b) => Number(a[SEGMENT_COL.seq]) - Number(b[SEGMENT_COL.seq]),
    );
  return byWorkout;
}
export const segmentOf = (cells: Cell[]) => ({
  minutes: Number(cells[SEGMENT_COL.minutes]),
  speed: Number(cells[SEGMENT_COL.speed]),
  incline: Number(cells[SEGMENT_COL.incline]),
});
function crossCheckSegments(
  grids: Grids,
  add: (tab: string, row: number, detail: string) => void,
) {
  if (!grids.TreadmillSegments || !Array.isArray(grids.WorkoutLogs)) return;
  const workouts = new Map<string, Cell[]>();
  for (const cells of grids.WorkoutLogs.slice(1))
    if (populated(cells)) workouts.set(String(cells[0]), cells);
  const seen = new Set<string>();
  grids.TreadmillSegments.slice(1).forEach((cells, index) => {
    if (!populated(cells) || !missing(cells[SEGMENT_COL.deletedAt])) return;
    const row = index + 2;
    const workoutId = String(cells[SEGMENT_COL.workoutId]);
    const key = `${workoutId}#${cells[SEGMENT_COL.seq]}`;
    if (seen.has(key))
      add("TreadmillSegments", row, "同一筆運動的 seq 不可重複");
    seen.add(key);
    const workout = workouts.get(workoutId);
    if (!workout)
      add("TreadmillSegments", row, "workoutId 找不到對應的 WorkoutLogs");
    else if (
      missing(workout[10]) &&
      !(isWorkoutType(workout[3]) && WORKOUT_TYPES[workout[3]].treadmill)
    )
      add("TreadmillSegments", row, "只有 walk／run 運動可以有跑步機分段");
  });
  for (const [workoutId, rows] of activeSegments(grids)) {
    const workout = workouts.get(workoutId);
    if (!workout || !missing(workout[10])) continue;
    const total = rows.reduce(
      (sum, cells) => sum + segmentOf(cells).minutes,
      0,
    );
    if (Math.round(total) !== workout[4])
      add(
        "WorkoutLogs",
        grids.WorkoutLogs.indexOf(workout) + 1,
        `minutes（${workout[4]}）必須等於跑步機分段總和四捨五入（${Math.round(total * 10) / 10}）`,
      );
  }
}
