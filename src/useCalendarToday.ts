import { useCallback, useSyncExternalStore } from "react";
import { calendarDateInZone } from "./calendar";
import { dateKey } from "./model";

function subscribe(onChange: () => void) {
  const visible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  window.addEventListener("focus", visible);
  window.addEventListener("pageshow", visible);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("focus", visible);
    window.removeEventListener("pageshow", visible);
    document.removeEventListener("visibilitychange", visible);
  };
}

/** A stable day key; foreground events notify React without polling or reloading. */
export function useCalendarToday(timezone?: string): string {
  const snapshot = useCallback(() => {
    const now = new Date();
    return timezone ? calendarDateInZone(now, timezone) : dateKey(now);
  }, [timezone]);
  return useSyncExternalStore(subscribe, snapshot);
}
