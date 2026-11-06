import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Metric } from "../model";
export function HealthPage({
  metrics,
  cloud,
  chart,
  onAdd,
  onDelete,
}: {
  metrics: Metric[];
  cloud: boolean;
  chart: ReactNode;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <button className="secondary metric-add" disabled={cloud} onClick={onAdd}>
        <Plus size={16} />
        新增健康數據
      </button>
      {chart}
      <section className="card metric-list">
        <h2>健康摘要</h2>
        {[...metrics]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((m) => (
            <div className="log" key={m.id}>
              <div className="grow">
                <h3>{m.date}</h3>
                <p>
                  {m.weight ?? "—"} kg · {m.fat ?? "—"} % · {m.heart ?? "—"} bpm
                  · {m.steps ?? "—"} 步
                </p>
              </div>
              <button
                className="icon-button"
                disabled={cloud}
                aria-label="刪除健康數據"
                onClick={() => onDelete(m.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
      </section>
    </>
  );
}
