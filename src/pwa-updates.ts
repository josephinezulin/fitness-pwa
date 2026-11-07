type UpdateRegistration = Pick<
  ServiceWorkerRegistration,
  "update" | "installing" | "waiting"
>;
const CHECK_INTERVAL = 60_000;

/** Opportunistic foreground checks only: no timer, activation or health requests. */
export function watchPwaUpdates(registration: UpdateRegistration) {
  let active = true;
  let running = false;
  let lastCheck = Date.now();
  async function check() {
    const now = Date.now();
    const elapsed = now - lastCheck;
    if (
      !active ||
      running ||
      document.visibilityState !== "visible" ||
      !navigator.onLine ||
      registration.installing ||
      registration.waiting ||
      (elapsed >= 0 && elapsed < CHECK_INTERVAL)
    )
      return;
    lastCheck = now;
    running = true;
    try {
      await registration.update();
    } catch {
      // A transient network failure must not interrupt offline recording.
      // Another foreground event after the cooldown can try again.
    } finally {
      running = false;
    }
  }
  const resume = () => {
    void check();
  };
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", resume);
  return () => {
    active = false;
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
