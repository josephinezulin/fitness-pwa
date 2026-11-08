import type { ReactNode } from "react";
import {
  Activity,
  Scale,
  Footprints,
  Flame,
  Leaf,
  ArrowUpRight,
} from "lucide-react";
import { WeeklyGoal } from "../WeeklyActivity";
import type { Metric } from "../model";
export function OverviewPage({
  metrics,
  viewToday,
  weekMinutes,
  weeklyGoal,
  done,
  planCount,
  chart,
  schedule,
  logs,
  onGoalChange,
  onGoalDraftChange,
  onSchedule,
}: {
  metrics: Metric[];
  viewToday: string;
  weekMinutes: number;
  weeklyGoal: number;
  done: number;
  planCount: number;
  chart: ReactNode;
  schedule: ReactNode;
  logs: ReactNode;
  onGoalChange: (goal: number) => boolean;
  onGoalDraftChange?: (open: boolean) => void;
  onSchedule: () => void;
}) {
  const latest = (field: keyof Metric) =>
    [...metrics]
      .filter((m) => m[field] !== undefined && m.date <= viewToday)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  const w = latest("weight"),
    f = latest("fat"),
    steps = metrics.find((m) => m.date === viewToday)?.steps;
  return (
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
            value: weekMinutes,
            unit: "分鐘",
            icon: Flame,
            sub: `本週目標 ${weeklyGoal} 分鐘 · 課表 ${done}/${planCount} 完成`,
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
      <WeeklyGoal
        minutes={weekMinutes}
        goal={weeklyGoal}
        onChange={onGoalChange}
        onDraftChange={onGoalDraftChange}
      />
      <div className="two-column">
        {chart}
        {schedule}
      </div>
      <div className="two-column bottom">
        {logs}
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
          <button onClick={onSchedule}>
            看看本週安排 <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
    </>
  );
}
