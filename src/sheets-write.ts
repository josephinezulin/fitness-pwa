import {
  validate,
  validatePlans,
  type Workout,
  type SheetVideo,
  type WorkoutPlan,
} from "./model";
import { planOf, samePlan, type RemotePlan } from "./plans";
import {
  activeSegments,
  populated,
  segmentOf,
  validateGrids,
  MAX_DATA_ROWS,
  type Cell,
  type TabName,
} from "./sheet-schema";
import {
  googleJson,
  inspectSpreadsheet,
  type SheetSource,
  type SheetInspection,
} from "./sheets";
import { planWorkoutChanges, type RemoteWorkout } from "./sync-rules";
import { parseYouTubeId } from "./videos";
import type { GoogleSession } from "./google";

export type RemoteVideo = SheetVideo & { updatedAt: string; deletedAt: string };
export type CloudOperation = {
  operationId: string;
  id: string;
  timezone: string;
} & (
  | { kind: "workout"; base: RemoteWorkout | null; value: Workout | null }
  | { kind: "video"; base: RemoteVideo | null; value: SheetVideo | null }
  | { kind: "plan"; base: RemotePlan | null; value: WorkoutPlan }
);
export class SyncConflictError extends Error {
  constructor(public recordId: string) {
    super("這筆資料已在其他裝置或試算表變更，待同步內容已保留，請先處理衝突。");
  }
}
export function remoteWorkouts(source: SheetSource): RemoteWorkout[] {
  const segments = activeSegments(source.grids);
  return source.grids.WorkoutLogs.slice(1)
    .filter(populated)
    .map((row) => {
      const parts = segments.get(String(row[0]))?.map(segmentOf);
      return {
        id: String(row[0]),
        date: String(row[1]),
        type: row[3] as Workout["type"],
        minutes: parts?.length
          ? Math.round(parts.reduce((n, s) => n + s.minutes, 0) * 10) / 10
          : Number(row[4]),
        calories: Number(row[5]),
        note: String(row[6] || ""),
        revision: Number(row[8]),
        updatedAt: String(row[9]),
        deletedAt: String(row[10] || ""),
        ...(parts?.length ? { segments: parts } : {}),
      };
    });
}
export function remoteVideos(source: SheetSource): RemoteVideo[] {
  return (source.grids.Videos || [])
    .slice(1)
    .filter(populated)
    .map((row) => ({
      id: String(row[0]),
      youtubeId: parseYouTubeId(String(row[1]))!,
      title: String(row[2]),
      category: String(row[3]),
      ...(typeof row[4] === "number" ? { minutes: row[4] } : {}),
      updatedAt: String(row[5] || ""),
      deletedAt: String(row[6] || ""),
    }));
}
export const remotePlans = (source: SheetSource): RemotePlan[] =>
  source.grids.WorkoutPlans.slice(1).filter(populated).map(planOf);
export const sameVideo = (
  a: SheetVideo | null | undefined,
  b: SheetVideo | null | undefined,
) =>
  (!a && !b) ||
  (!!a &&
    !!b &&
    (["id", "youtubeId", "title", "category", "minutes"] as const).every(
      (k) => a[k] === b[k],
    ));
