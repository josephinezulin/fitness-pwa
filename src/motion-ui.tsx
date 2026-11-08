import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

/** True only in a real browser that allows motion; jsdom and reduced-motion users get final values immediately. */
function canAnimate(reduced: boolean | null) {
  return (
    !reduced &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Rolls a number up from its previous value. Text always settles on the exact formatted value. */
export function CountUp({
  value,
  decimals = 0,
  format,
}: {
  value: number;
  decimals?: number;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const show = (n: number) =>
    format ? format(n) : n.toFixed(decimals).replace(/\.0+$/, "");
  const [text, setText] = useState(() =>
    canAnimate(reduced) ? show(0) : show(value),
  );
  const from = useRef(canAnimate(reduced) ? 0 : value);
  useEffect(() => {
    if (!canAnimate(reduced)) {
      from.current = value;
      setText(show(value));
      return;
    }
    const controls = animate(from.current, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => setText(show(n)),
      onComplete: () => setText(show(value)),
    });
    from.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);
  return <>{text}</>;
}

/** Activity ring: one lap equals the goal; minutes past the goal draw a brighter second lap. */
export function ProgressRing({
  value,
  goal,
  size = 220,
  stroke = 18,
  children,
}: {
  value: number;
  goal: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const ratio = goal > 0 ? value / goal : 0;
  const first = Math.min(1, ratio);
  const extra = Math.min(1, Math.max(0, ratio - 1));
  const transition = canAnimate(reduced)
    ? { duration: 1.4, ease: [0.16, 1, 0.3, 1] as const }
    : { duration: 0 };
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ring-main" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ring-a)" />
            <stop offset="100%" stopColor="var(--ring-b)" />
          </linearGradient>
          <linearGradient id="ring-extra" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ring-c)" />
            <stop offset="100%" stopColor="var(--ring-a)" />
          </linearGradient>
        </defs>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        <motion.circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="url(#ring-main)"
          initial={{ pathLength: canAnimate(reduced) ? 0 : first }}
          animate={{ pathLength: first }}
          transition={transition}
        />
        {extra > 0 && (
          <motion.circle
            className="ring-value"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            stroke="url(#ring-extra)"
            initial={{ pathLength: canAnimate(reduced) ? 0 : extra }}
            animate={{ pathLength: extra }}
            transition={{ ...transition, delay: canAnimate(reduced) ? 1 : 0 }}
          />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/** Tiny trend line for stat tiles; draws itself in once. */
export function Sparkline({ values }: { values: number[] }) {
  const reduced = useReducedMotion();
  if (values.length < 2) return null;
  const w = 96,
    h = 32;
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <motion.path
        d={d}
        initial={{ pathLength: canAnimate(reduced) ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
      />
    </svg>
  );
}
