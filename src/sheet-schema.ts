/** Shared contract for the PWA, Gemini template and future Apps Script writer. */
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
} as const;
export type TabName = keyof typeof HEADERS;
export const TAB_NAMES = Object.keys(HEADERS) as TabName[];
export type Cell = string | number | boolean | null;
export type Grids = Record<TabName, Cell[][]>;
export type ValidationReport = {
  ok: boolean;
  errors: string[];
  counts: Record<TabName, number>;
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
  const counts = Object.fromEntries(TAB_NAMES.map((tab) => [tab, 0])) as Record<
    TabName,
    number
  >;
  const add = (tab: string, row: number, detail: string) => {
    if (errors.length < 50) errors.push(`${tab} 第 ${row} 列：${detail}`);
  };
  for (const tab of TAB_NAMES) {
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
      counts[tab]++;
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
      if ("updatedAt" in r && !timestamp(r.updatedAt))
        add(tab, row, "updatedAt 必須為 UTC ISO 8601");
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
          !["home", "walk", "other"].includes(String(r.type)) ||
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
          !["home", "walk", "other"].includes(String(r.type)) ||
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
