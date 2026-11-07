import { OverviewPage } from "./pages/OverviewPage";
import { HealthPage } from "./pages/HealthPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HealthChart } from "./pages/HealthChart";
import { WorkoutLogs, WorkoutWeekSummary } from "./pages/WorkoutLogs";
import { WeeklySchedule, PlanManager } from "./pages/WeeklySchedule";
import {
  CATEGORY_WORKOUT,
  repeatWorkoutDraft,
  type WorkoutDraft,
} from "./exercise";
import { preferenceKey, markSeen } from "./preferences";
import { usePreferences } from "./usePreferences";
import { WeeklyActivity } from "./WeeklyActivity";
import { makeBackup } from "./backup";
import { useBackupRestore } from "./useBackupRestore";
import React, { useState } from "react";
import {
  Activity,
  Plus,
  Dumbbell,
  Check,
  ChevronRight,
  WifiOff,
  X,
  Heart,
  LayoutDashboard,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  Leaf,
  MonitorPlay,
} from "lucide-react";
import {
  type Data,
  type Workout,
  type Metric,
  weekDays,
  workoutPlans,
  completed,
  validate,
  demo,
} from "./model";
import { WorkoutForm } from "./WorkoutForm";
import { VideoLibrary } from "./VideoLibrary";
import { readLibrary, watchUrl, type VideoCategory } from "./videos";
import { CloudPanel, type CloudReadState } from "./CloudPanel";
import { PwaUpdate } from "./PwaUpdate";
import { useCalendarToday } from "./useCalendarToday";
import { useWorkspace } from "./useWorkspace";
import { AccountMenu } from "./AccountMenu";
export function App() {
  const workspace = useWorkspace();
  const data = workspace.data;
  const viewToday = useCalendarToday(workspace.cloud?.timezone);
  const [cloudReadState, setCloudReadState] = useState<CloudReadState>({
    busy: false,
    error: "",
  });
  const [page, setPage] = useState("總覽"),
    [modal, setModal] = useState<"workout" | "metric" | null>(null),
    [editing, setEditing] = useState<Workout | null>(null),
    [message, setMessage] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [range, setRange] = useState(30),
    [videoCategory, setVideoCategory] = useState<VideoCategory | "全部">(
      "全部",
    ),
    [videoVersion, setVideoVersion] = useState(0),
    [expanded, setExpanded] = useState<string | null>(null),
    [metric, setMetric] = useState<"weight" | "fat" | "heart" | "steps">(
      "weight",
    );
  const [planDraftOpen, setPlanDraftOpen] = useState(false);
  const [videoDraftOpen, setVideoDraftOpen] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft | null>(null);
  const draftOpen = !!modal || planDraftOpen || videoDraftOpen;
  const preferences = usePreferences(
    preferenceKey(workspace.cloud),
    setMessage,
  );
  const backupRestore = useBackupRestore({
    scopeKey: preferenceKey(workspace.cloud),
    prepare: workspace.prepareLocalRestore,
    onLibraryRestored: () => setVideoVersion((version) => version + 1),
    onPreferencesRestored: (next) => preferences.update(() => next),
    onMessage: setMessage,
  });
  React.useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = document.querySelector<HTMLElement>(".dialog");
    const focusable = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [modal]);
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  React.useEffect(() => {
    setModal(null);
    setEditing(null);
    setWorkoutDraft(null);
  }, [workspace.cloud?.subject, workspace.cloud?.spreadsheetId]);
  function save(next: Data) {
    try {
      workspace.save(validate(next));
      return true;
    } catch (e) {
      setMessage("儲存失敗：" + (e as Error).message);
      return false;
    }
  }
  const days = weekDays(new Date(viewToday + "T12:00:00")),
    activePlans = workoutPlans(data).filter((p) => p.active),
    done = activePlans.filter((p) =>
      completed(data.workouts, days[p.weekday - 1], p.type),
    ).length;
  const weekWorkouts = data.workouts.filter(
    (w) => days.includes(w.date) && w.date <= viewToday,
  );
  const weekMinutes =
    Math.round(
      weekWorkouts.reduce((total, workout) => total + workout.minutes, 0) * 10,
    ) / 10;
  const begin = (workout?: Workout, draft: WorkoutDraft | null = null) => {
    if (!workspace.canEditCloud) {
      setMessage("請先完成同步或處理連線狀態，再編輯運動。");
      return;
    }
    setEditing(workout || null);
    setWorkoutDraft(draft);
    setModal("workout");
  };
  const deleteWorkout = (id: string) => {
    if (confirm("確定刪除這筆運動紀錄？對應課表將重新計算。"))
      save({ ...data, workouts: data.workouts.filter((w) => w.id !== id) });
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            makeBackup(
              data,
              workspace.cloud ? undefined : readLibrary(localStorage),
              preferences.value,
            ),
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace.cloud ? "日常動作-雲端每日摘要" : "日常動作"}-${viewToday}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportOriginal = (
    source: Parameters<typeof workspace.readLocalRecovery>[0],
  ) => {
    try {
      const raw = workspace.readLocalRecovery(source);
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { format: "daily-movement-unreadable-local-v1", raw },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `日常動作-待修復原始內容-${viewToday}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (error) {
      setMessage("無法下載原始檔案：" + (error as Error).message);
      return false;
    }
  };
  const chartProps = {
    metrics: data.metrics,
    viewToday,
    range,
    setRange,
    metric,
    setMetric,
    cloud: !!workspace.cloud,
    canEdit: workspace.canEditCloud,
    onAdd: () => setModal("metric"),
  };
  const scheduleProps = {
    plans: activePlans,
    workouts: data.workouts,
    viewToday,
    days,
    onManage: () => setPage("本週課表"),
  };
  const logsProps = {
    workouts: data.workouts,
    canEdit: workspace.canEditCloud,
    onBegin: begin,
    onRepeat: (workout: Workout) =>
      begin(undefined, repeatWorkoutDraft(workout)),
    onDelete: deleteWorkout,
    expanded,
    setExpanded,
  };
  return (
    <div className="app">
      <aside>
        <a className="brand" href="#">
          <span>
            <Activity size={25} />
          </span>
          <div>
            日常動作<small>MOVE A LITTLE, EVERY DAY</small>
          </div>
        </a>
        <div className="nav-label">我的健康日誌</div>
        <nav>
          {(
            [
              ["總覽", LayoutDashboard],
              ["本週課表", CalendarDays],
              ["運動紀錄", Dumbbell],
              ["運動影片", MonitorPlay],
              ["健康趨勢", ChartNoAxesCombined],
              ["設定與備份", Settings],
            ] as const
          ).map(([name, Icon]) => (
            <button
              key={name as string}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name as string)}
            >
              <Icon size={20} />
              <span>{name as string}</span>
              {page === name && <i />}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <Leaf size={24} />
          <h3>比昨天，多動一點。</h3>
          <p>
            不用急著改變一切，
            <br />
            每一次開始都算數。
          </p>
        </div>
        <div className="local-badge">
          <i />
          {workspace.cloud ? "雲端摘要已讀取" : "資料儲存於此裝置"}
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            我的健康日誌 <ChevronRight size={13} /> {page}
          </div>
          <div className="header-right">
            <AccountMenu
              cloud={workspace.cloud}
              online={online}
              readBusy={cloudReadState.busy}
              syncBusy={workspace.syncBusy}
              pendingCount={workspace.pending.length}
              issue={!!workspace.syncError || !!cloudReadState.error}
              contextKey={`${preferenceKey(workspace.cloud)}:${page}:${modal || ""}`}
              onRefresh={() =>
                window.dispatchEvent(new Event("daily-movement-refresh"))
              }
              onSettings={() => setPage("設定與備份")}
              onLocal={workspace.disconnectCloud}
            />
          </div>
        </header>
        <div className="content">
          <div className="title-row">
            <div>
              <span className="eyebrow">
                {new Date().toLocaleDateString("zh-TW", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                  timeZone: workspace.cloud?.timezone,
                })}
              </span>
              <h1>{page === "總覽" ? "把健康，放進日常。" : page}</h1>
              <p className="subtitle">
                {page === "總覽"
                  ? "用自己的步調，累積每一天的小進步。"
                  : "照顧自己，從每一次記錄開始。"}
              </p>
            </div>
            <button
              className="primary"
              disabled={!workspace.canEditCloud}
              onClick={() => begin()}
            >
              <Plus size={18} />
              記錄運動
            </button>
          </div>
          {workspace.storageError && (
            <div className="notice" role="status">
              {workspace.storageError}
            </div>
          )}
          {!workspace.cloud && workspace.localChanged && (
            <div className="notice sync-notice" role="status">
              <div className="grow">
                <strong>
                  {workspace.storageError
                    ? "本機資料需要重新讀取"
                    : "本機資料已變更"}
                </strong>
                <p>
                  {workspace.storageError
                    ? "暫時無法確認本機儲存內容。"
                    : "本機儲存內容已與目前畫面不同。"}
                  未儲存表單會暫時保留，請先複製需要的內容，再關閉表單並重新讀取。
                  {workspace.localRecovery &&
                    "若仍無法讀取，可至「設定與備份」另存原始內容，再用有效備份修復。"}
                </p>
                <button
                  className="secondary"
                  disabled={draftOpen || backupRestore.busy}
                  onClick={() => {
                    if (!draftOpen && !backupRestore.busy)
                      workspace.refreshLocal();
                  }}
                >
                  重新讀取本機資料
                </button>
              </div>
            </div>
          )}
          {workspace.cloud &&
            (workspace.pending.length > 0 || workspace.syncError) && (
              <div className="notice sync-notice" role="status">
                <div className="grow">
                  <strong>
                    {workspace.syncBusy
                      ? "正在同步…"
                      : workspace.pending.length
                        ? `${workspace.pending.length} 筆修改保留在此裝置`
                        : "雲端同步狀態"}
                  </strong>
                  <p>
                    {workspace.syncError ||
                      "連線與 Google 授權有效時會自動補同步，其他裝置需同步完成後才看得到。"}
                  </p>
                  <ul>
                    {workspace.pending.slice(0, 5).map((op) => (
                      <li key={op.operationId}>
                        {op.kind === "workout"
                          ? "運動"
                          : op.kind === "plan"
                            ? "課表"
                            : "影片"}{" "}
                        · {op.value ? "新增／修改" : "刪除"}
                        {op.state === "conflict"
                          ? " · 發生衝突"
                          : op.state === "uncertain"
                            ? " · 等候確認"
                            : " · 待同步"}
                      </li>
                    ))}
                  </ul>
                  <div className="cloud-actions">
                    <button
                      className="text-button"
                      disabled={workspace.syncBusy || !online}
                      onClick={() => void workspace.retrySync()}
                    >
                      重試同步
                    </button>
                    <button className="text-button" onClick={exportData}>
                      匯出目前內容備份
                    </button>
                    {workspace.pending.some((op) => op.state !== "pending") && (
                      <button
                        className="text-button"
                        disabled={workspace.syncBusy || !online}
                        onClick={() => {
                          if (
                            confirm(
                              "放棄此裝置全部待同步修改，改用試算表目前內容？建議先匯出備份。",
                            )
                          )
                            void workspace.discardPending();
                        }}
                      >
                        採用雲端內容
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          {workspace.cloud && cloudReadState.error && (
            <div className="notice" role="status">
              {cloudReadState.error}
            </div>
          )}
          {!online && (
            <div className="notice">
              <WifiOff size={16} />
              {workspace.cloud
                ? "目前離線，健康摘要為先前快取；運動、課表與影片修改會先保留在此裝置，連線並登入後補同步。"
                : "目前離線，仍可查看與記錄本機資料。"}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
              <button aria-label="關閉通知" onClick={() => setMessage("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {page === "總覽" && (
            <OverviewPage
              key={preferenceKey(workspace.cloud)}
              metrics={data.metrics}
              viewToday={viewToday}
              weekMinutes={weekMinutes}
              weeklyGoal={preferences.value.weeklyGoal}
              done={done}
              planCount={activePlans.length}
              chart={<HealthChart {...chartProps} />}
              schedule={
                <WeeklySchedule
                  key={preferenceKey(workspace.cloud)}
                  {...scheduleProps}
                />
              }
              logs={<WorkoutLogs {...logsProps} limit={4} />}
              onGoalChange={(weeklyGoal) =>
                preferences.update((p) => ({ ...p, weeklyGoal }))
              }
              onSchedule={() => setPage("本週課表")}
            />
          )}
          <div hidden={page !== "本週課表"}>
            <PlanManager
              key={preferenceKey(workspace.cloud)}
              plans={workoutPlans(data)}
              canEdit={workspace.canEditCloud}
              onSave={(plans) => save({ ...data, plans })}
              onDraftChange={setPlanDraftOpen}
            />
          </div>
          {page === "本週課表" && (
            <WeeklyPage
              schedule={
                <WeeklySchedule
                  key={preferenceKey(workspace.cloud)}
                  {...scheduleProps}
                />
              }
              onVideo={(category) => {
                setVideoCategory(category);
                setPage("運動影片");
              }}
            />
          )}
          {page === "運動紀錄" && (
            <>
              <WorkoutWeekSummary
                weekWorkouts={weekWorkouts}
                weekMinutes={weekMinutes}
              />
              <WeeklyActivity workouts={data.workouts} reference={viewToday} />
              <WorkoutLogs
                key={preferenceKey(workspace.cloud)}
                {...logsProps}
                history
              />
            </>
          )}
          {page === "運動影片" && (
            <VideoLibrary
              key={`${videoVersion}:${workspace.cloud?.subject || "local"}:${workspace.cloud?.spreadsheetId || ""}`}
              online={online}
              initialCategory={videoCategory}
              onDraftChange={setVideoDraftOpen}
              cloud={!!workspace.cloud}
              preferences={preferences.value}
              onToggleFavorite={(id) =>
                preferences.update((p) => ({
                  ...p,
                  favorites: p.favorites.includes(id)
                    ? p.favorites.filter((x) => x !== id)
                    : [...p.favorites, id],
                }))
              }
              onMarkSeen={(id) => preferences.update((p) => markSeen(p, id))}
              canRecord={workspace.canEditCloud}
              onRecord={(video, countWatch) => {
                setEditing(null);
                setWorkoutDraft({
                  type: CATEGORY_WORKOUT[video.category],
                  minutes: video.minutes || 30,
                  note: `影片：${video.title}\n${watchUrl(video.youtubeId)}`,
                  treadmill: false,
                  videoId: video.youtubeId,
                  countWatch,
                });
                setModal("workout");
              }}
              sheetVideos={workspace.cloud ? data.videos : undefined}
              canEditCloud={workspace.canEditCloud}
              onSaveVideo={(video) =>
                save({
                  ...data,
                  videos: [
                    ...(data.videos || []).filter((v) => v.id !== video.id),
                    video,
                  ],
                })
              }
              onDeleteVideo={(id) =>
                save({
                  ...data,
                  videos: (data.videos || []).filter((v) => v.id !== id),
                })
              }
            />
          )}
          {page === "健康趨勢" && (
            <HealthPage
              metrics={data.metrics}
              cloud={!!workspace.cloud}
              canEdit={workspace.canEditCloud}
              workspaceKey={preferenceKey(workspace.cloud)}
              viewToday={viewToday}
              range={range}
              chart={<HealthChart {...chartProps} />}
              onAdd={() => setModal("metric")}
              onDelete={(id) => {
                if (confirm("刪除這天的健康摘要？"))
                  save({
                    ...data,
                    metrics: data.metrics.filter((m) => m.id !== id),
                  });
              }}
            />
          )}
          <SettingsPage
            visible={page === "設定與備份"}
            cloud={!!workspace.cloud}
            localWritable={!workspace.cloud && workspace.canEditCloud}
            localRecovery={workspace.localRecovery}
            recoveryBlocked={draftOpen}
            onExportOriginal={exportOriginal}
            onRepair={(file, source) =>
              backupRestore.restore(file, () =>
                workspace.prepareLocalRestore(source),
              )
            }
            healthSync={workspace.healthSync}
            timezone={workspace.cloud?.timezone}
            readAt={workspace.cloud?.checkedAt}
            online={online}
            workoutCount={data.workouts.length}
            metricCount={data.metrics.length}
            onExport={exportData}
            onRestore={backupRestore.restore}
            restoring={backupRestore.busy}
            onCancelRestore={backupRestore.cancel}
            onDemo={() => {
              if (confirm("以虛構示範資料取代目前紀錄？")) save(demo());
            }}
          >
            <CloudPanel
              visible={page === "設定與備份"}
              activeSpreadsheetId={workspace.cloud?.spreadsheetId ?? null}
              onUseSnapshot={workspace.activateCloud}
              onSessionChange={workspace.setGoogleSession}
              onDisconnect={(reason) => {
                workspace.disconnectCloud();
                if (reason) setMessage(reason);
              }}
              onReadState={setCloudReadState}
            />
          </SettingsPage>
          <footer>
            <span>
              <Leaf size={13} /> 日常動作 · 為自己，慢慢變好
            </span>
            <button
              disabled={!!workspace.cloud || !workspace.canEditCloud}
              onClick={() => setModal("metric")}
            >
              <Heart size={14} />
              記錄健康數據
            </button>
          </footer>
        </div>
      </main>
      <PwaUpdate
        blocked={draftOpen || workspace.syncBusy || backupRestore.busy}
        blockedReason={
          workspace.syncBusy
            ? "請稍候同步完成，再更新。"
            : backupRestore.busy
              ? "請等候備份讀取完成或取消後，再更新。"
              : undefined
        }
      />
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head dialog-head">
              <h2 id="dialog-title">
                {modal === "metric"
                  ? "記錄健康數據"
                  : editing
                    ? "編輯運動紀錄"
                    : "記錄今天的努力"}
              </h2>
              <button
                className="icon-button"
                aria-label="關閉"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            {modal === "workout" ? (
              <WorkoutForm
                editing={editing}
                initialDraft={workoutDraft}
                metrics={data.metrics}
                today={viewToday}
                disabled={!workspace.canEditCloud}
                onSave={(record) => {
                  const ok = save({
                    ...data,
                    workouts: [
                      ...data.workouts.filter((w) => w.id !== record.id),
                      record,
                    ],
                  });
                  if (ok) {
                    if (workoutDraft?.videoId && workoutDraft.countWatch) {
                      const id = workoutDraft.videoId;
                      preferences.update((p) => markSeen(p, id));
                    }
                    setModal(null);
                    setWorkoutDraft(null);
                  }
                  return ok;
                }}
              />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  {
                    const date = String(form.get("date"));
                    const old = data.metrics.find((m) => m.date === date);
                    const record: Metric = {
                      id: old?.id || crypto.randomUUID(),
                      date,
                    };
                    for (const k of [
                      "weight",
                      "fat",
                      "heart",
                      "steps",
                    ] as const) {
                      const v = String(form.get(k));
                      if (v !== "") record[k] = Number(v);
                    }
                    if (
                      save({
                        ...data,
                        metrics: [
                          ...data.metrics.filter((m) => m.date !== date),
                          record,
                        ],
                      })
                    )
                      setModal(null);
                  }
                }}
              >
                <label>
                  日期
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={viewToday}
                    max={viewToday}
                  />
                </label>
                {
                  <>
                    <p className="tiny muted">
                      至少填寫一項。相同日期會取代當天摘要；未填欄位將清空。
                    </p>
                    {(
                      [
                        ["weight", "體重（kg）", 1, 500, 0.1],
                        ["fat", "體脂率（%）", 0, 100, 0.1],
                        ["heart", "心率（bpm）", 20, 250, 1],
                        ["steps", "每日步數", 0, 200000, 1],
                      ] as const
                    ).map(([key, label, min, max, step]) => (
                      <label key={key}>
                        {label}
                        <input
                          name={key}
                          type="number"
                          min={min}
                          max={max}
                          step={step}
                        />
                      </label>
                    ))}
                  </>
                }
                <button
                  className="primary full"
                  disabled={!!workspace.cloud || !workspace.canEditCloud}
                  type="submit"
                >
                  儲存紀錄 <Check size={18} />
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
