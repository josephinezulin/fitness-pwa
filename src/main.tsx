import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  Plus,
  Footprints,
  Flame,
  Dumbbell,
  Check,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  Pencil,
  WifiOff,
  X,
  Heart,
  Scale,
  LayoutDashboard,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  Play,
  Leaf,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  type Data,
  type Workout,
  type Metric,
  empty,
  today,
  weekDays,
  plans,
  completed,
  validate,
  demo,
} from "./model";
import { CloudPanel, type CloudReadState } from "./CloudPanel";
import { PwaUpdate } from "./PwaUpdate";
import { calendarDateInZone } from "./calendar";
import { useWorkspace } from "./useWorkspace";
import "./style.css";
const names = { home: "居家徒手訓練", walk: "上坡快走", other: "其他運動" };
function App() {
  const workspace = useWorkspace();
  const data = workspace.data;
  const viewToday = workspace.cloud
    ? calendarDateInZone(new Date(), workspace.cloud.timezone)
    : today();
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
    [metric, setMetric] = useState<"weight" | "fat" | "heart" | "steps">(
      "weight",
    );
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
    done = plans.filter((p) =>
      completed(data.workouts, days[p.day], p.type),
    ).length;
  const latest = (field: keyof Metric) =>
    [...data.metrics]
      .filter((m) => m[field] !== undefined && m.date <= viewToday)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  const w = latest("weight"),
    f = latest("fat"),
    steps = data.metrics.find((m) => m.date === viewToday)?.steps;
  const weekWorkouts = data.workouts.filter((w) => days.includes(w.date));
  const begin = (workout?: Workout) => {
    if (workspace.cloud) {
      setMessage("目前為雲端唯讀檢視，請先切回本機再編輯。");
      return;
    }
    setEditing(workout || null);
    setModal("workout");
  };
  const deleteWorkout = (id: string) => {
    if (confirm("確定刪除這筆運動紀錄？對應課表將重新計算。"))
      save({ ...data, workouts: data.workouts.filter((w) => w.id !== id) });
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace.cloud ? "日常動作-雲端每日摘要" : "日常動作"}-${viewToday}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw Error("檔案超過 10 MB");
      const next = validate(JSON.parse(await file.text()));
      if (
        confirm(
          `將以備份取代現有資料（${next.workouts.length} 筆運動、${next.metrics.length} 筆健康資料）。建議先匯出備份。確定還原？`,
        ) &&
        save(next)
      )
        setMessage("已成功還原資料");
    } catch (e) {
      setMessage("無法還原：" + (e as Error).message);
    }
  }
  const chart = () => {
    const cutoff = new Date(viewToday + "T12:00:00");
    cutoff.setDate(cutoff.getDate() - range + 1);
    const rows = data.metrics
      .filter(
        (m) =>
          m.date >= todayDate(cutoff) &&
          m.date <= viewToday &&
          m[metric] !== undefined,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    return (
      <section className="card chart">
        <div className="section-head">
          <div>
            <span className="eyebrow">每一點進步，都值得記錄</span>
            <h2>身體的變化</h2>
          </div>
          <select
            aria-label="趨勢時間範圍"
            value={range}
            onChange={(e) => setRange(+e.target.value)}
          >
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
          </select>
        </div>
        <div className="tabs">
          {(
            [
              ["weight", "體重"],
              ["fat", "體脂率"],
              ["heart", "心率"],
              ["steps", "步數"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={metric === id ? "selected" : ""}
              onClick={() => setMetric(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {rows.length ? (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={225}>
              <AreaChart
                data={rows}
                margin={{ top: 20, right: 10, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6f9272" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#6f9272" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9ede5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => d.slice(5).replace("-", "/")}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  minTickGap={32}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) => [
                    `${v} ${{ weight: "kg", fat: "%", heart: "bpm", steps: "步" }[metric]}`,
                    {
                      weight: "體重",
                      fat: "體脂率",
                      heart: "心率",
                      steps: "步數",
                    }[metric],
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="#68856b"
                  strokeWidth={2.5}
                  fill="url(#green)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">
            尚無趨勢資料，從今天的第一次記錄開始。
            <button
              disabled={!!workspace.cloud}
              onClick={() => setModal("metric")}
            >
              新增健康數據 <Plus size={15} />
            </button>
          </div>
        )}
        <p className="muted tiny">
          每日一筆摘要 · 缺值不補 0
          {workspace.cloud && metric === "heart"
            ? " · 心率為當日樣本算術平均"
            : ""}
        </p>
      </section>
    );
  };
  const schedule = () => (
    <section className="card schedule">
      <div className="section-head">
        <div>
          <span className="eyebrow">讓運動成為日常</span>
          <h2>本週課表</h2>
        </div>
        <span className="pill">{done} / 3 完成</span>
      </div>
      <div className="week-strip">
        {days.map((d, i) => (
          <div key={d} className={d === viewToday ? "current" : ""}>
            <span>{"一二三四五六日"[i]}</span>
            <b>{+d.slice(-2)}</b>
            <i className={plans.some((p) => p.day === i) ? "dot" : ""} />
          </div>
        ))}
      </div>
      {plans.map((p) => {
        const ok = completed(data.workouts, days[p.day], p.type);
        return (
          <div className="plan" key={p.day}>
            <div className={"plan-icon " + (ok ? "checked" : "")}>
              {ok ? (
                <Check size={20} />
              ) : p.type === "home" ? (
                <Dumbbell size={20} />
              ) : (
                <Footprints size={20} />
              )}
            </div>
            <div className="grow">
              <small>
                週{"一二三四五六日"[p.day]} ·{" "}
                {days[p.day].slice(5).replace("-", "/")}
              </small>
              <h3>{p.label}</h3>
              <p>
                {p.duration} {p.type === "walk" ? "· 穩定有氧" : "· 全身肌力"}
              </p>
            </div>
            <span className={ok ? "status done" : "status"}>
              {ok ? "已完成" : "待完成"}
            </span>
          </div>
        );
      })}
      <p className="tiny muted">記錄同日、同類型運動，即自動完成打卡。</p>
    </section>
  );
  const logs = () => (
    <section className="card logs">
      <div className="section-head">
        <h2>運動紀錄</h2>
        <button
          className="text-button"
          disabled={!!workspace.cloud}
          onClick={() => begin()}
        >
          新增紀錄 <Plus size={16} />
        </button>
      </div>
      {data.workouts.length ? (
        [...data.workouts]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, page === "運動紀錄" ? undefined : 4)
          .map((w) => (
            <div className="log" key={w.id}>
              <div className="plan-icon">
                <Dumbbell size={20} />
              </div>
              <div className="grow">
                <h3>{names[w.type]}</h3>
                <p>
                  {w.date} · {w.minutes} 分鐘 · {w.calories} kcal
                </p>
                {w.note && <p className="note">{w.note}</p>}
              </div>
              <button
                className="icon-button"
                disabled={!!workspace.cloud}
                aria-label="編輯運動"
                onClick={() => begin(w)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                disabled={!!workspace.cloud}
                aria-label="刪除運動"
                onClick={() => deleteWorkout(w.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
      ) : (
        <div className="empty">
          你的運動故事，從第一筆開始。
          <button disabled={!!workspace.cloud} onClick={() => begin()}>
            記錄一次運動 <ArrowUpRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
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
            <span className="device-status">
              {workspace.cloud ? "雲端唯讀" : online ? "本機模式" : "離線模式"}
            </span>
            <div className="avatar">我</div>
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
              disabled={!!workspace.cloud}
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
          {workspace.cloud && (
            <div className="notice">
              <span>
                雲端唯讀：{workspace.cloud.title} · {workspace.cloud.timezone}
                。目前顯示每日摘要，沒有上傳本機資料。讀取時間：
                {new Date(workspace.cloud.checkedAt).toLocaleString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </span>
              <div className="cloud-toolbar">
                <button
                  disabled={cloudReadState.busy || !online}
                  onClick={() =>
                    window.dispatchEvent(new Event("daily-movement-refresh"))
                  }
                >
                  {cloudReadState.busy ? "更新中…" : "更新資料"}
                </button>
                <button onClick={workspace.disconnectCloud}>切回本機</button>
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
                ? "目前離線，顯示的是先前讀取的雲端摘要。"
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
            <>
              <div className="stats">
                {[
                  {
                    label: "最新體重",
                    value: w?.weight,
                    unit: "kg",
                    icon: Scale,
                    sub: w?.date || "等待第一次記錄",
                    color: "sage",
                  },
                  {
                    label: "最新體脂率",
                    value: f?.fat,
                    unit: "%",
                    icon: Activity,
                    sub: f?.date || "了解自己的身體",
                    color: "sand",
                  },
                  {
                    label: "今日步數",
                    value: steps?.toLocaleString(),
                    unit: "步",
                    icon: Footprints,
                    sub: "每一步，都是進步",
                    color: "blue",
                  },
                  {
                    label: "本週運動",
                    value: done,
                    unit: "/ 3 次",
                    icon: Flame,
                    sub: `已累積 ${weekWorkouts.reduce((a, w) => a + w.minutes, 0)} 分鐘`,
                    color: "peach",
                  },
                ].map((s) => (
                  <article className="card stat" key={s.label}>
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <div className={"stat-icon " + s.color}>
                        <s.icon size={19} />
                      </div>
                    </div>
                    <div className="stat-value">
                      {s.value ?? "—"}
                      <small>{s.unit}</small>
                    </div>
                    <p>{s.sub}</p>
                  </article>
                ))}
              </div>
              <div className="two-column">
                {chart()}
                {schedule()}
              </div>
              <div className="two-column bottom">
                {logs()}
                <section className="tip">
                  <span className="eyebrow">YOUR DAILY REMINDER</span>
                  <div className="abstract">
                    <span />
                    <span />
                    <span />
                    <Leaf size={68} />
                  </div>
                  <h2>
                    不求一次到位，
                    <br />
                    只要持續前進。
                  </h2>
                  <p>今天的你，也值得被好好照顧。</p>
                  <button onClick={() => setPage("本週課表")}>
                    看看本週安排 <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "本週課表" && (
            <div className="two-column">
              {schedule()}
              <section className="card">
                <span className="eyebrow">在家，也能好好動</span>
                <h2>居家訓練小指南</h2>
                <p className="guide">
                  建議先暖身 5
                  分鐘，再依能力進行深蹲、靠牆伏地挺身、臀橋與鳥狗式，最後緩和伸展。從舒服的強度開始，疼痛或不適時停止。
                </p>
                <a
                  className="video-link"
                  href="https://www.youtube.com/results?search_query=初學者+徒手全身訓練+低衝擊+20分鐘"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Play size={20} />
                  YouTube 徒手訓練教學
                  <ArrowUpRight size={16} />
                </a>
                <a
                  className="video-link"
                  href="https://www.youtube.com/results?search_query=運動前暖身+運動後伸展+教學"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Play size={20} />
                  暖身與伸展教學
                  <ArrowUpRight size={16} />
                </a>
                <p className="tiny muted">
                  連結前往 YouTube
                  教學搜尋；需網路連線。上坡快走安排於週三，30–60 分鐘。
                </p>
              </section>
            </div>
          )}
          {page === "運動紀錄" && logs()}
          {page === "健康趨勢" && (
            <>
              <button
                className="secondary metric-add"
                disabled={!!workspace.cloud}
                onClick={() => setModal("metric")}
              >
                <Plus size={16} />
                新增健康數據
              </button>
              {chart()}
              <section className="card metric-list">
                <h2>健康摘要</h2>
                {[...data.metrics]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((m) => (
                    <div className="log" key={m.id}>
                      <div className="grow">
                        <h3>{m.date}</h3>
                        <p>
                          {m.weight ?? "—"} kg · {m.fat ?? "—"} % ·{" "}
                          {m.heart ?? "—"} bpm · {m.steps ?? "—"} 步
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        disabled={!!workspace.cloud}
                        aria-label="刪除健康數據"
                        onClick={() => {
                          if (confirm("刪除這天的健康摘要？"))
                            save({
                              ...data,
                              metrics: data.metrics.filter(
                                (x) => x.id !== m.id,
                              ),
                            });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
              </section>
            </>
          )}
          {
            <div
              className="settings-grid"
              style={{ display: page === "設定與備份" ? "grid" : "none" }}
            >
              <CloudPanel
                visible={page === "設定與備份"}
                activeSpreadsheetId={workspace.cloud?.spreadsheetId ?? null}
                onUseSnapshot={workspace.activateCloud}
                onDisconnect={(reason) => {
                  workspace.disconnectCloud();
                  if (reason) setMessage(reason);
                }}
                onReadState={setCloudReadState}
              />
              <section className="card">
                <h2>資料與備份</h2>
                <p className="guide">
                  本機紀錄存於此瀏覽器；可另外連線查看私人 Sheets
                  的每日摘要，雲端寫入尚未啟用。清除網站資料或更換裝置前，請先匯出備份。備份含個人健康資料，請妥善保存。
                </p>
                <button className="secondary" onClick={exportData}>
                  <Download size={18} />
                  {workspace.cloud ? "匯出雲端每日摘要 JSON" : "匯出 JSON 備份"}
                </button>
                <label className="secondary file-label">
                  <Upload size={18} />
                  還原 JSON 備份
                  <input
                    type="file"
                    disabled={!!workspace.cloud}
                    accept="application/json,.json"
                    onChange={(e) => {
                      restore(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="tiny muted">
                  目前：{data.workouts.length} 筆運動，{data.metrics.length}{" "}
                  筆健康摘要
                </p>
              </section>
              <section className="card">
                <h2>加入 iPhone 主畫面</h2>
                <ol className="guide">
                  <li>以 Safari 開啟 GitHub Pages 網址。</li>
                  <li>點選「分享」→「加入主畫面」。</li>
                  <li>首次連網開啟後，即可離線使用。</li>
                </ol>
                <p className="tiny muted">
                  離線模式支援介面、紀錄與備份。影片與未來雲端同步需要網路。裝置儲存空間不足時，iOS
                  可能清除網站資料。
                </p>
              </section>
              <section className="card">
                <h2>整合進度</h2>
                <p className="guide">
                  第一階段：本機 PWA
                  <br />
                  第二階段：Google 登入、選檔及格式驗收（待實機驗證）
                  <br />
                  第三階段：Apple 健康與 iOS 捷徑
                </p>
                <span className="pill">雲端唯讀已就緒，寫入待驗收</span>
              </section>
              <section className="card">
                <h2>試用示範資料</h2>
                <p className="guide">
                  載入 14
                  天虛構健康摘要，預覽趨勢與課表。會取代目前資料，請先備份。
                </p>
                <button
                  className="secondary"
                  disabled={!!workspace.cloud}
                  onClick={() => {
                    if (confirm("以虛構示範資料取代目前紀錄？")) save(demo());
                  }}
                >
                  載入示範資料
                </button>
              </section>
            </div>
          }
          <footer>
            <span>
              <Leaf size={13} /> 日常動作 · 為自己，慢慢變好
            </span>
            <button
              disabled={!!workspace.cloud}
              onClick={() => setModal("metric")}
            >
              <Heart size={14} />
              記錄健康數據
            </button>
          </footer>
        </div>
      </main>
      <PwaUpdate blocked={!!modal} />
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                if (modal === "workout") {
                  const record: Workout = {
                    id: editing?.id || crypto.randomUUID(),
                    date: String(form.get("date")),
                    type: form.get("type") as Workout["type"],
                    minutes: Number(form.get("minutes")),
                    calories: Number(form.get("calories")),
                    note: String(form.get("note")).trim(),
                  };
                  if (
                    save({
                      ...data,
                      workouts: [
                        ...data.workouts.filter((w) => w.id !== record.id),
                        record,
                      ],
                    })
                  )
                    setModal(null);
                } else {
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
                  defaultValue={
                    modal === "workout" ? editing?.date || viewToday : viewToday
                  }
                  max={viewToday}
                />
              </label>
              {modal === "workout" ? (
                <>
                  <label>
                    運動類型
                    <select name="type" defaultValue={editing?.type || "home"}>
                      {Object.entries(names).map(([key, name]) => (
                        <option value={key} key={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      分鐘數
                      <input
                        name="minutes"
                        type="number"
                        min="1"
                        max="1440"
                        step="1"
                        required
                        defaultValue={editing?.minutes || 30}
                      />
                    </label>
                    <label>
                      消耗熱量（kcal）
                      <input
                        name="calories"
                        type="number"
                        min="0"
                        max="20000"
                        required
                        defaultValue={editing?.calories ?? 0}
                      />
                    </label>
                  </div>
                  <label>
                    備註
                    <textarea
                      name="note"
                      maxLength={2000}
                      rows={3}
                      defaultValue={editing?.note}
                      placeholder="今天的感受、訓練內容…"
                    />
                  </label>
                </>
              ) : (
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
              )}
              <button
                className="primary full"
                disabled={!!workspace.cloud}
                type="submit"
              >
                儲存紀錄 <Check size={18} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function todayDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
createRoot(document.getElementById("root")!).render(<App />);
