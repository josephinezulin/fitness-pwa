// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCalendarToday } from "./useCalendarToday";
import { today } from "./model";

const visibility = (value: DocumentVisibilityState) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T15:59:00Z"));
  visibility("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each(["focus", "pageshow", "visibilitychange"])(
  "updates the sheet calendar date across midnight on %s",
  (event) => {
    const { result } = renderHook(() => useCalendarToday("Asia/Taipei"));
    expect(result.current).toBe("2026-11-08");
    vi.setSystemTime(new Date("2026-11-08T16:01:00Z"));
    act(() =>
      (event === "visibilitychange" ? document : window).dispatchEvent(
        new Event(event),
      ),
    );
    expect(result.current).toBe("2026-11-09");
  },
);
it("ignores hidden events and refreshes when the page becomes visible", () => {
  const { result } = renderHook(() => useCalendarToday("Asia/Taipei"));
  visibility("hidden");
  vi.setSystemTime(new Date("2026-11-08T16:01:00Z"));
  act(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current).toBe("2026-11-08");
  visibility("visible");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current).toBe("2026-11-09");
});
it("uses a changed sheet timezone immediately and keeps foreground checks on that timezone", () => {
  vi.setSystemTime(new Date("2026-11-08T18:00:00Z"));
  const { result, rerender } = renderHook(
    ({ timezone }) => useCalendarToday(timezone),
    { initialProps: { timezone: "Asia/Taipei" } },
  );
  expect(result.current).toBe("2026-11-09");
  rerender({ timezone: "America/Los_Angeles" });
  expect(result.current).toBe("2026-11-08");
  vi.setSystemTime(new Date("2026-11-09T01:00:00Z"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current).toBe("2026-11-08");
  vi.setSystemTime(new Date("2026-11-09T09:00:00Z"));
  act(() => window.dispatchEvent(new Event("pageshow")));
  expect(result.current).toBe("2026-11-09");
});
it("does not rerender for repeated foreground events in the same calendar day", () => {
  let renders = 0;
  renderHook(() => {
    renders++;
    return useCalendarToday("Asia/Taipei");
  });
  const initial = renders;
  act(() => {
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    }
  });
  expect(renders).toBe(initial);
});
it("also observes the current device day on an unrelated render without a foreground event", () => {
  const { result, rerender } = renderHook(() => useCalendarToday());
  expect(result.current).toBe(today());
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  rerender();
  expect(result.current).toBe(today());
});
it("can move back to the correct day after the device clock is corrected", () => {
  const { result } = renderHook(() => useCalendarToday("Asia/Taipei"));
  vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current).toBe("2026-11-07");
});
it("removes its foreground listeners on unmount", () => {
  const addWindow = vi.spyOn(window, "addEventListener"),
    addDocument = vi.spyOn(document, "addEventListener");
  const removeWindow = vi.spyOn(window, "removeEventListener"),
    removeDocument = vi.spyOn(document, "removeEventListener");
  const { unmount } = renderHook(() => useCalendarToday("Asia/Taipei"));
  const focus = addWindow.mock.calls.find(([name]) => name === "focus")![1];
  const pageshow = addWindow.mock.calls.find(
    ([name]) => name === "pageshow",
  )![1];
  const change = addDocument.mock.calls.find(
    ([name]) => name === "visibilitychange",
  )![1];
  unmount();
  expect(removeWindow).toHaveBeenCalledWith("focus", focus);
  expect(removeWindow).toHaveBeenCalledWith("pageshow", pageshow);
  expect(removeDocument).toHaveBeenCalledWith("visibilitychange", change);
});
