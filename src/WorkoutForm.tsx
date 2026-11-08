import { useId, useState } from "react";
import {
  estimateEnergy,
  pace,
  segmentErrors,
  TREADMILL_PRESETS,
  weightForDate,
  type WorkoutDraft,
} from "./exercise";
import type { Metric } from "./model";
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
    ? { minutes: "20", speed: "8.5", incline: "1" }
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
        <dt>平均配速（約）</dt>
        <dd>
          {pace(s.avgSpeed) || "—"}
          <small> 分/km</small>
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
  metrics = [],
  initialDraft,
}: {
  editing: Workout | null;
  today: string;
  disabled: boolean;
  onSave: (record: Workout) => boolean;
  metrics?: Metric[];
  initialDraft?: WorkoutDraft | null;
}) {
  const [type, setType] = useState<WorkoutType>(
    editing?.type || initialDraft?.type || "home",
  );
  const [useTreadmill, setUseTreadmill] = useState(
    editing
      ? !!editing.segments
      : (initialDraft?.treadmill ?? initialDraft?.type === "walk"),
  );
  const [date, setDate] = useState(
    editing?.date || initialDraft?.date || today,
  );
  const [calories, setCalories] = useState(String(editing?.calories ?? 0));
  const [weightOverride, setWeightOverride] = useState("");
  const [appliedEstimate, setAppliedEstimate] = useState<string | null>(null);
  const errorsId = useId();
  const initialSegments = editing ? editing.segments : initialDraft?.segments;
  const [segments, setSegments] = useState<Draft[]>(
    initialSegments?.map(toDraft) || [
      defaultSegment(editing?.type || initialDraft?.type || "walk"),
    ],
  );
  const [segmentsModified, setSegmentsModified] = useState(!!initialSegments);
  const [minutes, setMinutes] = useState(
    String(editing?.minutes || initialDraft?.minutes || 30),
  );
  const [durationNotice, setDurationNotice] = useState("");
  const durationNoticeId = useId();
  const treadmill = WORKOUT_TYPES[type].treadmill && useTreadmill;
  const parsed: Segment[] = segments.map((d) => ({
    minutes: d.minutes === "" ? NaN : Number(d.minutes),
    speed: d.speed === "" ? NaN : Number(d.speed),
    incline: d.incline === "" ? NaN : Number(d.incline),
  }));
  const complete = parsed.every(
    (s, i) =>
      segments[i].minutes !== "" &&
      segments[i].speed !== "" &&
      segments[i].incline !== "" &&
      [s.minutes, s.speed, s.incline].every(Number.isFinite),
  );
  const errors = treadmill ? segmentErrors(parsed) : [];
  const total = treadmillSummary(complete && !errors.length ? parsed : []);
  const weightMetric = weightForDate(metrics, date);
  const weight =
    weightOverride === ""
      ? (weightMetric?.weight ?? NaN)
      : Number(weightOverride);
  const estimate = estimateEnergy(
    type,
    treadmill ? total.minutes : Number(minutes),
    weight,
    treadmill ? parsed : undefined,
  );
  const signature = JSON.stringify([
    date,
    type,
    treadmill,
    treadmill ? segments : minutes,
    weight,
  ]);
  const changeSegments = (next: Draft[] | ((all: Draft[]) => Draft[])) => {
    setSegmentsModified(true);
    setSegments(next);
  };
  const carryTreadmillMinutes = () => {
    if (!complete || errors.length || total.minutes < 1) {
      setDurationNotice("分段尚未完成或超出範圍，未帶入總時間；請確認分鐘數。");
      return;
    }
    const wholeMinutes = Math.round(total.minutes);
    setMinutes(String(wholeMinutes));
    setDurationNotice(
      wholeMinutes === total.minutes
        ? `已帶入分段總時間 ${wholeMinutes} 分鐘，可自行調整。`
        : `分段共 ${total.minutes} 分鐘；未使用分段時以整數 ${wholeMinutes} 分鐘記錄，可自行調整。`,
    );
  };
  const update = (i: number, field: keyof Draft, value: string) =>
    changeSegments((all) =>
      all.map((d, j) => (j === i ? { ...d, [field]: value } : d)),
    );
  const [min, max] = [SEGMENT_LIMITS.minutes, SEGMENT_LIMITS.speed];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.length || (treadmill && !complete)) return;
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
      {!editing && initialDraft?.fromDate && (
        <p className="workout-draft-note">
          已帶入 {initialDraft.fromDate} 的設定
        </p>
      )}
      {!editing && (
        <div className="preset-list quick" aria-label="跑步機範本">
          {TREADMILL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"preset-chip" + (p.type === "run" ? " run" : "")}
              onClick={() => {
                setType(p.type);
                setUseTreadmill(true);
                setDurationNotice("");
                changeSegments(p.segments.map(toDraft));
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}
      <label>
        日期
        <input
          name="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
            setDurationNotice("");
            if (treadmill && !WORKOUT_TYPES[next].treadmill)
              carryTreadmillMinutes();
            setType(next);
            if (!editing) setUseTreadmill(next === "walk" || next === "run");
            if (!segmentsModified) setSegments([defaultSegment(next)]);
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
            onChange={(e) => {
              setDurationNotice("");
              if (!e.target.checked) carryTreadmillMinutes();
              setUseTreadmill(e.target.checked);
            }}
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
                step="any"
                aria-describedby={errors.length ? errorsId : undefined}
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
                step="any"
                aria-describedby={errors.length ? errorsId : undefined}
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
                step="any"
                aria-describedby={errors.length ? errorsId : undefined}
                value={d.incline}
                onChange={(e) => update(i, "incline", e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`刪除第 ${i + 1} 段`}
                disabled={segments.length === 1}
                onClick={() =>
                  changeSegments((all) => all.filter((_, j) => j !== i))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!!errors.length && (
            <ul id={errorsId} className="form-errors" role="status">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <div className="segment-actions">
            <button
              type="button"
              className="secondary"
              disabled={segments.length >= SEGMENT_LIMITS.count}
              onClick={() =>
                changeSegments((all) => [
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
              onClick={() =>
                changeSegments((all) => [...all, { ...all.at(-1)! }])
              }
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
            aria-describedby={
              !treadmill && durationNotice ? durationNoticeId : undefined
            }
            value={treadmill ? total.minutes || "" : minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              setDurationNotice("");
            }}
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
            value={calories}
            onChange={(e) => {
              setCalories(e.target.value);
              setAppliedEstimate(null);
            }}
          />
        </label>
      </div>
      {!treadmill && durationNotice && (
        <p id={durationNoticeId} className="workout-draft-note" role="status">
          {durationNotice}
        </p>
      )}
      <details className="energy-helper">
        <summary>幫我估算熱量</summary>
        <label>
          估算用體重（kg）
          <input
            aria-label="估算用體重（kg）"
            type="text"
            inputMode="decimal"
            value={weightOverride}
            placeholder={
              weightMetric?.weight ? String(weightMetric.weight) : "輸入體重"
            }
            onChange={(e) => setWeightOverride(e.target.value)}
          />
        </label>
        <p className="tiny muted">
          {weightOverride === "" && weightMetric
            ? `採用 ${weightMetric.date} 的 ${weightMetric.weight} kg；此處覆寫不會改健康紀錄。`
            : "這個體重只用於本次估算，不會改健康紀錄。"}
        </p>
        <p className="tiny">
          {estimate.calories !== null
            ? `約 ${estimate.calories} kcal · ${estimate.method}`
            : estimate.reason}
        </p>
        {estimate.calories !== null && (
          <p className="tiny muted">{estimate.reason}</p>
        )}
        <button
          type="button"
          className="secondary"
          disabled={estimate.calories === null}
          onClick={() => {
            if (estimate.calories !== null) {
              setCalories(String(estimate.calories));
              setAppliedEstimate(signature);
            }
          }}
        >
          套用估算熱量
        </button>
        {appliedEstimate && appliedEstimate !== signature && (
          <p className="tiny">
            設定已變更，已填熱量保留；需要時可重新套用估算。
          </p>
        )}
      </details>
      <label>
        備註
        <textarea
          name="note"
          maxLength={2000}
          rows={3}
          defaultValue={editing?.note || initialDraft?.note}
          placeholder="今天的感受、訓練內容…"
        />
      </label>
      <button className="primary full" disabled={disabled} type="submit">
        儲存紀錄 <Check size={18} />
      </button>
    </form>
  );
}
