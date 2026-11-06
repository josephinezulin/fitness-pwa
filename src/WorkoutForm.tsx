import { useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import {
  SEGMENT_LIMITS,
  WORKOUT_TYPES,
  treadmillSummary,
  type Segment,
  type Workout,
  type WorkoutType,
} from "./model";

type Draft = { minutes: string; speed: string; incline: string };
const toDraft = (s: Segment): Draft => ({
  minutes: String(s.minutes),
  speed: String(s.speed),
  incline: String(s.incline),
});
const groups = [...new Set(Object.values(WORKOUT_TYPES).map((t) => t.group))];
const defaultSegment = (type: WorkoutType): Draft =>
  type === "run"
    ? { minutes: "20", speed: "8", incline: "1" }
    : { minutes: "30", speed: "5.5", incline: "6" };

export function TreadmillStats({ segments }: { segments: Segment[] }) {
  const s = treadmillSummary(segments);
  return (
    <dl className="treadmill-stats">
      <div>
        <dt>總時間</dt>
        <dd>
          {s.minutes}
          <small> 分</small>
        </dd>
      </div>
      <div>
        <dt>總距離</dt>
        <dd>
          {s.distanceKm}
          <small> km</small>
        </dd>
      </div>
      <div>
        <dt>平均速度</dt>
        <dd>
          {s.avgSpeed}
          <small> km/h</small>
        </dd>
      </div>
      <div>
        <dt>平均坡度</dt>
        <dd>
          {s.avgIncline}
          <small> %</small>
        </dd>
      </div>
      <div>
        <dt>爬升高度</dt>
        <dd>
          {s.elevationM}
          <small> m</small>
        </dd>
      </div>
      <div>
        <dt>最高速／坡</dt>
        <dd>
          {s.maxSpeed}
          <small> / {s.maxIncline}%</small>
        </dd>
      </div>
    </dl>
  );
}

export function WorkoutForm({
  editing,
  today,
  disabled,
  onSave,
}: {
  editing: Workout | null;
  today: string;
  disabled: boolean;
  onSave: (record: Workout) => boolean;
}) {
  const [type, setType] = useState<WorkoutType>(editing?.type || "home");
  const [useTreadmill, setUseTreadmill] = useState(!!editing?.segments);
  const [segments, setSegments] = useState<Draft[]>(
    editing?.segments?.map(toDraft) || [
      defaultSegment(editing?.type || "walk"),
    ],
  );
  const [minutes, setMinutes] = useState(String(editing?.minutes || 30));
  const treadmill = WORKOUT_TYPES[type].treadmill && useTreadmill;
  const parsed: Segment[] = segments.map((d) => ({
    minutes: Number(d.minutes),
    speed: Number(d.speed),
    incline: Number(d.incline),
  }));
  const complete = parsed.every(
    (s, i) =>
      segments[i].minutes !== "" &&
      segments[i].speed !== "" &&
      segments[i].incline !== "" &&
      [s.minutes, s.speed, s.incline].every(Number.isFinite),
  );
  const total = treadmillSummary(complete ? parsed : []);
  const update = (i: number, field: keyof Draft, value: string) =>
    setSegments((all) =>
      all.map((d, j) => (j === i ? { ...d, [field]: value } : d)),
    );
  const [min, max] = [SEGMENT_LIMITS.minutes, SEGMENT_LIMITS.speed];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const record: Workout = {
          id: editing?.id || crypto.randomUUID(),
          date: String(form.get("date")),
          type,
          minutes: treadmill ? total.minutes : Number(minutes),
          calories: Number(form.get("calories")),
          note: String(form.get("note")).trim(),
        };
        if (treadmill) record.segments = parsed;
        onSave(record);
      }}
    >
      <label>
        日期
        <input
          name="date"
          type="date"
          required
          defaultValue={editing?.date || today}
          max={today}
        />
      </label>
      <label>
        運動類型
        <select
          name="type"
          value={type}
          onChange={(e) => {
            const next = e.target.value as WorkoutType;
            setType(next);
            if (!editing?.segments) setSegments([defaultSegment(next)]);
          }}
        >
          {groups.map((g) => (
            <optgroup label={g} key={g}>
              {Object.entries(WORKOUT_TYPES)
                .filter(([, t]) => t.group === g)
                .map(([key, t]) => (
                  <option value={key} key={key}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {WORKOUT_TYPES[type].treadmill && (
        <label className="check">
          <input
            type="checkbox"
            checked={useTreadmill}
            onChange={(e) => setUseTreadmill(e.target.checked)}
          />
          使用跑步機：分段記錄速度與坡度
        </label>
      )}
      {treadmill && (
        <fieldset className="segments">
          <legend>跑步機分段</legend>
          <div className="segment-head" aria-hidden="true">
            <span>#</span>
            <span>分鐘</span>
            <span>速度 km/h</span>
            <span>坡度 %</span>
            <span />
          </div>
          {segments.map((d, i) => (
            <div className="segment" key={i}>
              <span className="segment-no">{i + 1}</span>
              <input
                aria-label={`第 ${i + 1} 段分鐘`}
                type="number"
                inputMode="decimal"
                required
                min={min[0]}
                max={min[1]}
                step="0.5"
                value={d.minutes}
                onChange={(e) => update(i, "minutes", e.target.value)}
              />
              <input
                aria-label={`第 ${i + 1} 段速度`}
                type="number"
                inputMode="decimal"
                required
                min={max[0]}
                max={max[1]}
                step="0.1"
                value={d.speed}
                onChange={(e) => update(i, "speed", e.target.value)}
              />
              <input
                aria-label={`第 ${i + 1} 段坡度`}
                type="number"
                inputMode="decimal"
                required
                min={SEGMENT_LIMITS.incline[0]}
                max={SEGMENT_LIMITS.incline[1]}
                step="0.5"
                value={d.incline}
                onChange={(e) => update(i, "incline", e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`刪除第 ${i + 1} 段`}
                disabled={segments.length === 1}
                onClick={() =>
                  setSegments((all) => all.filter((_, j) => j !== i))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <div className="segment-actions">
            <button
              type="button"
              className="secondary"
              disabled={segments.length >= SEGMENT_LIMITS.count}
              onClick={() =>
                setSegments((all) => [
                  ...all,
                  {
                    minutes: "5",
                    speed: all.at(-1)?.speed || "5",
                    incline: "0",
                  },
                ])
              }
            >
              <Plus size={15} /> 新增一段
            </button>
            <button
              type="button"
              className="secondary"
              disabled={segments.length >= SEGMENT_LIMITS.count}
              onClick={() => setSegments((all) => [...all, { ...all.at(-1)! }])}
            >
              <Copy size={15} /> 複製上一段
            </button>
          </div>
          {complete && total.minutes > 0 ? (
            <TreadmillStats segments={parsed} />
          ) : (
            <p className="tiny muted">填完每段的分鐘、速度與坡度後顯示總量。</p>
          )}
          <p className="tiny muted">
            平均值依時間加權；距離＝速度×時間，爬升≈距離×坡度（估算）。
          </p>
        </fieldset>
      )}
      <div className="form-row">
        <label>
          分鐘數
          <input
            name="minutes"
            type="number"
            min="1"
            max="1440"
            step={treadmill ? "0.1" : "1"}
            required
            readOnly={treadmill}
            value={treadmill ? total.minutes || "" : minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label>
          消耗熱量（kcal）
          <input
            name="calories"
            type="number"
            min="0"
            max="20000"
            required
            defaultValue={editing?.calories ?? 0}
          />
        </label>
      </div>
      <label>
        備註
        <textarea
          name="note"
          maxLength={2000}
          rows={3}
          defaultValue={editing?.note}
          placeholder="今天的感受、訓練內容…"
        />
      </label>
      <button className="primary full" disabled={disabled} type="submit">
        儲存紀錄 <Check size={18} />
      </button>
    </form>
  );
}
