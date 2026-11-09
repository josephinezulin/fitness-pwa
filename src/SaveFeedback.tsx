import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";

/** Only acknowledge accepted saves. Reduced-motion users and non-browser tests finish immediately. */
export function useSaveFeedback() {
  const [saved, setSaved] = useState(false);
  const completion = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      completion.current = null;
    },
    [],
  );
  function finish(action: () => void) {
    if (completion.current) return;
    if (
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      action();
      return;
    }
    completion.current = action;
    setSaved(true);
  }
  function complete() {
    const action = completion.current;
    if (!action) return;
    completion.current = null;
    setSaved(false);
    action();
  }
  function cancel() {
    completion.current = null;
    setSaved(false);
  }
  return {
    saved,
    finish,
    complete,
    cancel,
    pending: () => completion.current !== null,
  };
}

export function SaveButton({
  feedback,
  disabled = false,
  className = "primary",
  children,
}: {
  feedback: Pick<ReturnType<typeof useSaveFeedback>, "saved" | "complete">;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={`${className} save-feedback`}
      disabled={disabled || feedback.saved}
      aria-label={feedback.saved ? "已儲存" : undefined}
    >
      {feedback.saved ? (
        <>
          <motion.span
            className="save-check"
            aria-hidden="true"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.15, 1], opacity: [0, 1, 1] }}
            transition={{ duration: 0.32 }}
            onAnimationComplete={feedback.complete}
          >
            <Check size={21} strokeWidth={3} />
          </motion.span>
          <span className="sr-only" role="status">
            已儲存
          </span>
        </>
      ) : (
        <span className="save-label">{children}</span>
      )}
    </button>
  );
}
