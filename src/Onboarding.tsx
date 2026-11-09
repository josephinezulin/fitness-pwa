import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Scale,
  Smile,
  Target,
  CalendarDays,
} from "lucide-react";
import { WORKOUT_TYPES, type WorkoutPlan, type WorkoutType } from "./model";

const WEEKDAY = "一二三四五六日";
const ease = [0.16, 1, 0.3, 1] as const;

export type OnboardingResult = {
  nickname: string;
  weight: number | null;
  weeklyGoal: number | null;
  plans: WorkoutPlan[] | null;
};

const PLAN_MINUTES: Partial<Record<WorkoutType, [number, number]>> = {
  home: [20, 30],
  walk: [30, 60],
  run: [20, 40],
  strength: [30, 45],
};
/** Turn the chosen days into full plan records. */
export function plansFromDays(
  days: Record<number, WorkoutType>,
): WorkoutPlan[] {
  return Object.entries(days)
    .map(([day, type]) => {
      const weekday = Number(day);
      const [min, max] = PLAN_MINUTES[type] || [20, 40];
      return {
        id: `plan-${weekday}-${type}`,
        weekday,
        type,
        title: type === "walk" ? "上坡快走" : WORKOUT_TYPES[type].label,
        minMinutes: min,
        maxMinutes: max,
        tutorialUrl: "",
        active: true,
      };
    })
    .sort((a, b) => a.weekday - b.weekday);
}

/** First-time setup for people browsing without signing in. Every step can be skipped. */
export function Onboarding({
  onFinish,
}: {
  onFinish: (result: OnboardingResult) => void;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [nickname, setNickname] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("150");
  const [days, setDays] = useState<Record<number, WorkoutType>>({
    1: "home",
    3: "walk",
    6: "home",
  });
  const [touched, setTouched] = useState({
    weight: false,
    goal: false,
    plans: false,
  });
  const weightValue = Number(weight);
  const weightOk = weight === "" || (weightValue >= 1 && weightValue <= 500);
  const goalValue = Number(goal);
  const goalOk =
    Number.isInteger(goalValue) && goalValue >= 10 && goalValue <= 2000;
  const finish = () =>
    onFinish({
      nickname: nickname.trim(),
      weight: touched.weight && weight !== "" && weightOk ? weightValue : null,
      weeklyGoal: touched.goal && goalOk ? goalValue : null,
      plans: touched.plans ? plansFromDays(days) : null,
    });
  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    if (next > 3) finish();
    else setStep(next);
  };
  const steps = [
    {
      icon: Smile,
      title: "怎麼稱呼你？",
      body: (
        <input
          aria-label="暱稱"
          maxLength={20}
          autoFocus
          placeholder="暱稱"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      ),
      ok: true,
    },
    {
      icon: Scale,
      title: "目前體重",
      body: (
        <label className="unit-input">
          <input
            aria-label="目前體重（kg）"
            type="number"
            inputMode="decimal"
            min="1"
            max="500"
            step="0.1"
            placeholder="0.0"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setTouched((t) => ({ ...t, weight: true }));
            }}
          />
          <span>kg</span>
        </label>
      ),
      ok: weightOk,
    },
    {
      icon: Target,
      title: "每週想動幾分鐘？",
      body: (
        <>
          <label className="unit-input">
            <input
              aria-label="每週目標（分鐘）"
              type="number"
              inputMode="numeric"
              min="10"
              max="2000"
              step="1"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setTouched((t) => ({ ...t, goal: true }));
              }}
            />
            <span>分</span>
          </label>
          <div className="goal-chips">
            {[90, 150, 210].map((n) => (
              <button
                key={n}
                type="button"
                className={goalValue === n ? "on" : ""}
                onClick={() => {
                  setGoal(String(n));
                  setTouched((t) => ({ ...t, goal: true }));
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      ),
      ok: goalOk,
    },
    {
      icon: CalendarDays,
      title: "哪幾天要運動？",
      body: (
        <div className="plan-setup">
          <div className="day-toggles" role="group" aria-label="運動日">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <motion.button
                key={d}
                type="button"
                aria-pressed={!!days[d]}
                aria-label={`週${WEEKDAY[d - 1]}`}
                className={days[d] ? "on" : ""}
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  setTouched((t) => ({ ...t, plans: true }));
                  setDays((all) => {
                    const next = { ...all };
                    if (next[d]) delete next[d];
                    else next[d] = "home";
                    return next;
                  });
                }}
              >
                {WEEKDAY[d - 1]}
              </motion.button>
            ))}
          </div>
          {Object.keys(days)
            .map(Number)
            .sort((a, b) => a - b)
            .map((d) => (
              <label className="day-type" key={d}>
                <span>週{WEEKDAY[d - 1]}</span>
                <select
                  aria-label={`週${WEEKDAY[d - 1]}運動`}
                  value={days[d]}
                  onChange={(e) => {
                    setTouched((t) => ({ ...t, plans: true }));
                    setDays((all) => ({
                      ...all,
                      [d]: e.target.value as WorkoutType,
                    }));
                  }}
                >
                  {Object.entries(WORKOUT_TYPES).map(([key, t]) => (
                    <option key={key} value={key}>
                      {key === "walk" ? "上坡快走" : t.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
      ),
      ok: true,
    },
  ];
  const current = steps[step];
  return (
    <motion.div
      className="welcome onboarding"
      role="dialog"
      aria-modal="true"
      aria-label="初次設定"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="onboarding-top">
        <div className="dots" aria-hidden="true">
          {steps.map((_, i) => (
            <motion.i
              key={i}
              animate={{
                width: i === step ? 22 : 8,
                opacity: i <= step ? 1 : 0.35,
              }}
              transition={{ duration: 0.35, ease }}
            />
          ))}
        </div>
        <button className="text-button quiet" onClick={finish}>
          略過
        </button>
      </div>
      <div className="onboarding-stage">
        <motion.section
          key={step}
          className="onboarding-card card"
          initial={{ opacity: 0, x: 60 * direction }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          <div className="onboarding-icon">
            <current.icon size={26} />
          </div>
          <h2>{current.title}</h2>
          {current.body}
        </motion.section>
      </div>
      <div className="onboarding-nav">
        {step > 0 ? (
          <button
            className="icon-button round"
            aria-label="上一步"
            onClick={() => go(step - 1)}
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span />
        )}
        <motion.button
          className="primary"
          disabled={!current.ok}
          whileTap={{ scale: 0.95 }}
          onClick={() => go(step + 1)}
        >
          {step === steps.length - 1 ? (
            <>
              開始 <Check size={18} />
            </>
          ) : (
            <>
              下一步 <ArrowRight size={18} />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
