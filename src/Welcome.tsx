import { useId } from "react";
import { motion } from "motion/react";
import { Activity, LoaderCircle } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

/** Full-screen entry: Google first, local browsing as the quiet alternative. */
export function Welcome({
  account,
  loginReady,
  waiting,
  onLogin,
  onLocal,
  error = "",
}: {
  account: string;
  loginReady: boolean;
  waiting: boolean;
  onLogin: () => void;
  onLocal: () => void;
  error?: string;
}) {
  const errorId = useId();
  return (
    <motion.div
      className="welcome"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <motion.div
        className="welcome-logo"
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <Activity size={44} />
      </motion.div>
      <motion.h1
        id="welcome-title"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease, delay: 0.15 }}
      >
        日常動作
      </motion.h1>
      <motion.p
        className="welcome-tag"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease, delay: 0.25 }}
      >
        每次開始都算數 🌱
      </motion.p>
      <motion.div
        className="welcome-actions"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease, delay: 0.35 }}
      >
        <motion.button
          className="primary google"
          disabled={!loginReady || waiting}
          onClick={onLogin}
          aria-describedby={error ? errorId : undefined}
          whileTap={{ scale: 0.95 }}
        >
          {!loginReady || waiting ? (
            <LoaderCircle className="spin" size={20} aria-hidden="true" />
          ) : (
            <span className="g-mark" aria-hidden="true">
              G
            </span>
          )}
          {error
            ? "重試 Google 連線"
            : account
              ? `以 ${account} 繼續`
              : "用 Google 開始"}
        </motion.button>
        {error && (
          <p className="welcome-error" id={errorId} role="alert">
            {error}
          </p>
        )}
        <button className="text-button quiet" onClick={onLocal}>
          先逛逛
        </button>
      </motion.div>
    </motion.div>
  );
}
