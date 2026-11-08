import type { ReactNode } from "react";
import { Activity, Scale, Footprints, CalendarCheck } from "lucide-react";
import { WeeklyGoal } from "../WeeklyActivity";
import { CountUp, Sparkline } from "../motion-ui";
import type { Metric } from "../model";

type Field = "weight" | "fat" | "steps";

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
}) {
  const history = (field: Field) =>
    [...metrics]
      .filter((m) => m[field] !== undefined && m.date <= viewToday)
      .sort((a, b) => a.date.localeCompare(b.date));
  const weights = history("weight"),
    fats = history("fat"),
    steps = history("steps");
  const w = weights.at(-1),
    f = fats.at(-1),
    today = metrics.find((m) => m.date === viewToday)?.steps;
  const short = (date?: string) => date?.slice(5).replace("-", "/");
  const tiles = [
    {
      label: "最新體重",
      value: w?.weight,
      decimals: 1,
      unit: "kg",
      icon: Scale,
      sub: short(w?.date),
      trend: weights.slice(-14).map((m) => m.weight!),
      color: "sage",
    },
    {
      label: "最新體脂率",
      value: f?.fat,
      decimals: 1,
      unit: "%",
      icon: Activity,
      sub: short(f?.date),
      trend: fats.slice(-14).map((m) => m.fat!),
      color: "sand",
    },
    {
      label: "今日步數",
      value: today,
      decimals: 0,
      unit: "步",
      icon: Footprints,
      sub: undefined,
      trend: steps.slice(-14).map((m) => m.steps!),
      color: "blue",
      format: (n: number) => Math.round(n).toLocaleString(),
    },
  ];
  return (
    <>
      <div className="hero">
        <WeeklyGoal
          minutes={weekMinutes}
          goal={weeklyGoal}
          onChange={onGoalChange}
          onDraftChange={onGoalDraftChange}
        >
          {planCount > 0 && (
            <p className="ring-chip">
              <CalendarCheck size={14} aria-hidden="true" />
              課表 {done}/{planCount}
            </p>
          )}
        </WeeklyGoal>
        <div className="tiles">
          {tiles.map((s) => (
            <article className={"card stat " + s.color} key={s.label}>
              <div className="stat-top">
                <span>{s.label}</span>
                <div className="stat-icon">
                  <s.icon size={17} />
                </div>
              </div>
              <div className="stat-value">
                {s.value === undefined ? (
                  "—"
                ) : (
                  <CountUp
                    value={s.value}
                    decimals={s.decimals}
                    format={s.format}
                  />
                )}
                <small>{s.unit}</small>
              </div>
              <div className="stat-foot">
                {s.sub && <span>{s.sub}</span>}
                <Sparkline values={s.trend} />
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="two-column">
        {chart}
        {schedule}
      </div>
      {logs}
    </>
  );
}