export function sameWorkout(
  a: Workout | null | undefined,
  b: Workout | null | undefined,
) {
  if (!a || !b) return !a && !b;
  return (
    (["id", "date", "type", "minutes", "calories", "note"] as const).every(
      (k) => a[k] === b[k],
    ) &&
    a.segments?.length === b.segments?.length &&
    (a.segments || []).every((s, i) => {
      const t = b.segments![i];
      return (
        s.minutes === t.minutes &&
        s.speed === t.speed &&
        s.incline === t.incline
      );
    })
  );
}
/** Typed stringValue is the equivalent of RAW: = + - @ stay literal, unchanged text. */
export const typedCell = (value: Cell) => ({
  userEnteredValue:
    typeof value === "number"
      ? { numberValue: value }
      : typeof value === "boolean"
        ? { boolValue: value }
        : { stringValue: value ?? "" },
});
type WriteRequest = Record<string, unknown>;
/** One atomic Sheets request; no health tables, sharing changes, or row deletion. */
export function planSheetWrite(
  source: SheetSource,
  op: CloudOperation,
  timezone: string,
  now: string,
): WriteRequest[] {
  if (op.timezone !== timezone)
    throw Error("運動時區已變更，待同步內容保留；請先確認試算表時區。");
  if (
    !/^[\w-]{8,100}$/.test(op.operationId) ||
    !op.id ||
    (op.value && op.value.id !== op.id) ||
    (op.base && op.base.id !== op.id)
  )
    throw Error("待同步識別碼不符。");
  if (!/^\d{4}-\d\d-\d\dT.*Z$/.test(now) || !Number.isFinite(Date.parse(now)))
    throw Error("同步時間格式錯誤。");
  if (!validateGrids(source.grids).ok)
    throw Error("試算表格式不符，暫停寫入。");
  const grids = structuredClone(source.grids);
  const updates: WriteRequest[] = [];
  const writes = new Map<TabName, number>();
  function put(tab: TabName, index: number, row: Cell[]) {
    const info = source.sheets[tab];
    if (!info || !Number.isInteger(info.sheetId))
      throw Error(`請先升級試算表，加入 ${tab} 分頁。`);
    if (index < 1 || index > MAX_DATA_ROWS)
      throw Error(`${tab} 已達 ${MAX_DATA_ROWS} 筆上限，未寫入。`);
    grids[tab]![index] = row;
    writes.set(tab, Math.max(writes.get(tab) || 0, index + 1));
    updates.push({
      updateCells: {
        range: {
          sheetId: info.sheetId,
          startRowIndex: index,
          endRowIndex: index + 1,
          startColumnIndex: 0,
          endColumnIndex: row.length,
        },
        rows: [{ values: row.map(typedCell) }],
        fields: "userEnteredValue",
      },
    });
  }
  if (op.kind === "workout") {
    if (op.value) validate({ version: 1, workouts: [op.value], metrics: [] });
    const all = remoteWorkouts(source),
      server = all.find((w) => w.id === op.id);
    const plan = planWorkoutChanges(
      op.base ? [op.base] : [],
      op.value ? [op.value] : [],
      server ? [server] : [],
    );
    if (plan.conflicts.length) throw new SyncConflictError(op.id);
    if (!plan.changes.length) return [];
    const change = plan.changes[0];
    const oldIndex = grids.WorkoutLogs.findIndex((r) => r[0] === op.id);
    if (server && source.grids.WorkoutLogs[oldIndex][2] !== timezone)
      throw Error("運動時區不符，未寫入。");
    const revision = (server?.revision || 0) + 1;
    if (!Number.isSafeInteger(revision)) throw Error("版本編號超出範圍。");
    // Tombstone active old segments in the SAME batch as the parent update.
    grids.TreadmillSegments?.slice(1).forEach((row, i) => {
      if (row[1] === op.id && !row[7])
        put("TreadmillSegments", i + 1, [...row.slice(0, 6), now, now]);
    });
    if (change.kind === "delete") {
      const row = [...grids.WorkoutLogs[oldIndex]];
      row[8] = revision;
      row[9] = now;
      row[10] = now;
      put("WorkoutLogs", oldIndex, row);
    } else {
      const w = op.value!;
      if (!w.segments && !Number.isInteger(w.minutes))
        throw Error("沒有分段的運動分鐘數須為整數。");
      w.segments?.forEach((s, i) =>
        put("TreadmillSegments", grids.TreadmillSegments?.length || 1, [
          `${op.operationId}:${i + 1}`,
          w.id,
          i + 1,
          s.minutes,
          s.speed,
          s.incline,
          now,
          "",
        ]),
      );
      put("WorkoutLogs", oldIndex > 0 ? oldIndex : grids.WorkoutLogs.length, [
        w.id,
        w.date,
        timezone,
        w.type,
        Math.round(
          w.segments
            ? w.segments.reduce((sum, s) => sum + s.minutes, 0)
            : w.minutes,
        ),
        w.calories,
        w.note,
        "pwa",
        revision,
        now,
        "",
      ]);
    }
  } else if (op.kind === "plan") {
    const p = validatePlans([op.value])[0];
    const server = remotePlans(source).find((v) => v.id === op.id);
    if (samePlan(server, p)) return [];
    if (
      op.base
        ? !server ||
          !samePlan(op.base, server) ||
          op.base.updatedAt !== server.updatedAt
        : !!server
    )
      throw new SyncConflictError(op.id);
    // A new active plan in the same slot is a conflict, even when it has a different ID.
    if (
      p.active &&
      remotePlans(source).some(
        (v) =>
          v.id !== p.id &&
          v.active &&
          v.weekday === p.weekday &&
          v.type === p.type,
      )
    )
      throw new SyncConflictError(op.id);
    const index = grids.WorkoutPlans.findIndex((r) => r[0] === op.id);
    put("WorkoutPlans", index > 0 ? index : grids.WorkoutPlans.length, [
      p.id,
      p.weekday,
      p.type,
      p.title,
      p.minMinutes,
      p.maxMinutes,
      p.tutorialUrl,
      p.active,
      now,
    ]);
  } else {
    if (!grids.Videos) throw Error("請先升級試算表，加入 Videos 分頁。");
    if (op.value)
      validate({ version: 1, workouts: [], metrics: [], videos: [op.value] });
    const server = remoteVideos(source).find((v) => v.id === op.id);
    const active = server?.deletedAt ? null : server;
    if (sameVideo(active, op.value)) return [];
    if (
      op.base
        ? !server ||
          !sameVideo(op.base, server) ||
          op.base.updatedAt !== server.updatedAt ||
          op.base.deletedAt !== server.deletedAt ||
          !!op.base.deletedAt
        : !!server
    )
      throw new SyncConflictError(op.id);
    const index = grids.Videos.findIndex((row) => row[0] === op.id);
    if (!op.value) {
      if (index < 1) return [];
      const row = grids.Videos[index];
      put("Videos", index, [
        row[0],
        row[1],
        row[2],
        row[3],
        row[4] ?? "",
        now,
        now,
      ]);
    } else {
      const v = op.value;
      put("Videos", index > 0 ? index : grids.Videos.length, [
        v.id,
        `https://www.youtube.com/watch?v=${v.youtubeId}`,
        v.title,
        v.category,
        v.minutes ?? "",
        now,
        "",
      ]);
    }
  }
  if (!validateGrids(grids).ok)
    throw Error("寫入內容不符合試算表格式，未送出。");
  const grow: WriteRequest[] = [];
  for (const [tab, needed] of writes) {
    const info = source.sheets[tab]!;
    if (needed > info.rowCount) {
      grow.push({
        appendDimension: {
          sheetId: info.sheetId,
          dimension: "ROWS",
          length: needed - info.rowCount,
        },
      });
      if (info.rowCount > 1) {
        const sourceRange = {
          sheetId: info.sheetId,
          startRowIndex: info.rowCount - 1,
          endRowIndex: info.rowCount,
        };
        const destination = {
          sheetId: info.sheetId,
          startRowIndex: info.rowCount,
          endRowIndex: needed,
        };
        for (const pasteType of ["PASTE_FORMAT", "PASTE_DATA_VALIDATION"])
          grow.push({
            copyPaste: { source: sourceRange, destination, pasteType },
          });
      }
    }
  }
  return [...grow, ...updates];
}
/** Revalidate privacy, schema and current revisions immediately before every attempt. */
export async function writeCloudOperation(
  id: string,
  subject: string,
  op: CloudOperation,
  session: GoogleSession,
  signal: AbortSignal,
): Promise<SheetInspection> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (session.subject !== subject)
    throw Error("待同步資料與登入帳號不同，未送出。");
  const fresh = await inspectSpreadsheet(id, session, signal);
  if (!fresh.source || !fresh.report.ok)
    throw Error("試算表格式不符，暫停寫入。");
  const requests = planSheetWrite(
    fresh.source,
    op,
    fresh.timezone,
    new Date().toISOString(),
  );
  if (requests.length) {
    await googleJson(
      new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}:batchUpdate`,
      ),
      session,
      signal,
      { requests, includeSpreadsheetInResponse: false },
    );
    const confirmed = await inspectSpreadsheet(id, session, signal);
    if (!confirmed.source || !confirmed.report.ok)
      throw Error("寫入後尚未確認，內容保留待重試。");
    if (
      planSheetWrite(
        confirmed.source,
        op,
        confirmed.timezone,
        new Date().toISOString(),
      ).length
    )
      throw new SyncConflictError(op.id);
    return confirmed;
  }
  return fresh;
}
