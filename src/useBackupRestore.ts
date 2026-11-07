import { useEffect, useRef, useState } from "react";
import { parseBackup } from "./backup";
import type { Data } from "./model";
import { preferenceKey, type Preferences } from "./preferences";
import { storeLibrary, VIDEO_KEY } from "./videos";

type RestoreHandle = {
  check: () => void;
  apply: (data: Data) => void;
  warning?: string;
};

export function useBackupRestore({
  scopeKey,
  prepare,
  onLibraryRestored,
  onPreferencesRestored,
  onMessage,
}: {
  scopeKey: string;
  prepare: () => RestoreHandle;
  onLibraryRestored: () => void;
  onPreferencesRestored: (preferences: Preferences) => boolean;
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef<number | null>(null);
  const sequence = useRef(0);
  const previousScope = useRef(scopeKey);
  useEffect(
    () => () => {
      sequence.current++;
      pending.current = null;
    },
    [],
  );
  useEffect(() => {
    if (previousScope.current === scopeKey) return;
    previousScope.current = scopeKey;
    if (pending.current === null) return;
    pending.current = null;
    sequence.current++;
    setBusy(false);
    onMessage("工作區已切換，備份讀取已取消，現有資料未變更。");
  }, [scopeKey, onMessage]);

  function cancel() {
    if (pending.current === null) return;
    pending.current = null;
    sequence.current++;
    setBusy(false);
    onMessage("已取消讀取備份，現有資料未變更。");
  }
  async function restore(file?: File, prepareTarget = prepare) {
    if (!file) return;
    const attempt = ++sequence.current;
    pending.current = attempt;
    setBusy(true);
    onMessage("");
    let applied = false;
    try {
      if (file.size > 10_000_000) throw Error("檔案超過 10 MB");
      const target = prepareTarget();
      const before = [VIDEO_KEY, preferenceKey(null)].map(
        (key) => [key, localStorage.getItem(key)] as const,
      );
      const check = () => {
        target.check();
        if (before.some(([key, value]) => localStorage.getItem(key) !== value))
          throw Error("讀取期間影片清單或偏好設定已變更，請重新選擇備份。");
      };
      const text = await file.text();
      if (pending.current !== attempt) return;
      check();
      const parsed = parseBackup(JSON.parse(text));
      const next = parsed.data,
        videos = parsed.library;
      if (
        !confirm(
          `${target.warning ? target.warning + "\n" : ""}將以備份取代現有資料（${next.workouts.length} 筆運動、${next.metrics.length} 筆健康資料${videos ? `、${videos.custom.length} 部自訂影片` : ""}）。建議先匯出備份。確定還原？`,
        )
      )
        return;
      if (pending.current !== attempt) return;
      check();
      target.apply(next);
      applied = true;
      if (videos) {
        storeLibrary(localStorage, videos);
        onLibraryRestored();
      }
      const preferencesRestored = parsed.preferences
        ? onPreferencesRestored(parsed.preferences)
        : true;
      onMessage(
        preferencesRestored
          ? "已成功還原資料"
          : "運動與健康紀錄已還原；裝置偏好設定尚未還原，原始內容已保留。",
      );
    } catch (error) {
      if (pending.current !== attempt) return;
      onMessage(
        applied
          ? "運動與健康紀錄已還原；影片清單或裝置偏好尚未完成，請保留備份檔案並處理儲存問題後重試。"
          : "無法還原：" + (error as Error).message,
      );
    } finally {
      if (pending.current === attempt) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return { busy, restore, cancel };
}
