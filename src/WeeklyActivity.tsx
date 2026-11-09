import { SaveButton, useSaveFeedback } from "./SaveFeedback";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { weeklyActivity } from "./exercise";
import type { Workout } from "./model";
import {
  WEEKLY_SERIES as SERIES,
  weeklyValue,
  weeklyMissing,
  trendNumber,
  trendValue,
  type WeeklyRow,
} from "./trends";
import { TrendData, TrendTooltip } from "./TrendData";
import { CountUp, ProgressRing } from "./motion-ui";
import { motion } from "motion/react";
import { Target, X } from "lucide-react";
export function WeeklyGoal({
  minutes,
  goal,
  onChange,
  onDraftChange,
  children,
}: {
  minutes: number;
  goal: number;
  onChange: (goal: number) => boolean;
  onDraftChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const id = useId();
  const feedback = useSaveFeedback();
  const [editingGoal, setEditingGoal] = useState<number | null>(null),
    [error, setError] = useState("");
  const editing = editingGoal !== null;
  const goalChanged = editing && !feedback.saved && goal !== editingGoal;
  const toggleRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    onDraftChange?.(editing);
    return () => onDraftChange?.(false);
  }, [editing, onDraftChange]);
  const left = Math.max(0, Math.round((goal - minutes) * 10) / 10);
  return (
    <article className={"card weekly-goal" + (left ? "" : " reached")}>
      <div className="week-head">
        <ProgressRing value={minutes} goal={goal} size={52} stroke={7} />
        <div className="grow">
          <h2>本週運動</h2>
          <p className="week-total">
            <strong className="stat-value">
              <CountUp value={minutes} decimals={1} />
            </strong>
            <span className="goal-total"> / {goal} 分</span>
            {!left && (
              <motion.span
                className="cheer-inline"
                aria-hidden="true"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                🎉
              </motion.span>
            )}
          </p>
        </div>
        <button
          ref={toggleRef}
          className="icon-button round"
          aria-label={editing ? "取消調整" : "調整目標"}
          disabled={feedback.saved}
          aria-expanded={editing}
          aria-controls={editing ? `${id}-editor` : undefined}
          onClick={() => {
            feedback.cancel();
            setError("");
            setEditingGoal(editing ? null : goal);
          }}
        >
          {editing ? <X size={17} /> : <Target size={17} />}
        </button>
      </div>
      <progress
        className="sr-only"
        aria-label="本週運動分鐘進度"
        max={goal}
        value={Math.min(minutes, goal)}
      />
      <p className="sr-only">
        {left ? `還差 ${left} 分鐘` : "已達到自己的累積目標"}
      </p>
      {children}
      {editing && (
        <form
          id={`${id}-editor`}
          aria-label="每週運動目標"
          className="goal-editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (goalChanged || feedback.pending()) return;
            const n = Number(new FormData(e.currentTarget).get("goal"));
            if (!Number.isInteger(n) || n < 10 || n > 2000) {
              setError("目標需為 10–2000 分鐘的整數。");
              return;
            }
            if (onChange(n))
              feedback.finish(() => {
                setEditingGoal(null);
                setError("");
                toggleRef.current?.focus();
              });
          }}
        >
          {goalChanged && (
            <p className="notice" role="alert">
              每週目標已更新為 {goal}{" "}
              分鐘，草稿仍保留。請先記下需要的數值，再取消調整並重新開啟。
            </p>
          )}
          <label htmlFor={id}>每週目標（分鐘）</label>
          <input
            id={id}
            autoFocus
            name="goal"
            type="number"
            min="10"
            max="2000"
            step="1"
            required
            defaultValue={editingGoal ?? goal}
          />
          <SaveButton
            feedback={feedback}
            className="secondary"
            disabled={goalChanged}
          >
            儲存目標
          </SaveButton>
          {error && (
            <p role="status" className="cloud-error">
              {error}
            </p>
          )}
        </form>
      )}
    </article>
  );
}
export function WeeklyActivity({
  workouts,
  reference,
}: {
  workouts: Workout[];
  reference: string;
}) {
  const [metric, setMetric] = useState<keyof typeof SERIES>("minutes");
  const id = `weekly-${useId().replace(/:/g, "")}`;
  const rows = weeklyActivity(workouts, reference).map((row) => ({
      ...row,
      value: weeklyValue(row, metric),
    })),
    chosen = SERIES[metric];
  const current = rows.at(-1)!;
  return (
    <section className="card weekly-activity" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <div>
          <span className="eyebrow">最近 8 週</span>
          <h2 id={`${id}-heading`}>每週趨勢</h2>
        </div>
      </div>
      <div className="chips" role="group" aria-label="每週運動趨勢指標">
        {Object.entries(SERIES).map(([key, s]) => (
          <button
            key={key}
            className={metric === key ? "selected" : ""}
            aria-pressed={metric === key}
            onClick={() => setMetric(key as keyof typeof SERIES)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="trend-summary" id={`${id}-summary`} aria-live="polite">
        最近 8 週有 {rows.filter((r) => r.value !== null).length} 週
        {chosen.label}紀錄；本週{" "}
        <span className="trend-measurement">
          {trendValue(
            current.value,
            chosen.unit,
            weeklyMissing(current, metric),
          )}
        </span>
        。
      </p>
      <div className="weekly-chart">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            key={`${metric}:${reference}`}
            data={rows}
            accessibilityLayer
            aria-label={`最近8週${chosen.label}趨勢圖`}
            aria-describedby={`${id}-summary ${id}-help`}
            margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e8ede1"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              isAnimationActive={false}
              filterNull={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as
                  (WeeklyRow & { value: number | null }) | undefined;
                return (
                  <TrendTooltip
                    active={active}
                    date={row ? `週一 ${row.week}` : ""}
                    label={chosen.label}
                    value={
                      row
                        ? trendValue(
                            row.value,
                            chosen.unit,
                            weeklyMissing(row, metric),
                          )
                        : "未記錄"
                    }
                  />
                );
              }}
            />
            <Bar
              dataKey="value"
              fill="#718d65"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="tiny muted" id={`${id}-help`}>
        以週一分週，僅統計截至 {reference}{" "}
        的紀錄。未記錄運動的週次留空；距離只計跑步機分段，坡度按時間加權，無分段不補
        0。 圖表可用左右方向鍵查看，亦可展開每週數值。
      </p>
      <TrendData
        summary="查看每週數值"
        caption={`最近 8 週${chosen.label}（截至 ${reference}）`}
        dateHeading="週一日期"
        valueHeading={`${chosen.label}（${chosen.unit}）`}
        rows={rows.map((row) => ({
          date: row.week,
          value:
            row.value === null
              ? weeklyMissing(row, metric)
              : trendNumber(row.value),
        }))}
      />
    </section>
  );
}
