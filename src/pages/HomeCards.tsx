import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  Check,
  ChevronRight,
  Footprints,
  Play,
  Plus,
  RefreshCw,
  Scale,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  completed,
  WORKOUT_TYPES,
  type Metric,
  type Workout,
  type WorkoutPlan,
} from "../model";
import {
  BUILT_IN_VIDEOS,
  LIGHT_CATEGORIES,
  embedUrl,
  thumbnailUrl,
  type Video,
} from "../videos";
import { CountUp } from "../motion-ui";

const WEEKDAY = "一二三四五六日";
const spring = { type: "spring", stiffness: 500, damping: 26 } as const;

/** Visual tick only; the whole row is the interactive checkbox. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span className={"check-box" + (checked ? " on" : "")} aria-hidden="true">
      {checked && (
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring}
        >
          <Check size={16} strokeWidth={3} />
        </motion.span>
      )}
    </span>
  );
}

/** Same suggestion all day; skips recently watched videos when possible. */
export function suggestVideo(
  day: string,
  offset: number,
  seen: Record<string, number>,
  categories: readonly string[],
  hidden: string[] = [],
): Video | null {
  const pool = BUILT_IN_VIDEOS.filter(
    (v) =>
      categories.includes(v.category) &&
      (v.minutes ?? 99) <= 10 &&
      !hidden.includes(v.id),
  );
  const fresh = pool.filter((v) => !seen[v.youtubeId]);
  const list = fresh.length ? fresh : pool;
  if (!list.length) return null;
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return list[(hash + offset) % list.length];
}

