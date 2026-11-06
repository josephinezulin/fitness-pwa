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
} from "lucide-react";
import {
  WORKOUT_TYPES,
  treadmillSummary,
  type Workout,
  type WorkoutType,
} from "../model";
import { pace } from "../exercise";
import { TreadmillStats } from "../WorkoutForm";
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
  onDelete,
  limit,
  expanded,
  setExpanded,
}: {
  workouts: Workout[];
  canEdit: boolean;
  onBegin: (workout?: Workout) => void;
  onDelete: (id: string) => void;
  limit?: number;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  return (
    <section className="card logs">
      <div className="section-head">
        <h2>運動紀錄</h2>
        <button
          className="text-button"
          disabled={!canEdit}
          onClick={() => onBegin()}
        >
          新增紀錄 <Plus size={16} />
        </button>
      </div>
      {workouts.length ? (
        [...workouts]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, limit)
          .map((w) => {
            const Icon = typeIcon(w.type);
            return (
              <div className="log-wrap" key={w.id}>
                <div className="log">
                  <div className="plan-icon">
                    <Icon size={20} />
                  </div>
                  <div className="grow">
                    <h3>{WORKOUT_TYPES[w.type].label}</h3>
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
      ) : (
        <div className="empty">
          你的運動故事，從第一筆開始。
          <button disabled={!canEdit} onClick={() => onBegin()}>
            記錄一次運動 <ArrowUpRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
