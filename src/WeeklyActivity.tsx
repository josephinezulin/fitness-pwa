import { useId, useLayoutEffect, useRef, useState } from "react";
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
export function WeeklyGoal({
  minutes,
  goal,
  onChange,
  onDraftChange,
}: {
  minutes: number;
  goal: number;
  onChange: (goal: number) => boolean;
  onDraftChange?: (open: boolean) => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    onDraftChange?.(editing);
    return () => onDraftChange?.(false);
  }, [editing, onDraftChange]);
  const left = Math.max(0, Math.round((goal - minutes) * 10) / 10);
  return (
    <section className="card weekly-goal">
      <div className="section-head">
        <div>
          <span className="eyebrow">一點一點，累積自己的節奏</span>
          <h2>本週累積運動</h2>
        </div>
        <button
          ref={toggleRef}
          className="text-button"
          aria-expanded={editing}
          aria-controls={editing ? `${id}-editor` : undefined}
          onClick={() => {
            setError("");
            setEditing((value) => !value);
          }}
        >
          {editing ? "取消調整" : "調整目標"}
        </button>
      </div>
      <p className="goal-total">
        <strong>{minutes}</strong> / {goal} <span>分鐘</span>
      </p>
      <progress
        aria-label="本週運動分鐘進度"
        max={goal}
        value={Math.min(minutes, goal)}
      />
      <p className="tiny muted">
        {left
          ? `距離這週的目標還有 ${left} 分鐘，每次短短運動也算進步。`
          : "這週已達到自己的累積目標，做得很好。"}
      </p>
      {editing && (
        <form
          id={`${id}-editor`}
          aria-label="每週運動目標"
          className="goal-editor"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(new FormData(e.currentTarget).get("goal"));
            if (!Number.isInteger(n) || n < 10 || n > 2000) {
              setError("目標需為 10–2000 分鐘的整數。");
              return;
            }
            if (onChange(n)) {
              setEditing(false);
              setError("");
              toggleRef.current?.focus();
            }
          }}
        >
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
            defaultValue={goal}
          />
          <button className="secondary" type="submit">
            儲存目標
          </button>
          <p className="tiny muted">
            目標儲存在此裝置，依本機或登入帳號／試算表分開保存。
          </p>
          {error && (
            <p role="status" className="cloud-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
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
          <h2 id={`${id}-heading`}>看見每週的小進步</h2>
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
                  | (WeeklyRow & { value: number | null })
                  | undefined;
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
