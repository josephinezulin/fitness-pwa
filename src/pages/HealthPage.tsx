import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Metric } from "../model";
import { calendarDaysEnding } from "../calendar";
import { HEALTH_SERIES, trendValue, type HealthField } from "../trends";
export function HealthPage({
  metrics,
  cloud,
  canEdit = !cloud,
  workspaceKey,
  viewToday,
  range,
  chart,
  onAdd,
  onDelete,
}: {
  metrics: Metric[];
  cloud: boolean;
  canEdit?: boolean;
  workspaceKey: string;
  viewToday: string;
  range: number;
  chart: ReactNode;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <button
        className="secondary metric-add"
        disabled={cloud || !canEdit}
        onClick={onAdd}
      >
        <Plus size={16} />
        新增健康數據
      </button>
      {chart}
      <HealthHistory
        key={`${workspaceKey}:${viewToday}:${range}`}
        metrics={metrics}
        cloud={cloud}
        canEdit={canEdit}
        viewToday={viewToday}
        range={range}
        onDelete={onDelete}
      />
    </>
  );
}

const HISTORY_BATCH = 14;

function HealthHistory({
  metrics,
  cloud,
  canEdit,
  viewToday,
  range,
  onDelete,
}: Pick<
  Parameters<typeof HealthPage>[0],
  "metrics" | "cloud" | "canEdit" | "viewToday" | "range" | "onDelete"
>) {
  const id = `health-history-${useId().replace(/:/g, "")}`;
  const [allDates, setAllDates] = useState(false);
  const [limit, setLimit] = useState(HISTORY_BATCH);
  const pendingFocus = useRef<string | null>(null);
  const sorted = useMemo(
    () => [...metrics].sort((a, b) => b.date.localeCompare(a.date)),
    [metrics],
  );
  const start = calendarDaysEnding(viewToday, range)[0];
  const rows = allDates
    ? sorted
    : sorted.filter((m) => m.date >= start && m.date <= viewToday);
  const visible = rows.slice(0, limit);
  return (
    <section className="card metric-list" aria-labelledby={`${id}-heading`}>
      <div className="section-head health-history-head">
        <h2 id={`${id}-heading`}>健康摘要</h2>
        <label className="health-history-all">
          <input
            type="checkbox"
            checked={allDates}
            onChange={(event) => {
              setAllDates(event.target.checked);
              setLimit(HISTORY_BATCH);
              pendingFocus.current = null;
            }}
          />
          全部日期
        </label>
      </div>
      <p className="health-history-status" role="status" aria-atomic="true">
        {allDates ? "全部日期" : `近 ${range} 天`} · 已顯示 {visible.length} /{" "}
        {rows.length} 筆
      </p>
      <p className="muted tiny">
        最新日期在前；未量測的項目顯示未記錄。
        {cloud ? "雲端健康摘要為唯讀。" : ""}
      </p>
      {rows.length ? (
        <ul
          className="health-history-list"
          aria-label="健康摘要紀錄"
          id={`${id}-list`}
        >
          {visible.map((m) => (
            <li key={m.id}>
              <div className="health-history-date">
                <h3
                  tabIndex={-1}
                  ref={(node) => {
                    if (node && pendingFocus.current === m.id) {
                      pendingFocus.current = null;
                      node.focus();
                    }
                  }}
                >
                  <time dateTime={m.date}>{m.date}</time>
                  {m.date > viewToday && (
                    <span className="muted tiny">（未來日期）</span>
                  )}
                </h3>
                {!cloud && (
                  <button
                    className="icon-button"
                    disabled={!canEdit}
                    aria-label={`刪除 ${m.date} 健康摘要`}
                    onClick={() => onDelete(m.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <dl className="health-history-values">
                {(Object.keys(HEALTH_SERIES) as HealthField[]).map((field) => (
                  <div key={field}>
                    <dt>{HEALTH_SERIES[field].label}</dt>
                    <dd>{trendValue(m[field], HEALTH_SERIES[field].unit)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="health-history-empty">
          {metrics.length
            ? `近 ${range} 天沒有健康摘要，勾選「全部日期」可查看其他紀錄。`
            : cloud
              ? "連接的試算表尚無健康摘要。"
              : "尚無健康摘要，新增健康數據就能開始記錄。"}
        </p>
      )}
      {visible.length < rows.length && (
        <button
          className="secondary health-history-more"
          aria-controls={`${id}-list`}
          onClick={() => {
            pendingFocus.current = rows[limit]?.id ?? null;
            setLimit((current) => current + HISTORY_BATCH);
          }}
        >
          再顯示 {Math.min(HISTORY_BATCH, rows.length - visible.length)} 筆
        </button>
      )}
    </section>
  );
}
