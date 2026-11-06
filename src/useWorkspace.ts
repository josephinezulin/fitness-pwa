import { useCallback, useEffect, useRef, useState } from "react";
import { validate, type Data } from "./model";
import {
  LOCAL_KEY,
  readLocal,
  snapshotKey,
  storeSnapshot,
  type CloudIdentity,
} from "./workspace";
import type { GoogleSession } from "./google";
import {
  GoogleAccessError,
  inspectSpreadsheet,
  type SheetSource,
} from "./sheets";
import {
  remoteWorkouts,
  remoteVideos,
  sameWorkout,
  sameVideo,
  SyncConflictError,
  writeCloudOperation,
} from "./sheets-write";
import {
  readOutbox,
  storeOutbox,
  overlayOutbox,
  type PendingOperation,
} from "./outbox";

export function useWorkspace() {
  const [initial] = useState(() => readLocal(localStorage));
  const [data, setData] = useState(initial.data);
  const [cloud, setCloud] = useState<CloudIdentity | null>(null);
  const [storageError, setStorageError] = useState(initial.error);
  const [pending, setPending] = useState<PendingOperation[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [lockReady, setLockReady] = useState(false);
  const current = useRef<{
    identity: CloudIdentity;
    data: Data;
    source?: SheetSource;
  } | null>(null);
  const display = useRef(data);
  const session = useRef<GoogleSession | null>(null);
  const epoch = useRef(0),
    running = useRef(false),
    ownsLock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const cloudKey = cloud ? snapshotKey(cloud) : "";
  const show = (next: Data) => {
    display.current = next;
    setData(next);
  };
  const cancel = () => {
    epoch.current++;
    request.current?.abort();
    running.current = false;
    setSyncBusy(false);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };
  const setGoogleSession = useCallback((next: GoogleSession | null) => {
    if (session.current?.subject !== next?.subject) cancel();
    session.current = next;
  }, []);
  function cache(identity: CloudIdentity, next: Data) {
    try {
      storeSnapshot(localStorage, identity, next);
      setStorageError("");
    } catch {
      setStorageError("雲端資料已讀取，但裝置快取儲存失敗；請先匯出備份。");
    }
  }
  const flush = useCallback(async () => {
    if (
      running.current ||
      !ownsLock.current ||
      !navigator.onLine ||
      !current.current
    )
      return;
    const owner = current.current.identity,
      auth = session.current;
    if (!auth || auth.subject !== owner.subject || auth.expiresAt <= Date.now())
      return;
    const version = epoch.current;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    const controller = new AbortController();
    request.current = controller;
    running.current = true;
    setSyncBusy(true);
    setSyncError("");
    const valid = () =>
      epoch.current === version &&
      current.current &&
      snapshotKey(current.current.identity) === snapshotKey(owner);
    try {
      let queue = readOutbox(localStorage, owner);
      while (queue.length && valid()) {
        let op = queue[0];
        if (op.state === "conflict") {
          setSyncError(
            "有資料衝突，待同步內容已保留；請先匯出備份，再選擇採用雲端內容。",
          );
          break;
        }
        // Persist uncertainty BEFORE sending. A reload may not change this intent until verified.
        op = { ...op, state: "uncertain" };
        queue = [op, ...queue.slice(1)];
        storeOutbox(localStorage, owner, queue);
        setPending(queue);
        let result;
        try {
          result = await writeCloudOperation(
            owner.spreadsheetId,
            owner.subject,
            op,
            auth,
            controller.signal,
          );
        } catch (error) {
          if (valid() && error instanceof SyncConflictError) {
            queue = [{ ...op, state: "conflict" }, ...queue.slice(1)];
            storeOutbox(localStorage, owner, queue);
            setPending(queue);
          }
          throw error;
        }
        if (!valid()) return;
        queue = queue.slice(1);
        storeOutbox(localStorage, owner, queue);
        const identity = {
          ...owner,
          checkedAt: result.checkedAt,
          title: result.title,
          timezone: result.timezone,
        };
        current.current = {
          identity,
          data: result.data!,
          source: result.source,
        };
        const visible = overlayOutbox(result.data!, queue);
        cache(identity, visible);
        show(visible);
        setPending(queue);
        setCloud(identity);
      }
      retryCount.current = 0;
    } catch (error) {
      if (!valid()) return;
      setSyncError(
        error instanceof SyncConflictError
          ? error.message
          : "尚未確認同步，內容已保留。" +
              (error instanceof GoogleAccessError && error.status === 401
                ? "請重新登入 Google 後重試。"
                : error instanceof Error &&
                    /^(請先升級試算表|試算表格式|寫入內容|沒有分段|運動時區)/.test(
                      error.message,
                    )
                  ? error.message
                  : "可稍後按「重試同步」。"),
      );
      const retryable =
        !(error instanceof SyncConflictError) &&
        (!(error instanceof GoogleAccessError) ||
          error.status === 429 ||
          error.status >= 500);
      if (retryable && retryCount.current < 4) {
        const delay = Math.min(300000, 30000 * 2 ** retryCount.current++);
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          void flush();
        }, delay);
      }
    } finally {
      if (valid()) {
        running.current = false;
        setSyncBusy(false);
      }
    }
  }, []);
  useEffect(() => {
    if (!cloudKey) {
      ownsLock.current = false;
      setLockReady(false);
      return;
    }
    let active = true,
      release: (() => void) | undefined;
    ownsLock.current = false;
    setLockReady(false);
    if (!navigator.locks) {
      setSyncError(
        "目前瀏覽器無法安全協調同步，請更新 iOS／Safari；仍可唯讀查看與匯出。",
      );
      return;
    }
    void navigator.locks
      .request(
        `fitness-editor:${cloudKey}`,
        { ifAvailable: true },
        async (lock) => {
          if (!active) return;
          if (!lock) {
            setSyncError(
              "這份試算表已在另一個分頁編輯，請先關閉另一個分頁；目前可唯讀查看。",
            );
            return;
          }
          ownsLock.current = true;
          setLockReady(true);
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      )
      .catch(() => {
        if (active) setSyncError("無法取得編輯權，請重新開啟 PWA。");
      });
    return () => {
      active = false;
      ownsLock.current = false;
      release?.();
    };
  }, [cloudKey]);
  useEffect(() => {
    if (lockReady) void flush();
  }, [lockReady, pending.length, flush]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [flush]);
  useEffect(
    () => () => {
      epoch.current++;
      request.current?.abort();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  function save(next: Data) {
    if (storageError)
      throw Error("裝置儲存發生錯誤，請先匯出備份並處理後重試。");
    const safe = validate(next),
      active = current.current;
    if (!active) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
      show(safe);
      return;
    }
    if (!ownsLock.current || !active.source || running.current)
      throw Error("目前無法編輯，請等候同步或重新開啟 PWA。");
    if (
      JSON.stringify(safe.metrics) !== JSON.stringify(display.current.metrics)
    )
      throw Error("雲端健康資料由 Apple 健康同步，不能在這裡覆蓋。");
    let queue = readOutbox(localStorage, active.identity);
    if (queue.some((o) => o.state !== "pending"))
      throw Error("請先確認上次同步結果，再編輯新內容；待同步紀錄已保留。");
    const workouts = remoteWorkouts(active.source),
      videos = remoteVideos(active.source);
    for (const kind of ["workout", "video"] as const) {
      const before =
        kind === "workout"
          ? display.current.workouts
          : display.current.videos || [];
      const after = kind === "workout" ? safe.workouts : safe.videos || [];
      for (const id of new Set([
        ...before.map((x) => x.id),
        ...after.map((x) => x.id),
      ])) {
        const previous = before.find((x) => x.id === id),
          value = after.find((x) => x.id === id) || null;
        const equal =
          kind === "workout"
            ? sameWorkout(
                previous as Data["workouts"][number],
                value as Data["workouts"][number],
              )
            : sameVideo(
                previous as NonNullable<Data["videos"]>[number],
                value as NonNullable<Data["videos"]>[number],
              );
        if (equal) continue;
        const old = queue.find((o) => o.kind === kind && o.id === id);
        const base = old
          ? old.base
          : (kind === "workout" ? workouts : videos).find((x) => x.id === id) ||
            null;
        queue = queue.filter((o) => o.kind !== kind || o.id !== id);
        if (!base && !value) continue;
        queue.push({
          kind,
          id,
          base,
          value,
          operationId: crypto.randomUUID(),
          timezone: active.identity.timezone,
          state: "pending",
        } as PendingOperation);
      }
    }
    // Durable queue is required before any optimistic success is shown.
    storeOutbox(localStorage, active.identity, queue);
    setPending(queue);
    show(safe);
    cache(active.identity, safe);
    setSyncError("");
    void flush();
  }
  function activateCloud(
    identity: CloudIdentity,
    next: Data,
    source?: SheetSource,
  ) {
    if (
      running.current &&
      current.current &&
      snapshotKey(identity) === snapshotKey(current.current.identity)
    )
      return;
    if (
      !current.current ||
      snapshotKey(current.current.identity) !== snapshotKey(identity)
    ) {
      cancel();
      ownsLock.current = false;
      setLockReady(false);
    }
    let queue: PendingOperation[] = [];
    try {
      queue = readOutbox(localStorage, identity);
      setSyncError("");
    } catch (error) {
      setStorageError((error as Error).message);
      current.current = { identity, data: validate(next) };
      show(validate(next));
      setCloud(identity);
      setPending([]);
      return;
    }
    const visible = overlayOutbox(validate(next), queue);
    current.current = { identity, data: validate(next), source };
    cache(identity, visible);
    show(visible);
    setCloud(identity);
    setPending(queue);
  }
  function disconnectCloud() {
    cancel();
    current.current = null;
    ownsLock.current = false;
    const local = readLocal(localStorage);
    show(local.data);
    setCloud(null);
    setPending([]);
    setStorageError(local.error);
    setSyncError("");
  }
  async function discardPending() {
    if (
      !current.current ||
      !ownsLock.current ||
      running.current ||
      !session.current ||
      session.current.subject !== current.current.identity.subject ||
      !navigator.onLine
    )
      return;
    // Refresh remote first; do not throw away a local intent until the server is readable.
    const active = current.current,
      version = epoch.current;
    const controller = new AbortController();
    request.current = controller;
    running.current = true;
    setSyncBusy(true);
    try {
      const result = await inspectSpreadsheet(
        active.identity.spreadsheetId,
        session.current,
        controller.signal,
      );
      if (version !== epoch.current) return;
      if (!result.report.ok || !result.data || !result.source) throw Error();
      storeOutbox(localStorage, active.identity, []);
      running.current = false;
      activateCloud(
        { ...active.identity, checkedAt: result.checkedAt },
        result.data,
        result.source,
      );
    } catch {
      if (version === epoch.current)
        setSyncError("尚未讀到雲端最新內容，待同步資料已保留。");
    } finally {
      if (version === epoch.current) {
        running.current = false;
        setSyncBusy(false);
      }
    }
  }
  const canEditCloud =
    !cloud ||
    (!!current.current?.source &&
      session.current?.subject === cloud.subject &&
      lockReady &&
      !syncBusy &&
      !storageError &&
      !pending.some((o) => o.state !== "pending"));
  return {
    data,
    cloud,
    storageError,
    save,
    activateCloud,
    disconnectCloud,
    setGoogleSession,
    pending,
    syncBusy,
    syncError,
    canEditCloud,
    retrySync: flush,
    discardPending,
  };
}
