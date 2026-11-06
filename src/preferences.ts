import { snapshotKey, type CloudIdentity } from "./workspace";
export type Preferences = {
  version: 1;
  weeklyGoal: number;
  favorites: string[];
  seen: Record<string, number>;
};
export const defaultPreferences: Preferences = {
  version: 1,
  weeklyGoal: 150,
  favorites: [],
  seen: {},
};
export const seenCount = (preferences: Preferences | undefined, id: string) =>
  preferences && Object.hasOwn(preferences.seen, id) ? preferences.seen[id] : 0;
export const markSeen = (
  preferences: Preferences,
  id: string,
): Preferences => ({
  ...preferences,
  seen: {
    ...preferences.seen,
    [id]: Math.min(1000000, seenCount(preferences, id) + 1),
  },
});
export const preferenceKey = (
  identity?: Pick<CloudIdentity, "subject" | "spreadsheetId"> | null,
) =>
  `daily-movement-preferences-v1:${identity ? snapshotKey(identity) : "local"}`;
export function validatePreferences(raw: unknown): Preferences {
  const p = raw as Preferences;
  if (
    !p ||
    p.version !== 1 ||
    !Number.isInteger(p.weeklyGoal) ||
    p.weeklyGoal < 10 ||
    p.weeklyGoal > 2000 ||
    !Array.isArray(p.favorites) ||
    p.favorites.length > 1000 ||
    p.favorites.some((v) => typeof v !== "string" || !/^[\w-]{11}$/.test(v)) ||
    !p.seen ||
    typeof p.seen !== "object" ||
    Array.isArray(p.seen) ||
    Object.keys(p.seen).length > 1000 ||
    Object.entries(p.seen).some(
      ([id, n]) =>
        !/^[\w-]{11}$/.test(id) ||
        !Number.isSafeInteger(n) ||
        n < 0 ||
        n > 1000000,
    )
  )
    throw Error("裝置偏好設定格式錯誤，原始內容已保留。");
  return {
    version: 1,
    weeklyGoal: p.weeklyGoal,
    favorites: [...new Set(p.favorites)],
    seen: Object.fromEntries(Object.entries(p.seen)),
  };
}
export function readPreferences(
  storage: Pick<Storage, "getItem">,
  key: string,
) {
  const saved = storage.getItem(key);
  return saved
    ? validatePreferences(JSON.parse(saved))
    : structuredClone(defaultPreferences);
}
