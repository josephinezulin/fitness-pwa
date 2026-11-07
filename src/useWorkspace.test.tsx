// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "./useWorkspace";
import { testInspection, testSource, TEST_TIME } from "./test-fixtures";
import { outboxKey, readOutbox } from "./outbox";
import { SyncConflictError } from "./sheets-write";
import { snapshotKey, LOCAL_KEY } from "./workspace";
const mock = vi.hoisted(() => ({ write: vi.fn(), inspect: vi.fn() }));
vi.mock("./sheets", async (original) => ({
  ...(await original<typeof import("./sheets")>()),
  inspectSpreadsheet: mock.inspect,
}));
vi.mock("./sheets-write", async (original) => ({
  ...(await original<typeof import("./sheets-write")>()),
  writeCloudOperation: mock.write,
}));
const identity = {
  subject: "A",
  spreadsheetId: "sheet-private-1",
  title: "私人表",
  timezone: "Asia/Taipei",
  checkedAt: TEST_TIME,
};
const auth = {
  subject: "A",
  email: "test@example.com",
  expiresAt: Date.now() + 3600000,
  accessToken: "must-never-persist",
};
const workout = {
  id: "w1",
  date: "2026-11-06",
  type: "home" as const,
  minutes: 20,
  calories: 0,
  note: "離線運動",
};
function online(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  online(false);
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn((_key, _options, callback) =>
        Promise.resolve(callback({ name: "editor" })),
      ),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function connect(
  result: { current: ReturnType<typeof useWorkspace> },
  account = identity,
) {
  const inspection = testInspection();
  act(() => {
    result.current.setGoogleSession({ ...auth, subject: account.subject });
    result.current.activateCloud(account, inspection.data!, inspection.source);
  });
  await waitFor(() => expect(result.current.canEditCloud).toBe(true));
}
describe("local storage version protection", () => {
  const changedData = () => ({
    version: 1 as const,
    metrics: [],
    workouts: [{ ...workout, id: "other-tab", note: "虛構其他分頁紀錄" }],
  });
  const storageEvent = (
    key: string | null = LOCAL_KEY,
    storageArea: Storage = localStorage,
  ) => window.dispatchEvent(new StorageEvent("storage", { key, storageArea }));
  it("rejects a stale save before any storage event and resumes only after an explicit refresh", () => {
    const { result } = renderHook(() => useWorkspace());
    const restore = result.current.prepareLocalRestore();
    const latest = changedData();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(latest));
    act(() => {
      expect(() =>
        result.current.save({ ...result.current.data, workouts: [workout] }),
      ).toThrow(/其他分頁/);
    });
    expect(result.current.localChanged).toBe(true);
    expect(result.current.canEditCloud).toBe(false);
    expect(result.current.data.workouts).toEqual([]);
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!)).toEqual(latest);
    act(() => result.current.refreshLocal());
    expect(result.current.data.workouts).toEqual(latest.workouts);
    expect(result.current.localChanged).toBe(false);
    expect(result.current.canEditCloud).toBe(true);
    expect(() => restore.check()).toThrow(/已變更/);
    act(() =>
      result.current.save({
        ...result.current.data,
        workouts: [...result.current.data.workouts, workout],
      }),
    );
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!).workouts).toHaveLength(
      2,
    );
  });
  it("ignores unrelated or session storage events and keeps the old view for an actual local change", () => {
    const { result } = renderHook(() => useWorkspace());
    localStorage.setItem(LOCAL_KEY, JSON.stringify(changedData()));
    act(() => storageEvent("unrelated-device-preference"));
    act(() => storageEvent(LOCAL_KEY, sessionStorage));
    expect(result.current.localChanged).toBe(false);
    act(() => storageEvent());
    expect(result.current.localChanged).toBe(true);
    expect(result.current.data.workouts).toEqual([]);
    expect(() => result.current.prepareLocalRestore()).toThrow(/其他分頁/);
  });
  it("detects changes on a visible foreground event without background polling", () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    const { result } = renderHook(() => useWorkspace());
    localStorage.setItem(LOCAL_KEY, JSON.stringify(changedData()));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.localChanged).toBe(false);
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.localChanged).toBe(true);
  });
  it("preserves a cleared store until refreshing and never silently recreates removed records", () => {
    const { result } = renderHook(() => useWorkspace());
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    localStorage.removeItem(LOCAL_KEY);
    act(() => storageEvent(null));
    expect(result.current.data.workouts).toHaveLength(1);
    expect(result.current.canEditCloud).toBe(false);
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
    act(() => result.current.refreshLocal());
    expect(result.current.data.workouts).toEqual([]);
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
    expect(result.current.canEditCloud).toBe(true);
  });
  it("does not clear the current view or overwrite malformed contents when refresh fails", () => {
    const { result } = renderHook(() => useWorkspace());
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    localStorage.setItem(LOCAL_KEY, "{fictional-invalid");
    act(() => storageEvent());
    act(() => result.current.refreshLocal());
    expect(result.current.data.workouts).toEqual([workout]);
    expect(result.current.storageError).toContain("尚未覆蓋");
    expect(result.current.localChanged).toBe(true);
    expect(localStorage.getItem(LOCAL_KEY)).toBe("{fictional-invalid");
    localStorage.setItem(LOCAL_KEY, JSON.stringify(changedData()));
    act(() => result.current.refreshLocal());
    expect(result.current.storageError).toBe("");
    expect(result.current.canEditCloud).toBe(true);
    expect(result.current.data.workouts[0].id).toBe("other-tab");
  });
  it("keeps the last valid view when storage access fails and removes observers on unmount", () => {
    const { result, unmount } = renderHook(() => useWorkspace());
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    const getter = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw Error("fictional blocked storage");
      });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.storageError).toContain("無法確認");
    act(() => result.current.refreshLocal());
    expect(result.current.data.workouts).toEqual([workout]);
    expect(result.current.localChanged).toBe(true);
    getter.mockRestore();
    act(() => result.current.refreshLocal());
    const remove = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
  });
  it("does not change a cloud workspace and rereads the latest local content on disconnect", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(changedData()));
    act(() => storageEvent());
    act(() => result.current.refreshLocal());
    expect(result.current.localChanged).toBe(false);
    expect(result.current.cloud?.subject).toBe(identity.subject);
    expect(result.current.canEditCloud).toBe(true);
    act(() => result.current.disconnectCloud());
    expect(result.current.localChanged).toBe(false);
    expect(result.current.data.workouts[0].id).toBe("other-tab");
    act(() =>
      result.current.save({
        ...result.current.data,
        workouts: [...result.current.data.workouts, workout],
      }),
    );
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!).workouts).toHaveLength(
      2,
    );
    expect(readOutbox(localStorage, identity)).toEqual([]);
    await connect(result);
    localStorage.setItem(LOCAL_KEY, "{fictional-invalid");
    act(() => result.current.disconnectCloud());
    expect(result.current.localChanged).toBe(true);
    expect(result.current.canEditCloud).toBe(false);
    expect(result.current.storageError).toContain("尚未覆蓋");
    localStorage.setItem(LOCAL_KEY, JSON.stringify(changedData()));
    act(() => result.current.refreshLocal());
    expect(result.current.canEditCloud).toBe(true);
    expect(result.current.data.workouts[0].id).toBe("other-tab");
  });
});
describe("cloud workspace lifecycle", () => {
  it("only applies a local restore to its original unchanged local snapshot", () => {
    const { result } = renderHook(() => useWorkspace());
    const first = result.current.prepareLocalRestore();
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    expect(() =>
      first.apply({ version: 1, workouts: [], metrics: [] }),
    ).toThrow(/已變更/);
    expect(result.current.data.workouts).toEqual([workout]);
    const second = result.current.prepareLocalRestore();
    const fromOtherTab = {
      ...result.current.data,
      workouts: [{ ...workout, id: "other-tab" }],
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(fromOtherTab));
    expect(() =>
      second.apply({ version: 1, workouts: [], metrics: [] }),
    ).toThrow(/已變更/);
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!)).toEqual(fromOtherTab);
  });
  it("invalidates local restore handles across cloud and back, and never queues them for the cloud", async () => {
    const { result } = renderHook(() => useWorkspace());
    const handle = result.current.prepareLocalRestore();
    await connect(result);
    expect(() => result.current.prepareLocalRestore()).toThrow(/本機模式/);
    expect(() =>
      handle.apply({ version: 1, workouts: [workout], metrics: [] }),
    ).toThrow(/已變更/);
    expect(readOutbox(localStorage, identity)).toEqual([]);
    act(() => result.current.disconnectCloud());
    expect(() => handle.check()).toThrow(/已變更/);
  });
  it("commits a valid current local restore and invalidates its handle on unmount", () => {
    const { result, unmount } = renderHook(() => useWorkspace());
    const handle = result.current.prepareLocalRestore();
    act(() => handle.apply({ version: 1, workouts: [workout], metrics: [] }));
    expect(result.current.data.workouts).toEqual([workout]);
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!).workouts).toEqual([
      workout,
    ]);
    const pending = result.current.prepareLocalRestore();
    unmount();
    expect(() => pending.check()).toThrow(/已變更/);
  });
  it("keeps health-sync metadata memory-only and clears it across account/cache/local transitions", async () => {
    const { result } = renderHook(() => useWorkspace());
    const source = testSource();
    source.grids.SyncLogs.push([
      "private-request-marker",
      "private-device-marker",
      TEST_TIME,
      "2026-11-01T00:00:00Z",
      TEST_TIME,
      "committed",
      3,
      0,
      "",
    ]);
    const inspection = testInspection(source);
    act(() => {
      result.current.setGoogleSession(auth);
      result.current.activateCloud(identity, inspection.data!, source);
    });
    await waitFor(() => expect(result.current.canEditCloud).toBe(true));
    expect(result.current.healthSync?.lastSuccess?.acceptedCount).toBe(3);
    const serialized = localStorage.getItem(snapshotKey(identity))!;
    expect(serialized).not.toContain("private-request-marker");
    expect(serialized).not.toContain("private-device-marker");
    expect(serialized).not.toContain("lastSuccess");
    await connect(result, { ...identity, subject: "B" });
    expect(result.current.healthSync).toEqual({
      latest: null,
      lastSuccess: null,
    });
    act(() => result.current.activateCloud(identity, inspection.data!));
    expect(result.current.healthSync).toBeNull();
    act(() => result.current.disconnectCloud());
    expect(result.current.healthSync).toBeNull();
  });
  it("coalesces offline plan edits in order and isolates them by Google account", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    const first = result.current.data.plans![0];
    const disabled = result.current.data.plans!.map((p) =>
      p.id === first.id ? { ...p, active: false } : p,
    );
    const addition = { ...first, id: "new-plan", title: "新課表" };
    act(() => result.current.save({ ...result.current.data, plans: disabled }));
    act(() =>
      result.current.save({
        ...result.current.data,
        plans: [...disabled, addition],
      }),
    );
    act(() =>
      result.current.save({
        ...result.current.data,
        plans: [
          ...disabled.map((p) =>
            p.id === first.id ? { ...p, title: "停用保留" } : p,
          ),
          addition,
        ],
      }),
    );
    const queue = readOutbox(localStorage, identity);
    expect(queue.map((p) => p.id)).toEqual([first.id, addition.id]);
    expect(queue[0].base).toMatchObject({ active: true });
    expect(queue[0].value).toMatchObject({ active: false, title: "停用保留" });
    expect(() =>
      result.current.save({ ...result.current.data, plans: [] }),
    ).toThrow("停用課表");
    await connect(result, { ...identity, subject: "B" });
    expect(result.current.pending).toEqual([]);
    expect(result.current.data.plans?.[0].title).toBe("預設課表");
  });
  it.each([true, false])(
    "retains an offline plan when its remote slot is occupied (cache present: %s)",
    async (cached) => {
      const { result } = renderHook(() => useWorkspace());
      await connect(result);
      const p = {
        ...result.current.data.plans![0],
        id: "offline-plan",
        weekday: 2,
        title: "離線瑜伽",
        type: "yoga" as const,
      };
      act(() =>
        result.current.save({
          ...result.current.data,
          plans: [...result.current.data.plans!, p],
        }),
      );
      if (!cached) localStorage.removeItem(snapshotKey(identity));
      const remote = testSource();
      remote.grids.WorkoutPlans.push([
        "remote-plan",
        2,
        "yoga",
        "另一個裝置",
        20,
        30,
        "",
        true,
        TEST_TIME,
      ]);
      const inspection = testInspection(remote);
      act(() =>
        result.current.activateCloud(
          identity,
          inspection.data!,
          inspection.source,
        ),
      );
      expect(result.current.pending[0].state).toBe("conflict");
      expect(result.current.canEditCloud).toBe(false);
      expect(result.current.data.plans?.find((x) => x.id === p.id)?.title).toBe(
        "離線瑜伽",
      );
      expect(result.current.syncError).toContain("課表");
      mock.inspect.mockResolvedValueOnce(inspection);
      await act(async () => {
        online(true);
        await result.current.discardPending();
      });
      expect(result.current.pending).toEqual([]);
      expect(
        result.current.data.plans?.some((x) => x.id === "remote-plan"),
      ).toBe(true);
    },
  );
  it("stops the remaining queue if a newly read plan conflicts after another write is confirmed", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    const p = {
      ...result.current.data.plans![0],
      id: "offline-plan",
      weekday: 2,
      type: "yoga" as const,
    };
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    act(() =>
      result.current.save({
        ...result.current.data,
        plans: [...result.current.data.plans!, p],
      }),
    );
    const source = testSource();
    source.grids.WorkoutLogs.push([
      workout.id,
      workout.date,
      identity.timezone,
      workout.type,
      workout.minutes,
      0,
      workout.note,
      "pwa",
      1,
      TEST_TIME,
      "",
    ]);
    source.grids.WorkoutPlans.push([
      "remote-plan",
      2,
      "yoga",
      "另一個裝置",
      20,
      30,
      "",
      true,
      TEST_TIME,
    ]);
    mock.write.mockResolvedValueOnce(testInspection(source));
    online(true);
    await act(async () => result.current.retrySync());
    expect(mock.write).toHaveBeenCalledTimes(1);
    expect(readOutbox(localStorage, identity)).toHaveLength(1);
    expect(result.current.pending[0]).toMatchObject({
      kind: "plan",
      state: "conflict",
    });
    expect(result.current.data.workouts).toEqual([workout]);
    expect(result.current.data.plans?.some((x) => x.id === p.id)).toBe(true);
  });
  it("retains conflicts until a fresh remote read permits explicitly adopting cloud content", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    online(true);
    mock.write.mockRejectedValueOnce(new SyncConflictError(workout.id));
    await act(async () => result.current.retrySync());
    expect(result.current.pending[0].state).toBe("conflict");
    mock.inspect.mockRejectedValueOnce(new Error("network failed"));
    await act(async () => result.current.discardPending());
    expect(readOutbox(localStorage, identity)).toHaveLength(1);
    mock.inspect.mockResolvedValueOnce(testInspection());
    await act(async () => result.current.discardPending());
    expect(result.current.pending).toEqual([]);
    expect(result.current.data.workouts).toEqual([]);
  });
  it("durably queues offline edits and coalesces them without touching local mode", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    act(() =>
      result.current.save({
        ...result.current.data,
        workouts: [{ ...workout, minutes: 30 }],
      }),
    );
    const queue = readOutbox(localStorage, identity);
    expect(queue).toHaveLength(1);
    expect(queue[0].value).toMatchObject({ minutes: 30 });
    expect(mock.write).not.toHaveBeenCalled();
    expect(localStorage.getItem("daily-movement-v1")).toBeNull();
    expect(localStorage.getItem(outboxKey(identity))).not.toContain(
      auth.accessToken,
    );
  });
  it("restores pending intent after reconnect while isolating another account", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    act(() => result.current.disconnectCloud());
    await connect(result, { ...identity, subject: "B" });
    expect(result.current.data.workouts).toEqual([]);
    act(() => result.current.disconnectCloud());
    await connect(result);
    expect(result.current.data.workouts).toHaveLength(1);
  });
  it("confirms uncertain writes on retry without letting their intent change", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    mock.write.mockRejectedValueOnce(new TypeError("lost response"));
    online(true);
    await act(async () => result.current.retrySync());
    expect(readOutbox(localStorage, identity)[0].state).toBe("uncertain");
    expect(result.current.canEditCloud).toBe(false);
    expect(() =>
      result.current.save({ ...result.current.data, workouts: [] }),
    ).toThrow();
    const source = testSource();
    source.grids.WorkoutLogs.push([
      workout.id,
      workout.date,
      identity.timezone,
      workout.type,
      workout.minutes,
      0,
      workout.note,
      "pwa",
      1,
      TEST_TIME,
      "",
    ]);
    mock.write.mockResolvedValueOnce(testInspection(source));
    await act(async () => result.current.retrySync());
    expect(result.current.pending).toEqual([]);
    expect(result.current.data.workouts[0].id).toBe("w1");
  });
  it("ignores a delayed old-account write response and preserves its queue", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    act(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    );
    let finish!: (value: ReturnType<typeof testInspection>) => void;
    mock.write.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    online(true);
    let promise: Promise<void>;
    act(() => {
      promise = result.current.retrySync();
    });
    await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(1));
    act(() => result.current.disconnectCloud());
    online(false);
    await connect(result, { ...identity, subject: "B" });
    await act(async () => {
      finish(testInspection());
      await promise!;
    });
    expect(result.current.cloud?.subject).toBe("B");
    expect(result.current.data.workouts).toEqual([]);
    expect(readOutbox(localStorage, identity)).toHaveLength(1);
    expect(mock.write.mock.calls[0][4].aborted).toBe(true);
  });
  it("keeps a second tab read-only when the editor lock is already held", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn((_key, _options, callback) =>
          Promise.resolve(callback(null)),
        ),
      },
    });
    const { result } = renderHook(() => useWorkspace());
    const inspection = testInspection();
    act(() => {
      result.current.setGoogleSession(auth);
      result.current.activateCloud(
        identity,
        inspection.data!,
        inspection.source,
      );
    });
    await waitFor(() =>
      expect(result.current.syncError).toContain("另一個分頁"),
    );
    expect(result.current.canEditCloud).toBe(false);
    expect(() =>
      result.current.save({ ...result.current.data, workouts: [workout] }),
    ).toThrow();
  });
  it("blocks health overwrites and leaves corrupted pending data untouched", async () => {
    const { result } = renderHook(() => useWorkspace());
    await connect(result);
    expect(() =>
      result.current.save({
        ...result.current.data,
        metrics: [{ id: "m", date: "2026-11-06", weight: 68 }],
      }),
    ).toThrow("健康資料");
    act(() => result.current.disconnectCloud());
    localStorage.setItem(outboxKey(identity), "{corrupt");
    const inspection = testInspection();
    act(() =>
      result.current.activateCloud(
        identity,
        inspection.data!,
        inspection.source,
      ),
    );
    expect(result.current.storageError).toContain("原始內容已保留");
    expect(localStorage.getItem(outboxKey(identity))).toBe("{corrupt");
  });
});
