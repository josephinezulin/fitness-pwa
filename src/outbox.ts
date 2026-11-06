import { validate, type Data } from "./model";
import { snapshotKey, type CloudIdentity } from "./workspace";
import { type CloudOperation, type RemoteVideo } from "./sheets-write";
import type { RemoteWorkout } from "./sync-rules";
import { VIDEO_CATEGORIES } from "./videos";

export type PendingOperation = CloudOperation & {
  state: "pending" | "uncertain" | "conflict";
};
type Identity = Pick<CloudIdentity, "subject" | "spreadsheetId">;
export const outboxKey = (identity: Identity) =>
  `daily-movement-outbox-v1:${snapshotKey(identity)}`;
const stamp = (value: unknown, empty = false): string => {
  if (empty && value === "") return "";
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT.*Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw Error("待同步時間格式錯誤。");
  return value;
};
/** Strictly select known fields; OAuth sessions and arbitrary nested fields are discarded. */
export function cleanOperation(raw: PendingOperation): PendingOperation {
  if (
    !raw ||
    !/^[\w-]{8,100}$/.test(raw.operationId) ||
    typeof raw.id !== "string" ||
    !raw.id ||
    !["pending", "uncertain", "conflict"].includes(raw.state)
  )
    throw Error("待同步內容格式錯誤。");
  const common = {
    operationId: raw.operationId,
    id: raw.id,
    state: raw.state,
    timezone: raw.timezone,
  };
  try {
    if (!raw.timezone) throw Error();
    new Intl.DateTimeFormat("en", { timeZone: raw.timezone });
  } catch {
    throw Error("待同步時區格式錯誤。");
  }
  let safe: PendingOperation;
  if (raw.kind === "workout") {
    const workout = (value: NonNullable<typeof raw.value>) =>
      validate({ version: 1, workouts: [value], metrics: [] }).workouts[0];
    let base: RemoteWorkout | null = null;
    if (raw.base) {
      if (!Number.isSafeInteger(raw.base.revision) || raw.base.revision < 1)
        throw Error("待同步版本格式錯誤。");
      base = {
        ...workout(raw.base),
        revision: raw.base.revision,
        updatedAt: stamp(raw.base.updatedAt),
        deletedAt: stamp(raw.base.deletedAt, true),
      };
    }
    safe = {
      ...common,
      kind: "workout",
      base,
      value: raw.value ? workout(raw.value) : null,
    };
  } else if (raw.kind === "video") {
    const video = (value: NonNullable<typeof raw.value>) => {
      const safe = validate({
        version: 1,
        workouts: [],
        metrics: [],
        videos: [value],
      }).videos![0];
      if (
        !VIDEO_CATEGORIES.includes(safe.category as never) ||
        (safe.minutes !== undefined && !Number.isInteger(safe.minutes))
      )
        throw Error("待同步影片格式錯誤。");
      return safe;
    };
    const base: RemoteVideo | null = raw.base
      ? {
          ...video(raw.base),
          updatedAt: stamp(raw.base.updatedAt, true),
          deletedAt: stamp(raw.base.deletedAt, true),
        }
      : null;
    safe = {
      ...common,
      kind: "video",
      base,
      value: raw.value ? video(raw.value) : null,
    };
  } else throw Error("待同步類型不符。");
  if (
    (safe.base && safe.base.id !== safe.id) ||
    (safe.value && safe.value.id !== safe.id)
  )
    throw Error("待同步識別碼不符。");
  return safe;
}
export function readOutbox(
  storage: Pick<Storage, "getItem">,
  identity: Identity,
): PendingOperation[] {
  const saved = storage.getItem(outboxKey(identity));
  if (!saved) return [];
  try {
    const raw = JSON.parse(saved);
    if (
      raw.version !== 1 ||
      raw.subject !== identity.subject ||
      raw.spreadsheetId !== identity.spreadsheetId ||
      !Array.isArray(raw.operations) ||
      raw.operations.length > 200
    )
      throw Error();
    const operations: PendingOperation[] = raw.operations.map(cleanOperation);
    if (
      new Set(operations.map((o) => `${o.kind}:${o.id}`)).size !==
      operations.length
    )
      throw Error();
    return operations;
  } catch {
    throw Error(
      "待同步資料無法讀取，原始內容已保留；請先匯出裝置備份，暫停新增雲端紀錄。",
    );
  }
}
export function storeOutbox(
  storage: Pick<Storage, "setItem">,
  identity: Identity,
  operations: PendingOperation[],
) {
  if (operations.length > 200)
    throw Error("待同步紀錄已達 200 筆，請先連線同步。");
  storage.setItem(
    outboxKey(identity),
    JSON.stringify({
      version: 1,
      subject: identity.subject,
      spreadsheetId: identity.spreadsheetId,
      operations: operations.map(cleanOperation),
    }),
  );
}
export function overlayOutbox(
  data: Data,
  operations: PendingOperation[],
): Data {
  let workouts = [...data.workouts],
    videos = data.videos ? [...data.videos] : undefined;
  for (const op of operations) {
    if (op.kind === "workout")
      workouts = [
        ...workouts.filter((w) => w.id !== op.id),
        ...(op.value ? [op.value] : []),
      ];
    else
      videos = [
        ...(videos || []).filter((v) => v.id !== op.id),
        ...(op.value ? [op.value] : []),
      ];
  }
  return validate({ ...data, workouts, ...(videos ? { videos } : {}) });
}
