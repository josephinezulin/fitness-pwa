import { useEffect, useState } from "react";
import {
  defaultPreferences,
  readPreferences,
  validatePreferences,
  type Preferences,
} from "./preferences";
export function usePreferences(
  key: string,
  onError: (message: string) => void,
) {
  const load = () => {
    try {
      return readPreferences(localStorage, key);
    } catch {
      return structuredClone(defaultPreferences);
    }
  };
  const [state, setState] = useState<{ key: string; value: Preferences }>(
    () => ({ key, value: load() }),
  );
  // Derive the matching scope immediately so account switches never render another account's preferences.
  const value = state.key === key ? state.value : load();
  useEffect(() => {
    const refresh = () => {
      try {
        const next = readPreferences(localStorage, key);
        setState((current) =>
          current.key === key &&
          JSON.stringify(current.value) === JSON.stringify(next)
            ? current
            : { key, value: next },
        );
      } catch {
        // Keep the last valid view; explicit writes still reject unreadable storage.
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      try {
        if (event.storageArea && event.storageArea !== localStorage) return;
      } catch {
        return;
      }
      refresh();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", foreground);
    window.addEventListener("pageshow", foreground);
    document.addEventListener("visibilitychange", foreground);
    refresh();
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("pageshow", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [key]);
  function update(
    change: (current: Preferences) => Preferences,
    expectedWeeklyGoal?: number,
  ) {
    try {
      const latest = readPreferences(localStorage, key);
      if (
        expectedWeeklyGoal !== undefined &&
        latest.weeklyGoal !== expectedWeeklyGoal
      ) {
        // Refresh the editor's goal so it can explain the conflict while retaining its draft.
        setState({ key, value: latest });
        return false;
      }
      const next = validatePreferences(change(latest));
      localStorage.setItem(key, JSON.stringify(next));
      setState({ key, value: next });
      return true;
    } catch {
      onError("裝置偏好設定未能儲存，原始內容已保留；運動紀錄不受影響。");
      return false;
    }
  }
  return { value, update };
}
