import {
  ArrowUpRight,
  Plus,
  Pencil,
  Trash2,
  Footprints,
  Mountain,
  Bike,
  Waves,
  PersonStanding,
  Dumbbell,
  Copy,
} from "lucide-react";
import {
  WORKOUT_TYPES,
  treadmillSummary,
  type Workout,
  type WorkoutType,
} from "../model";
import { pace } from "../exercise";
import { TreadmillStats } from "../WorkoutForm";
import { useId, useMemo, useRef, useState } from "react";
import {
  emptyWorkoutFilters,
  workoutHistory,
  type WorkoutFilters,
} from "../workout-history";
const HISTORY_BATCH = 12;
const typeIcon = (type: WorkoutType) =>
  ({
    walk: Footprints,
    run: Footprints,
    hike: Mountain,
    cycling: Bike,
    swim: Waves,
    yoga: PersonStanding,
    pilates: PersonStanding,
    stretch: PersonStanding,
  })[type as string] || Dumbbell;
function workoutDetail(w: Workout) {
  if (!w.segments) return "";
  const t = treadmillSummary(w.segments);
  return `跑步機 ${w.segments.length} 段 · ${t.distanceKm} km · 均速 ${t.avgSpeed} km/h · 約 ${pace(t.avgSpeed)} 分/km · 均坡 ${t.avgIncline}% · 爬升 ${t.elevationM} m`;
}
export function WorkoutWeekSummary({
  weekWorkouts,
  weekMinutes,
}: {
  weekWorkouts: Workout[];
  weekMinutes: number;
}) {
  const weekTreadmill = treadmillSummary(
    weekWorkouts.flatMap((w) => w.segments || []),
  );
  return (
    <div className="week-summary">
      <div>
        <span>本週運動</span>
        <b>{weekWorkouts.length}</b>
        <small>次</small>
      </div>
      <div>
        <span>本週總時間</span>
        <b>{weekMinutes}</b>
        <small>分鐘</small>
      </div>
      <div>
        <span>跑步機距離</span>
        <b>{weekTreadmill.distanceKm}</b>
        <small>km</small>
      </div>
      <div>
        <span>跑步機均速／均坡</span>
        <b>{weekTreadmill.avgSpeed}</b>
        <small>km/h · {weekTreadmill.avgIncline}%</small>
      </div>
    </div>
  );
}
export function WorkoutLogs({
  workouts,
  canEdit,
  onBegin,
  onRepeat,
  onDelete,
  limit,
  history = false,
  expanded,
  setExpanded,
}: {
  workouts: Workout[];
  canEdit: boolean;
  onBegin: (workout?: Workout) => void;
  onRepeat: (workout: Workout) => void;
  onDelete: (id: string) => void;
  limit?: number;
  history?: boolean;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  const id = `workout-history-${useId().replace(/:/g, "")}`;
  const [filters, setFilters] = useState<WorkoutFilters>(emptyWorkoutFilters);
  const [shown, setShown] = useState(HISTORY_BATCH);
  const pendingFocus = useRef<string | null>(null);
  const result = useMemo(
    () => workoutHistory(workouts, history ? filters : emptyWorkoutFilters),
    [workouts, filters, history],
  );
  const visible = result.rows.slice(0, history ? shown : limit);
  const filtered =
    filters.query !== "" ||
    filters.type !== "all" ||
    !!filters.from ||
    !!filters.to;
  function changeFilters(next: WorkoutFilters) {
    pendingFocus.current = null;
    setFilters(next);
    setShown(HISTORY_BATCH);
  }
  return (
    <section className="card logs" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <h2 id={`${id}-heading`}>運動紀錄</h2>
        <button
          className="text-button"
          disabled={!canEdit}
          onClick={() => onBegin()}
        >
          新增紀錄 <Plus size={16} />
        </button>
      </div>
      {history && (
        <>
          <fieldset className="workout-filters">
            <legend>尋找運動紀錄</legend>
            <div className="workout-filter-fields">
              <label>
                搜尋運動紀錄
                <input
                  type="search"
                  placeholder="備註、日期、種類或跑步機"
                  maxLength={100}
                  value={filters.query}
                  onChange={(event) =>
                    changeFilters({ ...filters, query: event.target.value })
                  }
                />
              </label>
              <label>
                運動種類
                <select
                  value={filters.type}
                  onChange={(event) =>
                    changeFilters({
                      ...filters,
                      type: event.target.value as WorkoutFilters["type"],
                    })
                  }
                >
                  <option value="all">全部種類</option>
                  {Object.entries(WORKOUT_TYPES).map(([value, type]) => (
                    <option key={value} value={value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details>
              <summary>
                日期範圍{filters.from || filters.to ? "（已設定）" : ""}
              </summary>
              <div className="workout-filter-fields">
                <label>
                  開始日期
                  <input
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    aria-invalid={!!result.error}
                    aria-describedby={result.error ? `${id}-error` : undefined}
                    onChange={(event) =>
                      changeFilters({ ...filters, from: event.target.value })
                    }
                  />
                </label>
                <label>
                  結束日期
                  <input
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    aria-invalid={!!result.error}
                    aria-describedby={result.error ? `${id}-error` : undefined}
                    onChange={(event) =>
                      changeFilters({ ...filters, to: event.target.value })
                    }
                  />
                </label>
              </div>
            </details>
            {result.error && (
              <p className="error" id={`${id}-error`} role="alert">
                {result.error}
              </p>
            )}
            <button
              type="button"
              className="text-button"
              disabled={!filtered}
              onClick={() => changeFilters(emptyWorkoutFilters)}
            >
              清除篩選
            </button>
          </fieldset>
          <p
            className="workout-history-status"
            role="status"
            aria-atomic="true"
          >
            {result.error
              ? "請調整日期範圍後查看紀錄。"
              : `找到 ${result.rows.length} 筆 · 已顯示 ${visible.length} 筆（全部 ${workouts.length} 筆）`}
          </p>
          {!result.error && (
            <p className="tiny muted">
              符合條件的全部紀錄：{result.minutes.toLocaleString("zh-TW")} 分鐘
              · {result.calories.toLocaleString("zh-TW")} kcal。最新日期在前。
            </p>
          )}
        </>
      )}
      <div id={`${id}-rows`}>
        {visible.length ? (
          visible.map((w) => {
            const Icon = typeIcon(w.type);
            return (
              <div className="log-wrap" key={w.id}>
                <div className="log">
                  <div className="plan-icon">
                    <Icon size={20} />
                  </div>
                  <div className="grow">
                    <h3
                      tabIndex={history ? -1 : undefined}
                      aria-label={
                        history
                          ? `${w.date} ${WORKOUT_TYPES[w.type].label}`
                          : undefined
                      }
                      ref={(node) => {
                        if (node && pendingFocus.current === w.id) {
                          pendingFocus.current = null;
                          node.focus();
                        }
                      }}
                    >
                      {WORKOUT_TYPES[w.type].label}
                    </h3>
                    <p>
                      {w.date} · {w.minutes} 分鐘 · {w.calories} kcal
                    </p>
                    {w.segments && (
                      <p className="treadmill-line">
                        <button
                          className="inline-link"
                          aria-expanded={expanded === w.id}
                          onClick={() =>
                            setExpanded(expanded === w.id ? null : w.id)
                          }
                        >
                          {workoutDetail(w)}
                        </button>
                      </p>
                    )}
                    {w.note && <p className="note">{w.note}</p>}
                  </div>
                  <button
                    className="icon-button"
                    disabled={!canEdit}
                    aria-label="編輯運動"
                    onClick={() => onBegin(w)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={!canEdit}
                    aria-label="刪除運動"
                    onClick={() => onDelete(w.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <button
                  className="text-button repeat-workout"
                  disabled={!canEdit}
                  aria-label={`以 ${w.date} 的${WORKOUT_TYPES[w.type].label}再記一次`}
                  onClick={() => onRepeat(w)}
                >
                  <Copy size={15} /> 再記一次
                </button>
                {w.segments && expanded === w.id && (
                  <div className="segment-detail">
                    <TreadmillStats segments={w.segments} />
                    <table>
                      <thead>
                        <tr>
                          <th>段</th>
                          <th>分鐘</th>
                          <th>速度 km/h</th>
                          <th>坡度 %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.segments.map((s, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{s.minutes}</td>
                            <td>{s.speed}</td>
                            <td>{s.incline}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        ) : history && workouts.length ? (
          <p className="workout-history-empty">
            {result.error
              ? "目前未顯示紀錄，原資料仍保留。"
              : "沒有符合條件的紀錄，試試其他關鍵字或清除篩選。"}
          </p>
        ) : (
          <div className="empty">
            你的運動故事，從第一筆開始。
            <button disabled={!canEdit} onClick={() => onBegin()}>
              記錄一次運動 <ArrowUpRight size={15} />
            </button>
          </div>
        )}
      </div>
      {history && visible.length < result.rows.length && (
        <button
          type="button"
          className="secondary workout-history-more"
          aria-controls={`${id}-rows`}
          onClick={() => {
            pendingFocus.current = result.rows[visible.length].id;
            setShown((count) => count + HISTORY_BATCH);
          }}
        >
          再顯示 {Math.min(HISTORY_BATCH, result.rows.length - visible.length)}{" "}
          筆運動
        </button>
      )}
    </section>
  );
}
