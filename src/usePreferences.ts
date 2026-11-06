import { useState } from "react";
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
  function update(change: (current: Preferences) => Preferences) {
    try {
      const next = validatePreferences(
        change(readPreferences(localStorage, key)),
      );
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
