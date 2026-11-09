// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useVideoStorage } from "./useVideoStorage";
import {
  emptyLibrary,
  storeLibrary,
  VIDEO_KEY,
  type VideoLibrary,
} from "./videos";

const fixture: VideoLibrary = {
  version: 1,
  custom: [
    {
      id: "fictional-b",
      youtubeId: "b0000000001",
      title: "虛構 B 影片",
      category: "瑜伽",
    },
  ],
  hidden: [],
};
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const storageEvent = (
  key: string | null = VIDEO_KEY,
  storageArea: Storage = localStorage,
) => window.dispatchEvent(new StorageEvent("storage", { key, storageArea }));

it("advances its own raw baseline after each successful save without changing unrelated data", () => {
  localStorage.setItem("unrelated", "keep");
  const { result } = renderHook(useVideoStorage);
  act(() => {
    expect(result.current.persist(fixture)).toBe(true);
  });
  act(() => {
    expect(
      result.current.persist({ ...fixture, hidden: ["builtin-fictional"] }),
    ).toBe(true);
  });
  expect(result.current.blocked).toBe(false);
  expect(result.current.library.custom).toEqual(fixture.custom);
  expect(localStorage.getItem("unrelated")).toBe("keep");
  expect(JSON.parse(localStorage.getItem(VIDEO_KEY)!).hidden).toEqual([
    "builtin-fictional",
  ]);
});

it("ignores unrelated keys and sessionStorage, then requires an explicit reload for changed content", () => {
  const { result } = renderHook(useVideoStorage);
  storeLibrary(localStorage, fixture);
  act(() => {
    storageEvent("unrelated");
    storageEvent(VIDEO_KEY, sessionStorage);
  });
  expect(result.current.blocked).toBe(false);
  act(() => {
    storageEvent();
  });
  expect(result.current.blocked).toBe(true);
  expect(result.current.library).toEqual(emptyLibrary);
  act(() => {
    expect(result.current.reload()).toBe(true);
  });
  expect(result.current.library).toEqual(fixture);
  expect(result.current.blocked).toBe(false);
  expect(result.current.error).toBe("");
});

it("treats clearing storage as a change and can explicitly read the now-empty library", () => {
  storeLibrary(localStorage, fixture);
  const { result } = renderHook(useVideoStorage);
  localStorage.clear();
  act(() => {
    storageEvent(null);
  });
  expect(result.current.library).toEqual(fixture);
  expect(result.current.blocked).toBe(true);
  act(() => {
    result.current.reload();
  });
  expect(result.current.library).toEqual(emptyLibrary);
  expect(localStorage.getItem(VIDEO_KEY)).toBeNull();
});

it.each(["focus", "pageshow", "visibilitychange"])(
  "detects missed changes on visible %s",
  (type) => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(useVideoStorage);
    storeLibrary(localStorage, fixture);
    act(() => {
      (type === "visibilitychange" ? document : window).dispatchEvent(
        new Event(type),
      );
    });
    expect(result.current.blocked).toBe(true);
    expect(result.current.library.custom).toHaveLength(0);
  },
);

it("defers hidden foreground checks and removes listeners when unmounted", () => {
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  const get = vi.spyOn(Storage.prototype, "getItem");
  const { result, unmount } = renderHook(useVideoStorage);
  storeLibrary(localStorage, fixture);
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(result.current.blocked).toBe(false);
  visibility.mockReturnValue("visible");
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.blocked).toBe(true);
  unmount();
  get.mockClear();
  act(() => {
    storageEvent();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(get).not.toHaveBeenCalled();
});

it("keeps the last valid screen through invalid content and failed reloads until valid content is read", () => {
  storeLibrary(localStorage, fixture);
  const { result } = renderHook(useVideoStorage);
  localStorage.setItem(VIDEO_KEY, "{fictional-invalid");
  act(() => {
    storageEvent();
    expect(result.current.reload()).toBe(false);
  });
  expect(result.current.library).toEqual(fixture);
  act(() => {
    expect(result.current.persist(emptyLibrary)).toBe(false);
  });
  expect(localStorage.getItem(VIDEO_KEY)).toBe("{fictional-invalid");
  storeLibrary(localStorage, emptyLibrary);
  act(() => {
    result.current.reload();
  });
  expect(result.current.blocked).toBe(false);
  expect(result.current.library).toEqual(emptyLibrary);
});

it("blocks initial read denial and can recover after permission returns without writing", () => {
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError");
  });
  const { result } = renderHook(useVideoStorage);
  expect(result.current.blocked).toBe(true);
  act(() => {
    expect(result.current.persist(fixture)).toBe(false);
  });
  get.mockRestore();
  const write = vi.spyOn(Storage.prototype, "setItem");
  act(() => {
    expect(result.current.reload()).toBe(true);
  });
  expect(write).not.toHaveBeenCalled();
  expect(result.current.blocked).toBe(false);
});

it("handles storage access denial after mounting, including the window.localStorage getter", () => {
  const { result } = renderHook(useVideoStorage);
  const access = vi
    .spyOn(window, "localStorage", "get")
    .mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: VIDEO_KEY,
        storageArea: sessionStorage,
      }),
    );
  });
  expect(result.current.blocked).toBe(true);
  act(() => {
    expect(result.current.reload()).toBe(false);
  });
  access.mockRestore();
  act(() => {
    result.current.reload();
  });
  expect(result.current.blocked).toBe(false);
});

it("retains the source and screen after quota failure and allows retry after space returns", () => {
  const { result } = renderHook(useVideoStorage);
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("quota", "QuotaExceededError");
  });
  act(() => {
    expect(result.current.persist(fixture)).toBe(false);
  });
  expect(result.current.library).toEqual(emptyLibrary);
  expect(localStorage.getItem(VIDEO_KEY)).toBeNull();
  expect(result.current.error).toContain("儲存失敗");
  expect(result.current.blocked).toBe(false);
  set.mockRestore();
  act(() => {
    expect(result.current.persist(fixture)).toBe(true);
  });
  expect(result.current.error).toBe("");
});

it("refreshes readonly candidates, recovers from bad content and refuses every write", () => {
  const { result } = renderHook(() => useVideoStorage({ readOnly: true }));
  storeLibrary(localStorage, fixture);
  const raw = localStorage.getItem(VIDEO_KEY);
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: VIDEO_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  expect(result.current.library).toEqual(fixture);
  act(() => expect(result.current.persist(emptyLibrary)).toBe(false));
  expect(localStorage.getItem(VIDEO_KEY)).toBe(raw);
  localStorage.setItem(VIDEO_KEY, "{fictional-bad");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: VIDEO_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  expect(result.current.library).toEqual(fixture);
  expect(result.current.blocked).toBe(true);
  localStorage.setItem(VIDEO_KEY, raw!);
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: VIDEO_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  expect(result.current.blocked).toBe(false);
});
