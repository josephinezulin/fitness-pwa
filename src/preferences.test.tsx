// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultPreferences,
  markSeen,
  preferenceKey,
  readPreferences,
  seenCount,
  validatePreferences,
} from "./preferences";
import { usePreferences } from "./usePreferences";
beforeEach(() => localStorage.clear());
afterEach(cleanup);
const a = { subject: "A", spreadsheetId: "sheet-private-1" };
describe("personal experience preferences", () => {
  it("isolates device, accounts and files, even immediately after switching scope", () => {
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      ({ scope }) => usePreferences(preferenceKey(scope), onError),
      { initialProps: { scope: a } },
    );
    act(() => {
      result.current.update((p) => ({
        ...markSeen(p, "v7AYKMP6rOE"),
        weeklyGoal: 90,
        favorites: ["v7AYKMP6rOE"],
      }));
    });
    rerender({ scope: { ...a, subject: "B" } });
    expect(result.current.value).toEqual(defaultPreferences);
    rerender({ scope: { ...a, spreadsheetId: "sheet-private-2" } });
    expect(result.current.value.weeklyGoal).toBe(150);
    rerender({ scope: a });
    expect(result.current.value.weeklyGoal).toBe(90);
    expect(readPreferences(localStorage, preferenceKey()).favorites).toEqual(
      [],
    );
  });
  it.each(["{broken", ""])(
    "preserves corrupted storage %j instead of overwriting it with defaults",
    (raw) => {
      const key = preferenceKey(a),
        onError = vi.fn();
      localStorage.setItem(key, raw);
      const { result } = renderHook(() => usePreferences(key, onError));
      act(() => {
        expect(result.current.update((p) => ({ ...p, weeklyGoal: 100 }))).toBe(
          false,
        );
      });
      expect(localStorage.getItem(key)).toBe(raw);
      expect(onError).toHaveBeenCalled();
    },
  );
  it("refreshes only the matching local storage key and retains fresh fields in later writes", () => {
    const key = preferenceKey(a),
      onError = vi.fn();
    const { result } = renderHook(() => usePreferences(key, onError));
    const initial = result.current.value;
    const next = {
      ...defaultPreferences,
      weeklyGoal: 220,
      favorites: ["v7AYKMP6rOE"],
      seen: { v7AYKMP6rOE: 2 },
    };
    localStorage.setItem(key, JSON.stringify(next));
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "unrelated",
          storageArea: localStorage,
        }),
      ),
    );
    expect(result.current.value).toBe(initial);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key, storageArea: sessionStorage }),
      ),
    );
    expect(result.current.value).toBe(initial);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: "ignored payload",
          storageArea: localStorage,
        }),
      ),
    );
    expect(result.current.value).toEqual(next);
    const updated = result.current.value;
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key, storageArea: localStorage }),
      ),
    );
    expect(result.current.value).toBe(updated);
    act(() => {
      expect(result.current.update((p) => markSeen(p, "v7AYKMP6rOE"))).toBe(
        true,
      );
    });
    expect(readPreferences(localStorage, key)).toEqual({
      ...next,
      seen: { v7AYKMP6rOE: 3 },
    });
    localStorage.removeItem(key);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: null, storageArea: localStorage }),
      ),
    );
    expect(result.current.value).toEqual(defaultPreferences);
    expect(localStorage.getItem(key)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
  it.each(["focus", "pageshow", "visibilitychange"])(
    "refreshes on visible %s and preserves the last valid view when reads fail",
    (event) => {
      const key = preferenceKey(a),
        onError = vi.fn();
      const { result } = renderHook(() => usePreferences(key, onError));
      const visibility = vi.spyOn(document, "visibilityState", "get");
      const dispatch = () =>
        (event === "visibilitychange" ? document : window).dispatchEvent(
          new Event(event),
        );
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ ...defaultPreferences, weeklyGoal: 180 }),
        );
        visibility.mockReturnValue("hidden");
        act(dispatch);
        expect(result.current.value.weeklyGoal).toBe(150);
        visibility.mockReturnValue("visible");
        act(dispatch);
        expect(result.current.value.weeklyGoal).toBe(180);
        const valid = result.current.value;
        localStorage.setItem(key, "{broken");
        act(dispatch);
        expect(result.current.value).toBe(valid);
        act(() => {
          expect(
            result.current.update((p) => ({ ...p, weeklyGoal: 100 })),
          ).toBe(false);
        });
        expect(localStorage.getItem(key)).toBe("{broken");
        expect(result.current.value).toBe(valid);
      } finally {
        visibility.mockRestore();
      }
    },
  );
  it("switches the active subscription with the account and removes listeners on unmount", () => {
    const aKey = preferenceKey(a),
      bKey = preferenceKey({ ...a, subject: "B" });
    const onError = vi.fn();
    localStorage.setItem(
      aKey,
      JSON.stringify({ ...defaultPreferences, weeklyGoal: 90 }),
    );
    const { result, rerender, unmount } = renderHook(
      ({ key }) => usePreferences(key, onError),
      { initialProps: { key: aKey } },
    );
    expect(result.current.value.weeklyGoal).toBe(90);
    rerender({ key: bKey });
    expect(result.current.value).toEqual(defaultPreferences);
    localStorage.setItem(
      bKey,
      JSON.stringify({ ...defaultPreferences, weeklyGoal: 240 }),
    );
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: aKey, storageArea: localStorage }),
      ),
    );
    expect(result.current.value.weeklyGoal).toBe(150);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: bKey, storageArea: localStorage }),
      ),
    );
    expect(result.current.value.weeklyGoal).toBe(240);
    const get = vi.spyOn(Storage.prototype, "getItem");
    unmount();
    get.mockClear();
    window.dispatchEvent(
      new StorageEvent("storage", { key: bKey, storageArea: localStorage }),
    );
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(get).not.toHaveBeenCalled();
    get.mockRestore();
  });
  it("whitelists serialized fields and rejects invalid counters or IDs", () => {
    const value = validatePreferences({
      ...defaultPreferences,
      accessToken: "must-not-persist",
      seen: { v7AYKMP6rOE: 2 },
    });
    expect(JSON.stringify(value)).not.toContain("must-not-persist");
    expect(() => validatePreferences({ ...value, weeklyGoal: 0 })).toThrow();
    expect(() =>
      validatePreferences({ ...value, seen: { v7AYKMP6rOE: -1 } }),
    ).toThrow();
    expect(() =>
      validatePreferences({ ...value, favorites: ["invalid"] }),
    ).toThrow();
  });
  it("treats valid IDs matching prototype names as ordinary unseen videos", () => {
    expect(seenCount(defaultPreferences, "constructor")).toBe(0);
    expect(
      seenCount(markSeen(defaultPreferences, "constructor"), "constructor"),
    ).toBe(1);
  });
});