/** Short video for days with nothing planned, or a stretch once today's plan is done. */
export function TodaySuggestion({
  plans,
  workouts,
  viewToday,
  days,
  canEdit,
  seen,
  hidden,
  onVideoDone,
}: {
  plans: WorkoutPlan[];
  workouts: Workout[];
  viewToday: string;
  days: string[];
  canEdit: boolean;
  seen: Record<string, number>;
  hidden: string[];
  onVideoDone: (video: Video) => void;
}) {
  const index = days.indexOf(viewToday);
  const today = plans.filter((p) => p.weekday === index + 1);
  const allDone =
    today.length > 0 &&
    today.every((p) => completed(workouts, viewToday, p.type));
  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const showVideo = !today.length || allDone;
  const video = showVideo
    ? suggestVideo(
        viewToday,
        offset,
        seen,
        allDone ? ["伸展放鬆"] : LIGHT_CATEGORIES,
        hidden,
      )
    : null;
  return (
    <>
      {video && (
        <div className="suggest">
          <div className="suggest-label">
            {allDone ? (
              <span aria-hidden="true">💪</span>
            ) : (
              <BedDouble size={16} aria-hidden="true" />
            )}
            <span>
              今天 · {video.category}
              {video.minutes ? ` · ${video.minutes} 分` : ""}
            </span>
          </div>
          <div className="suggest-label">
            <BedDouble size={16} aria-hidden="true" />
            <span>
              {video.category}
              {video.minutes ? ` · ${video.minutes} 分` : ""}
            </span>
          </div>
          {playing ? (
            <div className="player-frame">
              <iframe
                src={embedUrl(video.youtubeId)}
                title={video.title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <button
              type="button"
              className="suggest-thumb"
              aria-label={`播放：${video.title}`}
              onClick={() => setPlaying(true)}
            >
              <img src={thumbnailUrl(video.youtubeId)} alt="" loading="lazy" />
              <span className="play">
                <Play size={20} />
              </span>
            </button>
          )}
          <p className="suggest-title">
            {video.title}
            {video.simplified && <span className="lang">簡中</span>}
          </p>
          <div className="suggest-actions">
            <button
              type="button"
              className="icon-button round"
              aria-label="換一個"
              onClick={() => {
                setPlaying(false);
                setOffset((n) => n + 1);
              }}
            >
              <RefreshCw size={18} />
            </button>
            <motion.button
              type="button"
              className="primary small"
              disabled={!canEdit}
              onClick={() => onVideoDone(video)}
              whileTap={{ scale: 0.94 }}
            >
              <Check size={18} />
              動完了
            </motion.button>
          </div>
        </div>
      )}
    </>
  );
}

export function WeekChecklist({
  plans,
  workouts,
  viewToday,
  days,
  canEdit,
  onCheck,
  onUncheck,
}: {
  plans: WorkoutPlan[];
  workouts: Workout[];
  viewToday: string;
  days: string[];
  canEdit: boolean;
  onCheck: (plan: WorkoutPlan, date: string) => void;
  onUncheck: (plan: WorkoutPlan, date: string) => void;
}) {
  const sorted = [...plans].sort((a, b) => a.weekday - b.weekday);
  return (
    <>
      <ol className="week-dots" aria-label="本週每天">
        {days.map((d, i) => {
          const planned = plans.filter((p) => p.weekday === i + 1);
          const moved = workouts.some((w) => w.date === d && w.minutes > 0);
          const state =
            moved ||
            (planned.length &&
              planned.every((p) => completed(workouts, d, p.type)))
              ? "done"
              : planned.length
                ? "planned"
                : "rest";
          return (
            <li
              key={d}
              className={state + (d === viewToday ? " today" : "")}
              aria-label={`週${WEEKDAY[i]} ${state === "done" ? "已運動" : state === "planned" ? "有課表" : "休息"}`}
            >
              <span>{WEEKDAY[i]}</span>
              <motion.i
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...spring, delay: 0.04 * i }}
              />
            </li>
          );
        })}
      </ol>
      <ul className="week-list">
        {sorted.map((p) => {
          const date = days[p.weekday - 1];
          const done = completed(workouts, date, p.type);
          const future = date > viewToday;
          return (
            <li
              key={p.id}
              className={
                (done ? "done" : "") + (date === viewToday ? " is-today" : "")
              }
            >
              <motion.button
                type="button"
                className="week-row"
                role="checkbox"
                aria-checked={done}
                aria-label={`週${WEEKDAY[p.weekday - 1]} ${p.title}${date === viewToday ? "（今天）" : ""}${done ? "（已完成）" : ""}`}
                disabled={!canEdit || future}
                onClick={() => (done ? onUncheck(p, date) : onCheck(p, date))}
                whileTap={{ scale: 0.98 }}
              >
                <CheckMark checked={done} />
                <span className="day">週{WEEKDAY[p.weekday - 1]}</span>
                <span className="grow title">{p.title}</span>
                {date === viewToday && <span className="today-tag">今天</span>}
              </motion.button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

const shortDate = (d: string) => d.slice(5).replace("-", "/");
function movingAverage(rows: { date: string; value: number }[]) {
  return rows.map((row) => {
    const start = new Date(row.date + "T12:00:00");
    start.setDate(start.getDate() - 6);
    const from = start.toISOString().slice(0, 10);
    const window = rows.filter((r) => r.date >= from && r.date <= row.date);
    return (
      Math.round(
        (window.reduce((s, r) => s + r.value, 0) / window.length) * 100,
      ) / 100
    );
  });
}

export function WeightCard({
  metrics,
  viewToday,
  onOpen,
  onAdd,
  canAdd,
}: {
  metrics: Metric[];
  viewToday: string;
  onOpen: () => void;
  onAdd: () => void;
  canAdd: boolean;
}) {
  const [range, setRange] = useState(7);
  const all = useMemo(
    () =>
      metrics
        .filter((m) => m.weight !== undefined && m.date <= viewToday)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({ date: m.date, value: m.weight! })),
    [metrics, viewToday],
  );
  const cutoff = new Date(viewToday + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - range + 1);
  const from = cutoff.toISOString().slice(0, 10);
  const rows = all.filter((r) => r.date >= from);
  const avg = movingAverage(all);
  const chart = rows.map((r) => ({
    date: r.date,
    weight: r.value,
    avg: avg[all.indexOf(r)],
  }));
  const latest = all.at(-1);
  const delta =
    rows.length > 1
      ? Math.round((rows.at(-1)!.value - rows[0].value) * 10) / 10
      : null;
  return (
    <article className="card weight-card">
      <div className="card-title">
        <h2>
          <Scale size={17} aria-hidden="true" /> 體重
        </h2>
        <div className="card-actions">
          <button
            type="button"
            className="icon-button round"
            aria-label="記錄健康數據"
            disabled={!canAdd}
            onClick={onAdd}
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            className="icon-button round"
            aria-label="看完整趨勢"
            onClick={onOpen}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {latest ? (
        <>
          <div className="weight-head">
            <strong className="big-number">
              <CountUp value={latest.value} format={(n) => n.toFixed(1)} />
              <small>kg</small>
            </strong>
            {delta !== null && delta !== 0 && (
              <span className={"delta " + (delta < 0 ? "down" : "up")}>
                {delta < 0 ? (
                  <ArrowDownRight size={15} />
                ) : (
                  <ArrowUpRight size={15} />
                )}
                {Math.abs(delta)}
                <small>（{range} 天）</small>
              </span>
            )}
          </div>
          {chart.length > 1 ? (
            <div className="weight-chart" aria-hidden="true">
              <ResponsiveContainer width="100%" height={150}>
                <LineChart
                  data={chart}
                  margin={{ top: 8, right: 6, left: 6, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#8a968c" }}
                    minTickGap={24}
                  />
                  <YAxis hide domain={["dataMin - 0.4", "dataMax + 0.4"]} />
                  <Tooltip
                    formatter={(v, name) => [
                      `${v} kg`,
                      name === "avg" ? "7 日平均" : "體重",
                    ]}
                    labelFormatter={(d) => shortDate(String(d))}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#9fb9a6"
                    strokeWidth={1.5}
                    dot={{ r: 2.5, fill: "#9fb9a6", strokeWidth: 0 }}
                    isAnimationActive
                    animationDuration={900}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="url(#weight-avg)"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                  />
                  <defs>
                    <linearGradient id="weight-avg" x1="0" x2="1">
                      <stop offset="0%" stopColor="#43c48a" />
                      <stop offset="100%" stopColor="#1f7a5a" />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="weight-chart empty-chart" />
          )}
          <div className="seg" role="group" aria-label="體重範圍">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={range === n}
                className={range === n ? "on" : ""}
                onClick={() => setRange(n)}
              >
                {range === n && (
                  <motion.i layoutId="weight-seg" className="seg-pill" />
                )}
                <span>{n} 天</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-weight" aria-hidden="true">
          <Scale size={28} />
        </div>
      )}
    </article>
  );
}

export function MiniStats({
  metrics,
  viewToday,
}: {
  metrics: Metric[];
  viewToday: string;
}) {
  const fat = [...metrics]
    .filter((m) => m.fat !== undefined && m.date <= viewToday)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const steps = metrics.find((m) => m.date === viewToday)?.steps;
  return (
    <div className="mini-stats">
      <article className="card mini">
        <span>
          <Activity size={15} aria-hidden="true" /> 最新體脂率
        </span>
        <strong className="stat-value">
          {fat?.fat !== undefined ? (
            <CountUp value={fat.fat} format={(n) => n.toFixed(1)} />
          ) : (
            "—"
          )}
          <small>%</small>
        </strong>
      </article>
      <article className="card mini">
        <span>
          <Footprints size={15} aria-hidden="true" /> 今日步數
        </span>
        <strong className="stat-value">
          {steps !== undefined ? (
            <CountUp
              value={steps}
              format={(n) => Math.round(n).toLocaleString()}
            />
          ) : (
            "—"
          )}
          <small>步</small>
        </strong>
      </article>
    </div>
  );
}

export const typeLabel = (type: Workout["type"]) => WORKOUT_TYPES[type].label;
