import { empty, validate, type Data } from "./model";
export const LOCAL_KEY = "daily-movement-v1";
export type CloudIdentity = {
  subject: string;
  spreadsheetId: string;
  title: string;
  timezone: string;
  checkedAt: string;
};
export function snapshotKey(
  identity: Pick<CloudIdentity, "subject" | "spreadsheetId">,
) {
  if (!identity.subject || !identity.spreadsheetId)
    throw Error("雲端資料必須綁定帳號與檔案。");
  return `daily-movement-cloud-v1:${encodeURIComponent(identity.subject)}:${encodeURIComponent(identity.spreadsheetId)}`;
}
export function readLocal(storage: Pick<Storage, "getItem">): {
  data: Data;
  error: string;
  raw: string | null | undefined;
} {
  let raw: string | null | undefined;
  try {
    raw = storage.getItem(LOCAL_KEY);
    return { data: raw ? validate(JSON.parse(raw)) : empty, error: "", raw };
  } catch {
    return {
      data: empty,
      raw,
      error:
        "無法讀取本機資料；原始內容尚未覆蓋，請先確認瀏覽器儲存權限或備份。",
    };
  }
}
export function storeSnapshot(
  storage: Pick<Storage, "setItem">,
  identity: CloudIdentity,
  data: Data,
) {
  // Explicit fields: never serialize a GoogleSession or arbitrary caller properties.
  const cache = {
    identity: {
      subject: identity.subject,
      spreadsheetId: identity.spreadsheetId,
      title: identity.title,
      timezone: identity.timezone,
      checkedAt: identity.checkedAt,
    },
    data: validate(data),
  };
  storage.setItem(snapshotKey(identity), JSON.stringify(cache));
}
/** Used only to retain the last valid local intent when a fresh projection conflicts. */
export function readSnapshot(
  storage: Pick<Storage, "getItem">,
  identity: Pick<CloudIdentity, "subject" | "spreadsheetId">,
): Data | null {
  try {
    const raw = JSON.parse(storage.getItem(snapshotKey(identity)) || "null");
    if (
      raw?.identity?.subject !== identity.subject ||
      raw?.identity?.spreadsheetId !== identity.spreadsheetId
    )
      return null;
    return validate(raw.data);
  } catch {
    return null;
  }
}

export function selectionKey(subject: string) {
  if (!subject) throw Error("缺少 Google 帳號識別碼。");
  return `daily-movement-selection-v1:${encodeURIComponent(subject)}`;
}
export function rememberSelection(
  storage: Pick<Storage, "setItem">,
  subject: string,
  selection: { id: string; title: string },
) {
  if (!/^[\w-]{10,}$/.test(selection.id)) throw Error("試算表識別碼格式錯誤。");
  storage.setItem(
    selectionKey(subject),
    JSON.stringify({ subject, id: selection.id, title: selection.title }),
  );
}
export function readSelection(
  storage: Pick<Storage, "getItem">,
  subject: string,
): { id: string; title: string } | null {
  try {
    const value = JSON.parse(storage.getItem(selectionKey(subject)) || "null");
    if (
      value?.subject !== subject ||
      typeof value.id !== "string" ||
      !/^[\w-]{10,}$/.test(value.id) ||
      typeof value.title !== "string"
    )
      return null;
    return { id: value.id, title: value.title };
  } catch {
    return null;
  }
}
