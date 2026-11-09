import { Check } from "lucide-react";
import type { Metric } from "./model";
import { SaveButton, useSaveFeedback } from "./SaveFeedback";

export function MetricForm({
  metrics,
  today,
  disabled,
  onSave,
  onSaved,
}: {
  metrics: Metric[];
  today: string;
  disabled: boolean;
  onSave: (record: Metric) => boolean;
  onSaved: () => void;
}) {
  const feedback = useSaveFeedback();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || feedback.pending()) return;
        const form = new FormData(event.currentTarget),
          date = String(form.get("date"));
        const old = metrics.find((metric) => metric.date === date);
        const record: Metric = { id: old?.id || crypto.randomUUID(), date };
        for (const key of ["weight", "fat", "heart", "steps"] as const) {
          const value = String(form.get(key));
          if (value !== "") record[key] = Number(value);
        }
        if (onSave(record)) feedback.finish(onSaved);
      }}
    >
      <label>
        日期
        <input
          name="date"
          type="date"
          required
          defaultValue={today}
          max={today}
        />
      </label>
      <p className="tiny muted">
        至少填寫一項。相同日期會取代當天摘要；未填欄位將清空。
      </p>
      {(
        [
          ["weight", "體重（kg）", 1, 500, 0.1],
          ["fat", "體脂率（%）", 0, 100, 0.1],
          ["heart", "心率（bpm）", 20, 250, 1],
          ["steps", "每日步數", 0, 200000, 1],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <label key={key}>
          {label}
          <input name={key} type="number" min={min} max={max} step={step} />
        </label>
      ))}
      <SaveButton
        feedback={feedback}
        disabled={disabled}
        className="primary full"
      >
        儲存紀錄 <Check size={18} />
      </SaveButton>
    </form>
  );
}
