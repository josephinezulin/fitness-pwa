import { Plus } from "lucide-react";
import { useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { type Metric } from "../model";
import {
  HEALTH_SERIES,
  healthTrend,
  trendNumber,
  trendValue,
  type HealthField,
} from "../trends";
import { TrendData, TrendTooltip } from "../TrendData";
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
  metric: HealthField;
  setMetric: (metric: HealthField) => void;
  cloud: boolean;
  onAdd: () => void;
}) {
  const id = `health-${useId().replace(/:/g, "")}`;
  const { rows, observed, latest } = healthTrend(
    metrics,
    viewToday,
    range,
    metric,
  );
  const chosen = HEALTH_SERIES[metric];
  return (
    <section className="card chart" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <div>
          <span className="eyebrow">每一點進步，都值得記錄</span>
          <h2 id={`${id}-heading`}>身體的變化</h2>
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
      <div className="tabs" role="group" aria-label="健康趨勢指標">
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
            aria-pressed={metric === id}
            onClick={() => setMetric(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="trend-summary" id={`${id}-summary`} aria-live="polite">
        近 {range} 天有 {observed.length} 天{chosen.label}紀錄
        {latest ? (
          <>
            ；最新{" "}
            <span className="trend-measurement">
              {trendValue(latest.value, chosen.unit)}
            </span>
            <span className="trend-measurement">
              （<time dateTime={latest.date}>{latest.date}</time>）
            </span>
            。
          </>
        ) : (
          "。"
        )}
      </p>
      {observed.length ? (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={225}>
            <AreaChart
              key={`${metric}:${range}:${viewToday}`}
              data={rows}
              accessibilityLayer
              aria-label={`${chosen.label}近${range}天趨勢圖`}
              aria-describedby={`${id}-summary ${id}-help`}
              margin={{ top: 20, right: 10, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
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
                isAnimationActive={false}
                filterNull={false}
                content={({ active, label, payload }) => (
                  <TrendTooltip
                    active={active}
                    date={String(label ?? "")}
                    label={chosen.label}
                    value={trendValue(
                      typeof payload?.[0]?.value === "number"
                        ? payload[0].value
                        : null,
                      chosen.unit,
                    )}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="value"
                connectNulls={false}
                stroke="#68856b"
                strokeWidth={2.5}
                fill={`url(#${id}-fill)`}
                dot={({
                  cx,
                  cy,
                  index,
                }: {
                  cx?: number;
                  cy?: number;
                  index?: number;
                }) => {
                  // Connected observations use the original uncluttered curve.
                  // Keep a dot when an observation has no line to either side.
                  const isolated =
                    index !== undefined &&
                    rows[index]?.value != null &&
                    rows[index - 1]?.value == null &&
                    rows[index + 1]?.value == null;
                  return isolated ? (
                    <circle
                      key={`dot-${index}`}
                      className="recharts-area-dot"
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#68856b"
                      stroke="#68856b"
                    />
                  ) : (
                    <g key={`dot-${index}`} />
                  );
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty">
          這 {range} 天尚無{chosen.label}紀錄，有新的量測時再記下一筆。
          <button disabled={cloud} onClick={onAdd}>
            新增健康數據 <Plus size={15} />
          </button>
        </div>
      )}
      <p className="muted tiny" id={`${id}-help`}>
        每日一筆摘要；缺少紀錄的日期留空，不連接前後資料點。圖表可用左右方向鍵查看，亦可展開每日數值。
        {cloud && metric === "heart" ? " · 心率為當日樣本算術平均" : ""}
      </p>
      <TrendData
        summary="查看每日數值"
        caption={`近 ${range} 天${chosen.label}每日摘要（截至 ${viewToday}）`}
        dateHeading="日期"
        valueHeading={`${chosen.label}（${chosen.unit}）`}
        rows={rows.map((row) => ({
          date: row.date,
          value: row.value === null ? "未記錄" : trendNumber(row.value),
        }))}
      />
    </section>
  );
}
