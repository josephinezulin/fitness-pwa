import { projectCloudData } from "./cloud-data";
import type { Data } from "./model";
import type { GoogleSession } from "./google";
import {
  HEADERS,
  MAX_DATA_ROWS,
  OPTIONAL_TABS,
  type TabName,
  SCHEMA_KEY,
  SCHEMA_VERSION,
  TAB_NAMES,
  validateGrids,
  type Grids,
  type ValidationReport,
  type Cell,
  populated,
} from "./sheet-schema";
export type SheetSource = {
  grids: Grids;
  sheets: Partial<Record<TabName, { sheetId: number; rowCount: number }>>;
};
export type SheetInspection = {
  id: string;
  title: string;
  timezone: string;
  report: ValidationReport;
  checkedAt: string;
  data?: Data;
  source?: SheetSource;
};
type Metadata = {
  spreadsheetId: string;
  properties: { title: string; timeZone: string };
  sheets: {
    properties: {
      sheetId: number;
      title: string;
      gridProperties: { rowCount: number; columnCount: number };
    };
  }[];
  developerMetadata?: {
    metadataKey: string;
    metadataValue: string;
    location?: { spreadsheet?: boolean };
  }[];
};
export class GoogleAccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function googleJson<T>(
  url: URL,
  session: GoogleSession,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  if (Date.now() >= session.expiresAt)
    throw new GoogleAccessError(401, "Google 授權已過期，請重新登入。");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(cancel, 20000);
  try {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const message =
        response.status === 401
          ? "Google 授權失效，請重新登入。"
          : response.status === 403
            ? "無法存取：請確認 API 已啟用、授權範圍與檔案權限。"
            : response.status === 404
              ? "找不到試算表，請透過選檔器重新選擇副本。"
              : response.status === 429
                ? "Google 暫時限制請求次數，請稍後重試。"
                : "Google 服務暫時無法讀取，請稍後重試。";
      throw new GoogleAccessError(response.status, message);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
/** Read-only gate. Never uploads health data or mutates a selected spreadsheet. */
export async function inspectSpreadsheet(
  id: string,
  session: GoogleSession,
  signal: AbortSignal,
): Promise<SheetInspection> {
  if (!/^[\w-]{10,}$/.test(id)) throw Error("試算表 ID 格式錯誤。");
  const fileUrl = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
  );
  fileUrl.searchParams.set(
    "fields",
    "id,mimeType,ownedByMe,shared,capabilities(canEdit)",
  );
  const file = await googleJson<{
    mimeType?: string;
    ownedByMe?: boolean;
    shared?: boolean;
    capabilities?: { canEdit?: boolean };
  }>(fileUrl, session, signal);
  if (
    file.mimeType !== "application/vnd.google-apps.spreadsheet" ||
    file.ownedByMe !== true ||
    file.capabilities?.canEdit !== true
  )
    throw Error(
      "請先將範本建立副本到自己的 Google Drive，再選擇你擁有且可編輯的原生 Google Sheets。",
    );
  if (file.shared !== false)
    throw Error(
      "資料副本必須保持私人，請將共用權限設為「限制存取」並移除其他共用對象，再重試。公開範本不可作為健康資料來源。",
    );
  const metaUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`,
  );
  metaUrl.searchParams.set(
    "fields",
    "spreadsheetId,properties(title,timeZone),sheets(properties(sheetId,title,gridProperties)),developerMetadata(metadataKey,metadataValue,location)",
  );
  const meta = await googleJson<Metadata>(metaUrl, session, signal);
  if (meta.spreadsheetId !== id) throw Error("Google 回傳的試算表識別碼不符。");
  const markers =
    meta.developerMetadata?.filter(
      (m) => m.metadataKey === SCHEMA_KEY && m.location?.spreadsheet === true,
    ) || [];
  if (markers.length !== 1 || markers[0].metadataValue !== SCHEMA_VERSION)
    throw Error(
      "試算表缺少正確版本標記 fitnessSchemaVersion=1，請使用相容範本。",
    );
  const titles = meta.sheets.map((s) => s.properties.title);
  if (
    TAB_NAMES.some((tab) => !titles.includes(tab)) ||
    titles.some(
      (t) =>
        !(TAB_NAMES as readonly string[]).includes(t) &&
        !(OPTIONAL_TABS as readonly string[]).includes(t),
    ) ||
    new Set(titles).size !== titles.length
  )
    throw Error(
      "試算表必須包含 HealthMetrics、DailySteps、WorkoutLogs、WorkoutPlans、SyncLogs 五張工作表；只可另外加入選用的 TreadmillSegments、Videos。",
    );
  const tabs: TabName[] = [
    ...TAB_NAMES,
    ...OPTIONAL_TABS.filter((tab) => titles.includes(tab)),
  ];
  for (const sheet of meta.sheets) {
    if (sheet.properties.gridProperties.rowCount > MAX_DATA_ROWS + 1)
      throw Error(
        `${sheet.properties.title} 超出目前可驗收的 ${MAX_DATA_ROWS} 列上限，請先移除多餘空白列或另存較小副本。`,
      );
    const columns =
      HEADERS[sheet.properties.title as keyof typeof HEADERS].length;
    if (sheet.properties.gridProperties.columnCount !== columns)
      throw Error(
        `${sheet.properties.title} 的欄數不符，請依範本保留 ${columns} 欄。`,
      );
  }
  const valuesUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`,
  );
  for (const tab of tabs) {
    const end = String.fromCharCode(64 + HEADERS[tab].length);
    const rows = meta.sheets.find((s) => s.properties.title === tab)!.properties
      .gridProperties.rowCount;
    valuesUrl.searchParams.append("ranges", `'${tab}'!A1:${end}${rows}`);
  }
  // Read actual cell types: a literal '=...' is text; formulaValue is rejected.
  valuesUrl.searchParams.set("includeGridData", "true");
  valuesUrl.searchParams.set(
    "fields",
    "sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue))))",
  );
  const response = await googleJson<{
    sheets?: {
      properties: { title: string };
      data?: {
        startRow?: number;
        startColumn?: number;
        rowData?: {
          values?: {
            userEnteredValue?: {
              stringValue?: string;
              numberValue?: number;
              boolValue?: boolean;
              formulaValue?: string;
            };
          }[];
        }[];
      }[];
    }[];
  }>(valuesUrl, session, signal);
  if (
    response.sheets?.length !== tabs.length ||
    new Set(response.sheets.map((s) => s.properties.title)).size !==
      tabs.length ||
    response.sheets.some((s) => !tabs.includes(s.properties.title as TabName))
  )
    throw Error("Google 未回傳完整工作表資料，未完成驗收。");
  const formulaTabs = new Set<TabName>();
  const grids = Object.fromEntries(
    tabs.map((tab) => {
      const blocks =
        response.sheets!.find((s) => s.properties.title === tab)!.data || [];
      if (blocks.length > 1 || blocks.some((b) => b.startRow || b.startColumn))
        throw Error("Google 回傳的資料範圍不符，停止讀取。");
      const rows: Cell[][] = (blocks[0]?.rowData || []).map((row) =>
        (row.values || []).map((cell) => {
          const v = cell.userEnteredValue;
          if (v?.formulaValue !== undefined) formulaTabs.add(tab);
          return v?.stringValue ?? v?.numberValue ?? v?.boolValue ?? null;
        }),
      );
      const size = meta.sheets.find((s) => s.properties.title === tab)!
        .properties.gridProperties;
      if (
        rows.length > size.rowCount ||
        rows.some((r) => r.length > size.columnCount)
      )
        throw Error("Google 回傳的資料超出已驗證範圍。");
      while (rows.length && !populated(rows[rows.length - 1])) rows.pop();
      return [tab, rows];
    }),
  ) as Grids;
  const report = validateGrids(grids);
  for (const tab of tabs) {
    if (formulaTabs.has(tab)) {
      report.errors.push(`${tab} 含公式，API 資料區必須使用純值。`);
      report.ok = false;
    }
  }
  return {
    id,
    title: meta.properties.title,
    timezone: meta.properties.timeZone,
    report,
    checkedAt: new Date().toISOString(),
    data: report.ok
      ? projectCloudData(grids, meta.properties.timeZone)
      : undefined,
    source: report.ok
      ? {
          grids,
          sheets: Object.fromEntries(
            meta.sheets.map((s) => [
              s.properties.title,
              {
                sheetId: s.properties.sheetId,
                rowCount: s.properties.gridProperties.rowCount,
              },
            ]),
          ),
        }
      : undefined,
  };
}
