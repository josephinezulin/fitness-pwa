import { useId, useState } from "react";
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
export function WeeklyGoal({
  minutes,
  goal,
  onChange,
}: {
  minutes: number;
  goal: number;
  onChange: (goal: number) => boolean;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  const left = Math.max(0, Math.round((goal - minutes) * 10) / 10);
  return (
    <section className="card weekly-goal">
      <div className="section-head">
        <div>
          <span className="eyebrow">一點一點，累積自己的節奏</span>
          <h2>本週累積運動</h2>
        </div>
        <button className="text-button" onClick={() => setEditing((v) => !v)}>
          調整目標
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
            }
          }}
        >
          <label htmlFor={id}>每週目標（分鐘）</label>
          <input
            id={id}
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
const SERIES = {
  minutes: { label: "運動分鐘", unit: "分" },
  distance: { label: "跑步機距離", unit: "km" },
  incline: { label: "平均坡度", unit: "%" },
} as const;
export function WeeklyActivity({
  workouts,
  reference,
}: {
  workouts: Workout[];
  reference: string;
}) {
  const [metric, setMetric] = useState<keyof typeof SERIES>("minutes");
  const rows = weeklyActivity(workouts, reference),
    chosen = SERIES[metric];
  return (
    <section className="card weekly-activity">
      <div className="section-head">
        <div>
          <span className="eyebrow">最近 8 週</span>
          <h2>看見每週的小進步</h2>
        </div>
      </div>
      <div className="chips" role="tablist" aria-label="每週運動趨勢">
        {Object.entries(SERIES).map(([key, s]) => (
          <button
            key={key}
            role="tab"
            aria-selected={metric === key}
            onClick={() => setMetric(key as keyof typeof SERIES)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="weekly-chart">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            data={rows}
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
              labelFormatter={(_, items) =>
                `週一 ${items[0]?.payload.week || ""}`
              }
              formatter={(value) => [`${value} ${chosen.unit}`, chosen.label]}
            />
            <Bar dataKey={metric} fill="#718d65" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="tiny muted">
        以週一分週；距離只統計有分段的跑步機紀錄，平均坡度按時間加權，無分段的週次不補
        0。
      </p>
    </section>
  );
}
