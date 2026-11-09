import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Dumbbell, Pencil, Plus, Play, X } from "lucide-react";
import {
  completed,
  validatePlans,
  WORKOUT_TYPES,
  type Workout,
  type WorkoutPlan,
  type WorkoutType,
} from "../model";
import { samePlan } from "../plans";
import { parseYouTubeId } from "../videos";

const weekdays = "一二三四五六日";
export function WeeklySchedule({
  plans,
  workouts,
  viewToday,
  days,
  onManage,
}: {
  plans: WorkoutPlan[];
  workouts: Workout[];
  viewToday: string;
  days: string[];
  onManage: () => void;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const sorted = [...plans].sort(
    (a, b) => a.weekday - b.weekday || a.id.localeCompare(b.id),
  );
  const done = sorted.filter((p) =>
    completed(workouts, days[p.weekday - 1], p.type),
  ).length;
  return (
    <section className="card schedule">
      <div className="section-head">
        <div>
          <h2>本週課表</h2>
        </div>
        <span className="pill">
          {done} / {plans.length} 完成
        </span>
      </div>
      <div className="week-strip">
        {days.map((d, i) => (
          <div key={d} className={d === viewToday ? "current" : ""}>
            <span>{weekdays[i]}</span>
            <b>{+d.slice(-2)}</b>
            <i
              className={plans.some((p) => p.weekday === i + 1) ? "dot" : ""}
            />
          </div>
        ))}
      </div>
      {sorted.map((p) => {
        const ok = completed(workouts, days[p.weekday - 1], p.type),
          videoId = parseYouTubeId(p.tutorialUrl);
        return (
          <div key={p.id}>
            <div className="plan">
              <div className={"plan-icon " + (ok ? "checked" : "")}>
                {ok ? <Check size={20} /> : <Dumbbell size={20} />}
              </div>
              <div className="grow">
                <small>
                  週{weekdays[p.weekday - 1]} ·{" "}
                  {days[p.weekday - 1].slice(5).replace("-", "/")}
                </small>
                <h3>{p.title}</h3>
                <p>
                  {p.minMinutes === p.maxMinutes
                    ? p.minMinutes
                    : `${p.minMinutes}–${p.maxMinutes}`}{" "}
                  分鐘 · {WORKOUT_TYPES[p.type].label}
                </p>
                {p.tutorialUrl &&
                  (videoId ? (
                    <button
                      className="inline-link"
                      onClick={() => setPlaying(playing === p.id ? null : p.id)}
                      aria-expanded={playing === p.id}
                    >
                      <Play size={14} />{" "}
                      {playing === p.id ? "收起教學" : "播放教學"}
                    </button>
                  ) : (
                    <a
                      href={p.tutorialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      在 YouTube 尋找教學
                    </a>
                  ))}
              </div>
              <span className={ok ? "status done" : "status"}>
                {ok ? "已完成" : "待完成"}
              </span>
            </div>
            {playing === p.id && videoId && (
              <div className="plan-player">
                <iframe
                  title={`${p.title}教學`}
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <a
                  href={p.tutorialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  無法播放？在 YouTube 開啟
                </a>
              </div>
            )}
          </div>
        );
      })}
      {!plans.length && (
        <p className="guide">目前沒有啟用的課表，仍可自由記錄運動。</p>
      )}
      <p className="tiny muted">
        記錄同日、同類型運動，即自動完成打卡。分鐘數為建議範圍。
      </p>
      <button className="text-button" onClick={onManage}>
        管理我的課表 <Pencil size={14} />
      </button>
    </section>
  );
}

export function PlanManager({
  plans,
  canEdit,
  onSave,
  onDraftChange,
}: {
  plans: WorkoutPlan[];
  canEdit: boolean;
  onSave: (plans: WorkoutPlan[]) => boolean;
  onDraftChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<WorkoutPlan | "new" | null>(null);
  const [error, setError] = useState("");
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    let target: HTMLElement | null;
    if (editing) {
      target = titleRef.current;
    } else {
      const opener = openerRef.current;
      if (!opener) return;
      openerRef.current = null;
      target =
        opener.isConnected && !opener.disabled ? opener : headingRef.current;
    }
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
  }, [editing]);
  useEffect(() => {
    onDraftChange(!!editing);
    return () => onDraftChange(false);
  }, [editing, onDraftChange]);
  function commit(next: WorkoutPlan[]) {
    try {
      const safe = validatePlans(next);
      if (!onSave(safe)) return false;
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  return (
    <section
      className="card plan-manager"
      aria-labelledby={`${formId}-manager`}
    >
      <div className="section-head">
        <div>
          <h2 id={`${formId}-manager`} ref={headingRef} tabIndex={-1}>
            管理課表
          </h2>
        </div>
        <button
          className="text-button"
          disabled={!canEdit || !!editing}
          aria-expanded={editing === "new"}
          aria-controls={editing === "new" ? formId : undefined}
          onClick={(event) => {
            openerRef.current = event.currentTarget;
            setError("");
            setEditing("new");
          }}
        >
          <Plus size={16} />
          新增課表
        </button>
      </div>
      <p className="tiny muted">
        啟用的課表會每週重複；停用後保留設定，既有運動紀錄也會保留。同一天可安排不同類型的運動。
      </p>
      {plans.map((p) => (
        <div className="log" key={p.id}>
          <div className="grow">
            <h3>{p.title}</h3>
            <p>
              週{weekdays[p.weekday - 1]} · {WORKOUT_TYPES[p.type].label} ·{" "}
              {p.minMinutes}–{p.maxMinutes} 分鐘 ·{" "}
              {p.active ? "已啟用" : "已停用"}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label={`編輯${p.title}`}
            disabled={!canEdit || !!editing}
            aria-expanded={editing !== "new" && editing?.id === p.id}
            aria-controls={
              editing !== "new" && editing?.id === p.id ? formId : undefined
            }
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setError("");
              setEditing({ ...p });
            }}
          >
            <Pencil size={16} />
          </button>
          <button
            className="text-button"
            aria-label={`${p.active ? "停用" : "啟用"}${p.title}`}
            disabled={!canEdit || !!editing}
            onClick={() =>
              commit(
                plans.map((x) =>
                  x.id === p.id ? { ...x, active: !x.active } : x,
                ),
              )
            }
          >
            {p.active ? "停用" : "啟用"}
          </button>
        </div>
      ))}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <form
          className="plan-form"
          id={formId}
          aria-labelledby={`${formId}-title`}
          onSubmit={(event) => {
            event.preventDefault();
            if (!canEdit) return;
            if (
              editing !== "new" &&
              !samePlan(
                editing,
                plans.find((p) => p.id === editing.id),
              )
            ) {
              setError(
                "課表已更新，你的草稿仍保留；請取消後重新編輯最新內容。",
              );
              return;
            }
            const fields = new FormData(event.currentTarget);
            const plan: WorkoutPlan = {
              id: editing === "new" ? crypto.randomUUID() : editing.id,
              weekday: Number(fields.get("weekday")),
              type: String(fields.get("type")) as WorkoutType,
              title: String(fields.get("title")).trim(),
              minMinutes: Number(fields.get("minMinutes")),
              maxMinutes: Number(fields.get("maxMinutes")),
              tutorialUrl: String(fields.get("tutorialUrl")).trim(),
              active: fields.get("active") === "on",
            };
            if (commit([...plans.filter((p) => p.id !== plan.id), plan]))
              setEditing(null);
          }}
        >
          <div className="section-head">
            <h3 id={`${formId}-title`}>
              {editing === "new" ? "新增課表" : "編輯課表"}
            </h3>
            <button
              type="button"
              className="icon-button"
              aria-label="取消編輯課表"
              onClick={() => {
                setEditing(null);
                setError("");
              }}
            >
              <X size={18} />
            </button>
          </div>
          <fieldset disabled={!canEdit}>
            <label>
              課表名稱
              <input
                name="title"
                ref={titleRef}
                required
                maxLength={200}
                defaultValue={editing === "new" ? "" : editing.title}
              />
            </label>
            <div className="form-grid">
              <label>
                星期
                <select
                  name="weekday"
                  defaultValue={editing === "new" ? 1 : editing.weekday}
                >
                  {Array.from(weekdays).map((day, i) => (
                    <option key={day} value={i + 1}>
                      週{day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                運動類型
                <select
                  name="type"
                  defaultValue={editing === "new" ? "home" : editing.type}
                >
                  {Object.entries(WORKOUT_TYPES).map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                最少分鐘
                <input
                  type="number"
                  inputMode="numeric"
                  name="minMinutes"
                  min={1}
                  max={1440}
                  step={1}
                  required
                  defaultValue={editing === "new" ? 20 : editing.minMinutes}
                />
              </label>
              <label>
                最多分鐘
                <input
                  type="number"
                  inputMode="numeric"
                  name="maxMinutes"
                  min={1}
                  max={1440}
                  step={1}
                  required
                  defaultValue={editing === "new" ? 30 : editing.maxMinutes}
                />
              </label>
            </div>
            <label>
              YouTube 教學網址（選填）
              <input
                name="tutorialUrl"
                type="url"
                inputMode="url"
                maxLength={2000}
                defaultValue={editing === "new" ? "" : editing.tutorialUrl}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing === "new" || editing.active}
              />
              啟用，每週安排這個課表
            </label>
            <button className="primary" type="submit">
              儲存課表 <Check size={16} />
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
