// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBackupRestore } from "./useBackupRestore";
import { defaultPreferences, preferenceKey } from "./preferences";
import { VIDEO_KEY, emptyLibrary } from "./videos";

const backup = (note = "虛構還原") => ({
  version: 1,
  workouts: [
    {
      id: "fictional-backup",
      date: "2026-01-01",
      type: "home",
      minutes: 20,
      calories: 0,
      note,
    },
  ],
  metrics: [],
  videoLibrary: emptyLibrary,
  experience: { ...defaultPreferences, weeklyGoal: 90 },
});
function pendingFile() {
  let resolve!: (text: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  const file = new File(["fictional"], "fictional-backup.json", {
    type: "application/json",
  });
  const read = vi.fn(() => promise);
  Object.defineProperty(file, "text", { value: read });
  return { file, read, resolve };
}
function setup() {
  const target = { check: vi.fn(), apply: vi.fn() };
  const options = {
    scopeKey: "local",
    prepare: vi.fn(() => target),
    onLibraryRestored: vi.fn(),
    onPreferencesRestored: vi.fn(() => true),
    onMessage: vi.fn(),
  };
  const hook = renderHook((props) => useBackupRestore(props), {
    initialProps: options,
  });
  return { ...hook, target, options };
}
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("backup file lifecycle", () => {
  it("checks a valid backup, confirms once and restores data, library and preferences", async () => {
    const { result, target, options } = setup();
    const file = pendingFile();
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.restore(file.file);
    });
    expect(result.current.busy).toBe(true);
    expect(target.apply).not.toHaveBeenCalled();
    await act(async () => {
      file.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(target.check).toHaveBeenCalled();
    expect(target.apply).toHaveBeenCalledWith(
      expect.objectContaining({ workouts: backup().workouts }),
    );
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(VIDEO_KEY)!)).toEqual(emptyLibrary);
    expect(options.onLibraryRestored).toHaveBeenCalledOnce();
    expect(options.onPreferencesRestored).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyGoal: 90 }),
    );
    expect(options.onMessage).toHaveBeenLastCalledWith("已成功還原資料");
    expect(result.current.busy).toBe(false);
  });
  it("can cancel a read without a later confirmation or write", async () => {
    const { result, target, options } = setup();
    const file = pendingFile();
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.restore(file.file);
    });
    act(() => result.current.cancel());
    await act(async () => {
      file.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(target.apply).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(options.onMessage).toHaveBeenLastCalledWith(
      "已取消讀取備份，現有資料未變更。",
    );
    expect(result.current.busy).toBe(false);
  });
  it.each([true, false])(
    "only the latest selected file may finish (older finishes first: %s)",
    async (olderFirst) => {
      const { result, target, options } = setup();
      const older = pendingFile(),
        newer = pendingFile();
      let first!: Promise<void>, second!: Promise<void>;
      act(() => {
        first = result.current.restore(older.file);
      });
      act(() => {
        second = result.current.restore(newer.file);
      });
      if (olderFirst) {
        await act(async () => {
          older.resolve(JSON.stringify(backup("舊選擇")));
          await first;
        });
        expect(result.current.busy).toBe(true);
        expect(target.apply).not.toHaveBeenCalled();
      }
      await act(async () => {
        newer.resolve(JSON.stringify(backup("新選擇")));
        await second;
      });
      if (!olderFirst)
        await act(async () => {
          older.resolve(JSON.stringify(backup("舊選擇")));
          await first;
        });
      expect(target.apply).toHaveBeenCalledOnce();
      expect(target.apply.mock.calls[0][0].workouts[0].note).toBe("新選擇");
      expect(options.onMessage).toHaveBeenLastCalledWith("已成功還原資料");
      expect(result.current.busy).toBe(false);
    },
  );
  it("cancels a read immediately on workspace changes and on unmount", async () => {
    const { result, target, options, rerender, unmount } = setup();
    const file = pendingFile();
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.restore(file.file);
    });
    rerender({ ...options, scopeKey: "account-a:file-a" });
    expect(result.current.busy).toBe(false);
    expect(options.onMessage).toHaveBeenLastCalledWith(
      "工作區已切換，備份讀取已取消，現有資料未變更。",
    );
    await act(async () => {
      file.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(target.apply).not.toHaveBeenCalled();
    const second = pendingFile();
    act(() => {
      operation = result.current.restore(second.file);
    });
    options.onMessage.mockClear();
    unmount();
    await act(async () => {
      second.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(target.apply).not.toHaveBeenCalled();
    expect(options.onMessage).not.toHaveBeenCalled();
  });
  it.each([VIDEO_KEY, preferenceKey(null)])(
    "preserves edits made to %s during a file read",
    async (key) => {
      const { result, target, options } = setup();
      const file = pendingFile();
      let operation!: Promise<void>;
      act(() => {
        operation = result.current.restore(file.file);
      });
      localStorage.setItem(key, "newer-device-value");
      await act(async () => {
        file.resolve(JSON.stringify(backup()));
        await operation;
      });
      expect(target.apply).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
      expect(localStorage.getItem(key)).toBe("newer-device-value");
      expect(options.onMessage).toHaveBeenLastCalledWith(
        expect.stringContaining("已變更"),
      );
    },
  );
  it("checks again after confirmation before applying anything", async () => {
    const { result, target } = setup();
    vi.mocked(window.confirm).mockImplementation(() => {
      localStorage.setItem(VIDEO_KEY, "changed-during-confirm");
      return true;
    });
    const file = pendingFile();
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.restore(file.file);
    });
    await act(async () => {
      file.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(target.apply).not.toHaveBeenCalled();
    expect(localStorage.getItem(VIDEO_KEY)).toBe("changed-during-confirm");
  });
  it("does not apply a declined, invalid or oversized backup", async () => {
    const { result, target, options } = setup();
    const declined = pendingFile();
    vi.mocked(window.confirm).mockReturnValue(false);
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.restore(declined.file);
    });
    await act(async () => {
      declined.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(target.apply).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockClear();
    const invalid = pendingFile();
    act(() => {
      operation = result.current.restore(invalid.file);
    });
    await act(async () => {
      invalid.resolve("invalid-json");
      await operation;
    });
    expect(options.onMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("無法還原"),
    );
    const large = pendingFile();
    Object.defineProperty(large.file, "size", { value: 10_000_001 });
    await act(async () => {
      await result.current.restore(large.file);
    });
    expect(large.read).not.toHaveBeenCalled();
    expect(target.apply).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(options.onMessage).toHaveBeenLastCalledWith(
      "無法還原：檔案超過 10 MB",
    );
  });
  it("reports partial completion if video storage fails after data is applied", async () => {
    const { result, target, options } = setup();
    const nativeSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === VIDEO_KEY)
        throw new DOMException("fixture quota", "QuotaExceededError");
      return nativeSet.call(this, key, value);
    });
    const file = pendingFile();
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.restore(file.file);
    });
    await act(async () => {
      file.resolve(JSON.stringify(backup()));
      await operation;
    });
    expect(target.apply).toHaveBeenCalledOnce();
    expect(options.onPreferencesRestored).not.toHaveBeenCalled();
    expect(options.onMessage).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "運動與健康紀錄已還原；影片清單或裝置偏好尚未完成",
      ),
    );
    expect(result.current.busy).toBe(false);
  });
});