it.each([null, a])(
  "checks the expected goal against fresh storage in scope %j before changing preferences",
  (scope) => {
    const key = preferenceKey(scope),
      onError = vi.fn();
    const { result } = renderHook(() => usePreferences(key, onError));
    const latest = {
      ...defaultPreferences,
      weeklyGoal: 240,
      favorites: ["v7AYKMP6rOE"],
      seen: { v7AYKMP6rOE: 2 },
    };
    const raw = JSON.stringify(latest);
    localStorage.setItem(key, raw);
    expect(result.current.value.weeklyGoal).toBe(150);
    const change = vi.fn((p: typeof defaultPreferences) => ({
      ...p,
      weeklyGoal: 175,
    }));
    act(() => expect(result.current.update(change, 150)).toBe(false));
    expect(change).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe(raw);
    expect(result.current.value).toEqual(latest);
    expect(onError).not.toHaveBeenCalled();
  },
);
it("preserves fresh favorites and seen counts when the expected goal still matches", () => {
  const key = preferenceKey(),
    onError = vi.fn();
  const { result } = renderHook(() => usePreferences(key, onError));
  const latest = {
    ...defaultPreferences,
    favorites: ["v7AYKMP6rOE"],
    seen: { v7AYKMP6rOE: 3 },
  };
  localStorage.setItem(key, JSON.stringify(latest));
  act(() =>
    expect(result.current.update((p) => ({ ...p, weeklyGoal: 180 }), 150)).toBe(
      true,
    ),
  );
  expect(readPreferences(localStorage, key)).toEqual({
    ...latest,
    weeklyGoal: 180,
  });
  expect(onError).not.toHaveBeenCalled();
});
