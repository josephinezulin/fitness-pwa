import { useCallback, useEffect, useRef, useState } from "react";
import { validate, workoutPlans, type Data } from "./model";
import {
  LOCAL_KEY,
  readLocal,
  readSnapshot,
  snapshotKey,
  storeSnapshot,
  type CloudIdentity,
  type LocalRecovery,
} from "./workspace";
import { samePlan } from "./plans";
import { summarizeHealthSync } from "./health-sync-status";
import type { GoogleSession } from "./google";
import {
  GoogleAccessError,
  inspectSpreadsheet,
  type SheetSource,
} from "./sheets";
import {
  remoteWorkouts,
  remoteVideos,
  remotePlans,
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

function recoveryFor(
  local: ReturnType<typeof readLocal>,
): LocalRecovery | null {
  return local.error && typeof local.raw === "string"
    ? { raw: local.raw }
    : null;
}

export function useWorkspace() {
  const [initial] = useState(() => readLocal(localStorage));
  const [data, setData] = useState(initial.data);
  const [cloud, setCloud] = useState<CloudIdentity | null>(null);
  const [storageError, setStorageError] = useState(initial.error);
  const [localChanged, setLocalChanged] = useState(!!initial.error);
  const localRaw = useRef(initial.raw);
  const localStale = useRef(!!initial.error);
  const [localRecovery, setLocalRecovery] = useState(() =>
    recoveryFor(initial),
  );
  const recovery = useRef(localRecovery);
  function noteLocalRead(local: ReturnType<typeof readLocal>) {
    const next = recoveryFor(local);
    recovery.current = next;
    setLocalRecovery(next);
  }
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
  const markLocalChanged = () => {
    localStale.current = true;
    setLocalChanged(true);
  };
  function checkLocalVersion() {
    if (
      localStale.current ||
      localStorage.getItem(LOCAL_KEY) !== localRaw.current
    ) {
      markLocalChanged();
      throw Error(
        "本機資料已在其他分頁變更。請先保留草稿並關閉表單，再重新讀取本機資料。",
      );
    }
  }
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
  function projectPending(
    identity: CloudIdentity,
    next: Data,
    queue: PendingOperation[],
  ) {
    try {
      return { visible: overlayOutbox(next, queue), queue };
    } catch {
      // Different remote/local plan IDs can now occupy the same weekly slot.
      const conflicts = queue.map((op) =>
        op.kind === "plan" ? { ...op, state: "conflict" as const } : op,
      );
      storeOutbox(localStorage, identity, conflicts);
      setSyncError(
        "雲端課表與離線修改衝突，先保留上次裝置內容；請先匯出備份，再選擇採用雲端內容。",
      );
      const desired = queue.flatMap((op) =>
        op.kind === "plan" && op.value.active ? [op.value] : [],
      );
      // A cache can be evicted independently of the outbox. Still show/export every local intent;
      // temporarily omit remote competitors in this preview, without writing or deleting them.
      const preview = () =>
        overlayOutbox(
          {
            ...next,
            plans: workoutPlans(next).filter(
              (p) =>
                !p.active ||
                !desired.some(
                  (v) =>
                    v.id !== p.id &&
                    v.weekday === p.weekday &&
                    v.type === p.type,
                ),
            ),
          },
          queue,
        );
      return {
        visible: readSnapshot(localStorage, identity) ?? preview(),
        queue: conflicts,
      };
    }
  }
  const flush = useCallback(async () => {
    if (
      running.current ||
      !ownsLock.current ||
      !navigator.onLine ||
      !current.current?.source
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
        const projected = projectPending(identity, result.data!, queue);
        const visible = projected.visible;
        queue = projected.queue;
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
  useEffect(() => {
    const check = () => {
      if (current.current) return;
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (recovery.current && raw !== recovery.current.raw) {
          recovery.current = null;
          setLocalRecovery(null);
        }
        if (localStale.current || raw !== localRaw.current) markLocalChanged();
      } catch {
        recovery.current = null;
        setLocalRecovery(null);
        setStorageError(
          "無法確認本機儲存內容；目前畫面與原始內容已保留，請重新讀取後再記錄。",
        );
        markLocalChanged();
      }
    };
    const storage = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        (event.key !== null && event.key !== LOCAL_KEY)
      )
        return;
      check();
    };
    const visible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  function readLocalRecovery(source: LocalRecovery) {
    if (
      current.current ||
      recovery.current !== source ||
      localStorage.getItem(LOCAL_KEY) !== source.raw
    )
      throw Error("本機原始內容或工作區已變更，請重新讀取並另存原始檔案。");
    return source.raw;
  }
  /** A file read must not later replace another workspace or newer local records. */
  function prepareLocalRestore(repair?: LocalRecovery) {
    if (current.current)
      throw Error("還原備份只適用於本機模式，請先切回本機。");
    if (repair) readLocalRecovery(repair);
    else checkLocalVersion();
    const version = epoch.current,
      base = display.current,
      raw = localStorage.getItem(LOCAL_KEY);
    const check = () => {
      if (repair) readLocalRecovery(repair);
      if (
        version !== epoch.current ||
        current.current ||
        display.current !== base ||
        localStorage.getItem(LOCAL_KEY) !== raw
      )
        throw Error("讀取期間工作區或資料已變更，請重新選擇備份。");
    };
    return {
      check,
      warning: repair
        ? "這會取代無法解讀的本機原始內容；請確認原始檔案已保存於自己的裝置。"
        : undefined,
      apply(next: Data) {
        check();
        if (!repair) return save(next);
        const safe = validate(next);
        const raw = JSON.stringify(safe);
        check();
        localStorage.setItem(LOCAL_KEY, raw);
        localRaw.current = raw;
        localStale.current = false;
        recovery.current = null;
        setLocalRecovery(null);
        setLocalChanged(false);
        setStorageError("");
        show(safe);
      },
    };
  }
  function save(next: Data) {
    if (storageError)
      throw Error("裝置儲存發生錯誤，請先匯出備份並處理後重試。");
    const safe = validate(next),
      active = current.current;
    if (!active) {
      checkLocalVersion();
      const raw = JSON.stringify(safe);
      localStorage.setItem(LOCAL_KEY, raw);
      localRaw.current = raw;
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
      videos = remoteVideos(active.source),
      plans = remotePlans(active.source);
    for (const kind of ["workout", "video", "plan"] as const) {
      const before =
        kind === "workout"
          ? display.current.workouts
          : kind === "video"
            ? display.current.videos || []
            : workoutPlans(display.current);
      const after =
        kind === "workout"
          ? safe.workouts
          : kind === "video"
            ? safe.videos || []
            : workoutPlans(safe);
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
            : kind === "video"
              ? sameVideo(
                  previous as NonNullable<Data["videos"]>[number],
                  value as NonNullable<Data["videos"]>[number],
                )
              : samePlan(
                  previous as NonNullable<Data["plans"]>[number],
                  value as NonNullable<Data["plans"]>[number],
                );
        if (equal) continue;
        if (kind === "plan" && !value)
          throw Error("請停用課表以保留歷史設定，不能直接刪除雲端課表。");
        const old = queue.find((o) => o.kind === kind && o.id === id);
        const base = old
          ? old.base
          : (kind === "workout"
              ? workouts
              : kind === "video"
                ? videos
                : plans
            ).find((x) => x.id === id) || null;
        const position = old ? queue.indexOf(old) : queue.length;
        queue = queue.filter((o) => o.kind !== kind || o.id !== id);
        if (!base && !value) continue;
        queue.splice(position, 0, {
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
    let visible: Data;
    try {
      const projected = projectPending(identity, validate(next), queue);
      visible = projected.visible;
      queue = projected.queue;
    } catch {
      setStorageError("待同步狀態無法儲存，原始內容已保留；請先匯出備份。");
      current.current = { identity, data: validate(next) };
      show(readSnapshot(localStorage, identity) ?? validate(next));
      setCloud(identity);
      setPending(queue);
      return;
    }
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
    noteLocalRead(local);
    localRaw.current = local.raw;
    localStale.current = !!local.error;
    setLocalChanged(!!local.error);
    show(local.data);
    setCloud(null);
    setPending([]);
    setStorageError(local.error);
    setSyncError("");
  }
  function refreshLocal() {
    if (current.current) return;
    const local = readLocal(localStorage);
    noteLocalRead(local);
    if (local.error) {
      setStorageError(local.error);
      markLocalChanged();
      return;
    }
    cancel();
    localRaw.current = local.raw;
    localStale.current = false;
    setLocalChanged(false);
    setStorageError("");
    show(local.data);
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
    (!cloud && !localChanged && !storageError) ||
    (!!cloud &&
      !!current.current?.source &&
      session.current?.subject === cloud.subject &&
      lockReady &&
      !syncBusy &&
      !storageError &&
      !pending.some((o) => o.state !== "pending"));
  return {
    data,
    cloud,
    storageError,
    localChanged,
    localRecovery: cloud ? null : localRecovery,
    readLocalRecovery,
    refreshLocal,
    save,
    prepareLocalRestore,
    activateCloud,
    disconnectCloud,
    setGoogleSession,
    pending,
    syncBusy,
    syncError,
    canEditCloud,
    healthSync:
      cloud &&
      current.current?.source &&
      snapshotKey(current.current.identity) === snapshotKey(cloud)
        ? summarizeHealthSync(current.current.source.grids)
        : null,
    retrySync: flush,
    discardPending,
  };
}
