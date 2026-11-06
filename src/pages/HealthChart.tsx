import { Plus } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { dateKey, type Metric } from "../model";
export function HealthChart({
  metrics,
  viewToday,
  range,
  setRange,
  metric,
  setMetric,
  cloud,
  onAdd,
}: {
  metrics: Metric[];
  viewToday: string;
  range: number;
  setRange: (range: number) => void;
  metric: "weight" | "fat" | "heart" | "steps";
  setMetric: (metric: "weight" | "fat" | "heart" | "steps") => void;
  cloud: boolean;
  onAdd: () => void;
}) {
  const cutoff = new Date(viewToday + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - range + 1);
  const rows = metrics
    .filter(
      (m) =>
        m.date >= dateKey(cutoff) &&
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
          <button disabled={cloud} onClick={onAdd}>
            新增健康數據 <Plus size={15} />
          </button>
        </div>
      )}
      <p className="muted tiny">
        每日一筆摘要 · 缺值不補 0
        {cloud && metric === "heart" ? " · 心率為當日樣本算術平均" : ""}
      </p>
    </section>
  );
}
