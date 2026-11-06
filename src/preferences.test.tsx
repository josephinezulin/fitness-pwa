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
  it("preserves corrupted storage instead of overwriting it with defaults", () => {
    const key = preferenceKey(a),
      onError = vi.fn();
    localStorage.setItem(key, "{broken");
    const { result } = renderHook(() => usePreferences(key, onError));
    act(() => {
      expect(result.current.update((p) => ({ ...p, weeklyGoal: 100 }))).toBe(
        false,
      );
    });
    expect(localStorage.getItem(key)).toBe("{broken");
    expect(onError).toHaveBeenCalled();
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
