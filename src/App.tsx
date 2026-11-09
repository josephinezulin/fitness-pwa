import { OverviewPage } from "./pages/OverviewPage";
import { HealthPage } from "./pages/HealthPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HealthChart } from "./pages/HealthChart";
import { WorkoutLogs, WorkoutWeekSummary } from "./pages/WorkoutLogs";
import { WeeklySchedule, PlanManager } from "./pages/WeeklySchedule";
import {
  CATEGORY_WORKOUT,
  planWorkoutDraft,
  repeatWorkoutDraft,
  type WorkoutDraft,
} from "./exercise";
import { preferenceKey, markSeen } from "./preferences";
import { usePreferences } from "./usePreferences";
import { WeeklyActivity } from "./WeeklyActivity";
import { makeBackup } from "./backup";
import { useBackupRestore } from "./useBackupRestore";
import React, { useState, type ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import {
  Plus,
  Dumbbell,
  X,
  House,
  CalendarDays,
  MonitorPlay,
} from "lucide-react";
import { Welcome } from "./Welcome";
import { readAccount, readEntry, writeEntry } from "./entry";

const ease = [0.16, 1, 0.3, 1] as const;
/** Enter transition for a page; keyed by page so switching tabs replays it. */
function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
    >
      {children}
    </motion.div>
  );
}
function greeting(hour = new Date().getHours()) {
  return hour < 5 ? "晚安" : hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
}
const TAGLINES = [
  "比昨天多動一點就好",
  "每次開始都算數 🌱",
  "慢慢來，比較快",
  "今天也照顧一下自己 ☀️",
  "動一動，心情也會好",
  "身體會記得你的努力 ✨",
];
import {
  type Data,
  type Workout,
  weekDays,
  workoutPlans,
  completed,
  validate,
} from "./model";
import { WorkoutForm } from "./WorkoutForm";
import { MetricForm } from "./MetricForm";
import { VideoLibrary } from "./VideoLibrary";
import { readLibrary, watchUrl, type VideoCategory } from "./videos";
import { CloudPanel, type CloudReadState } from "./CloudPanel";
import { PwaUpdate } from "./PwaUpdate";
import { useCalendarToday } from "./useCalendarToday";
import { useWorkspace } from "./useWorkspace";
import { sameWorkout } from "./sheets-write";
import { AccountMenu } from "./AccountMenu";
export function App() {
  const workspace = useWorkspace();
  const data = workspace.data;
  const viewToday = useCalendarToday(workspace.cloud?.timezone);
  const [cloudReadState, setCloudReadState] = useState<CloudReadState>({
    busy: false,
    error: "",
  });
  const [page, setPage] = useState("首頁"),
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
  const [goalDraftOpen, setGoalDraftOpen] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft | null>(null);
  const [tagline] = useState(
    () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
  );
  // Entry: Google first; "browse" keeps this device only. Remembered per browser.
  const [entry, setEntry] = useState(() => readEntry(localStorage));
  const [browsing, setBrowsing] = useState(false);
  const [loginReady, setLoginReady] = useState(false);
  const [loginWaiting, setLoginWaiting] = useState(false);
  const loginAction = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    if (!workspace.cloud) return;
    setLoginWaiting(false);
    if (entry !== "google") {
      writeEntry(localStorage, "google");
      setEntry("google");
    }
  }, [workspace.cloud, entry]);
  const showWelcome = !workspace.cloud && entry !== "local" && !browsing;
  const draftOpen = !!modal || planDraftOpen || videoDraftOpen || goalDraftOpen;
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
      ).filter(
        (node) =>
          !node.matches(":disabled") &&
          node.tabIndex >= 0 &&
          !node.closest("details:not([open])"),
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
    onManage: () => setPage("課表"),
  };
  const workoutEditError =
    editing &&
    !sameWorkout(
      editing,
      data.workouts.find((w) => w.id === editing.id),
    )
      ? "運動紀錄已更新或刪除，草稿仍保留。請先複製需要的內容，再關閉並重新編輯最新紀錄。"
      : "";
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
    <MotionConfig reducedMotion="user">
      <div className="app">
        <div className="aurora" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <nav className="dock" aria-label="主要頁面">
          {(
            [
              ["首頁", House],
              ["課表", CalendarDays],
              null,
              ["紀錄", Dumbbell],
              ["影片", MonitorPlay],
            ] as const
          ).map((item) =>
            item === null ? (
              <motion.button
                key="fab"
                className="fab"
                aria-label="記錄運動"
                disabled={!workspace.canEditCloud}
                onClick={() => begin()}
                whileTap={{ scale: 0.88, rotate: 90 }}
              >
                <Plus size={26} strokeWidth={2.5} />
              </motion.button>
            ) : (
              <button
                key={item[0]}
                className={page === item[0] ? "active" : ""}
                aria-current={page === item[0] ? "page" : undefined}
                onClick={() => setPage(item[0])}
              >
                {page === item[0] && (
                  <motion.i
                    className="nav-pill"
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {(() => {
                  const Icon = item[1];
                  return <Icon size={21} />;
                })()}
                <span>{item[0]}</span>
              </button>
            ),
          )}
        </nav>
        <main>
          <header>
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
                onTrends={() => setPage("健康趨勢")}
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
                <motion.h1
                  key={page}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease }}
                >
                  {page === "首頁" ? greeting() : page}
                </motion.h1>
                {page === "首頁" && <p className="tagline">{tagline}</p>}
              </div>
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
                      {workspace.pending.some(
                        (op) => op.state !== "pending",
                      ) && (
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
            {message && (
              <div className="notice" role="status">
                {message}
                <button aria-label="關閉通知" onClick={() => setMessage("")}>
                  <X size={15} />
                </button>
              </div>
            )}
            {page === "首頁" && (
              <Page key="首頁">
                <OverviewPage
                  key={preferenceKey(workspace.cloud)}
                  metrics={data.metrics}
                  workouts={data.workouts}
                  plans={activePlans}
                  days={days}
                  viewToday={viewToday}
                  weekMinutes={weekMinutes}
                  weeklyGoal={preferences.value.weeklyGoal}
                  canEdit={workspace.canEditCloud}
                  canAddMetric={!workspace.cloud && workspace.canEditCloud}
                  seen={preferences.value.seen}
                  cloud={!!workspace.cloud}
                  sheetVideos={workspace.cloud ? data.videos : undefined}
                  onGoalChange={(weeklyGoal) =>
                    preferences.update(
                      (p) => ({ ...p, weeklyGoal }),
                      preferences.value.weeklyGoal,
                    )
                  }
                  onGoalDraftChange={setGoalDraftOpen}
                  onCheck={(plan, date) =>
                    begin(undefined, planWorkoutDraft(plan, date))
                  }
                  onUncheck={(plan, date) => {
                    const matches = data.workouts.filter(
                      (w) => w.date === date && w.type === plan.type,
                    );
                    if (
                      matches.length &&
                      confirm(
                        `要把 ${date.slice(5).replace("-", "/")} 的${plan.title}拿掉嗎？`,
                      )
                    )
                      save({
                        ...data,
                        workouts: data.workouts.filter(
                          (w) => !matches.includes(w),
                        ),
                      });
                  }}
                  onVideoDone={(video) =>
                    begin(undefined, {
                      type: CATEGORY_WORKOUT[video.category],
                      minutes: video.minutes || 10,
                      note: `影片：${video.title}\n${watchUrl(video.youtubeId)}`,
                      treadmill: false,
                      videoId: video.youtubeId,
                      countWatch: true,
                    })
                  }
                  onOpenTrends={() => setPage("健康趨勢")}
                  onAddMetric={() => setModal("metric")}
                />
              </Page>
            )}
            <div hidden={page !== "課表"}>
              <PlanManager
                key={preferenceKey(workspace.cloud)}
                plans={workoutPlans(data)}
                canEdit={workspace.canEditCloud}
                onSave={(plans) => save({ ...data, plans })}
                onDraftChange={setPlanDraftOpen}
              />
            </div>
            {page === "課表" && (
              <Page key="課表">
                <WeeklyPage
                  schedule={
                    <WeeklySchedule
                      key={preferenceKey(workspace.cloud)}
                      {...scheduleProps}
                    />
                  }
                  onVideo={(category) => {
                    setVideoCategory(category);
                    setPage("影片");
                  }}
                />
              </Page>
            )}
            {page === "紀錄" && (
              <Page key="紀錄">
                <WorkoutWeekSummary
                  weekWorkouts={weekWorkouts}
                  weekMinutes={weekMinutes}
                />
                <WeeklyActivity
                  workouts={data.workouts}
                  reference={viewToday}
                />
                <WorkoutLogs
                  key={preferenceKey(workspace.cloud)}
                  {...logsProps}
                  history
                />
              </Page>
            )}
            {page === "影片" && (
              <Page key="影片">
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
                  onMarkSeen={(id) =>
                    preferences.update((p) => markSeen(p, id))
                  }
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
              </Page>
            )}
            {page === "健康趨勢" && (
              <Page key="健康趨勢">
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
              </Page>
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
                eager={showWelcome}
                onLoginReady={(signIn) => {
                  loginAction.current = signIn;
                  setLoginReady(!!signIn);
                  if (!signIn) setLoginWaiting(false);
                }}
              />
            </SettingsPage>
          </div>
        </main>
        {showWelcome && (
          <Welcome
            account={readAccount(localStorage)}
            error={cloudReadState.error}
            loginReady={loginReady}
            waiting={loginWaiting || cloudReadState.busy}
            onLogin={() => {
              setLoginWaiting(true);
              loginAction.current?.();
            }}
            onLocal={() => {
              writeEntry(localStorage, "local");
              setEntry("local");
              setBrowsing(true);
            }}
          />
        )}
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
          <motion.div
            className="overlay"
            onClick={() => setModal(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.section
              className="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <div className="section-head dialog-head">
                <h2 id="dialog-title">
                  {modal === "metric"
                    ? "記錄健康數據"
                    : editing
                      ? "編輯運動紀錄"
                      : "今天動了什麼？"}
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
                  disabled={!workspace.canEditCloud || !!workoutEditError}
                  saveError={workoutEditError}
                  onSaved={() => {
                    setModal(null);
                    setWorkoutDraft(null);
                  }}
                  onSave={(record) => {
                    if (workoutEditError) return false;
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
                    }
                    return ok;
                  }}
                />
              ) : (
                <MetricForm
                  metrics={data.metrics}
                  today={viewToday}
                  disabled={!!workspace.cloud || !workspace.canEditCloud}
                  onSave={(record) =>
                    save({
                      ...data,
                      metrics: [
                        ...data.metrics.filter(
                          (metric) => metric.date !== record.date,
                        ),
                        record,
                      ],
                    })
                  }
                  onSaved={() => setModal(null)}
                />
              )}
            </motion.section>
          </motion.div>
        )}
      </div>
    </MotionConfig>
  );
}
