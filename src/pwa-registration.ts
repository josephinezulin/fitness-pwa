export type PwaRegistrationCallbacks = {
  onRegisteredSW: (
    url: string,
    registration: ServiceWorkerRegistration,
  ) => void;
  onNeedRefresh: () => void;
  onOfflineReady: () => void;
  onRegisterError: () => void;
  onReloadReady: () => void;
};

/** Registration and activation are shared by tabs; reloading is a per-page decision. */
export function registerPwa(callbacks: PwaRegistrationCallbacks) {
  let active = true;
  let controller = navigator.serviceWorker?.controller ?? null;
  let changedController = false;
  let refreshNeeded = false;
  let requested: ServiceWorker | null = null;
  const container = navigator.serviceWorker;
  const cleanups: (() => void)[] = [];
  const observed = new Map<ServiceWorker, () => void>();
  const url = new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI);
  function needRefresh() {
    refreshNeeded = true;
    callbacks.onNeedRefresh();
  }
  function captureController() {
    const next = container?.controller;
    if (!active || !next || next === controller) return false;
    const previous = controller;
    controller = next;
    if (!previous && !refreshNeeded) return false;
    changedController = true;
    needRefresh();
    return true;
  }
  function controllerChanged() {
    if (!captureController()) return;
    const matchesRequest = requested === controller;
    requested = null;
    if (matchesRequest) callbacks.onReloadReady();
  }
  function observe(
    registration: ServiceWorkerRegistration,
    worker: ServiceWorker | null,
  ) {
    if (!worker || observed.has(worker)) return;
    const firstInstall =
      !controller && (!registration.active || registration.active === worker);
    const stateChanged = () => {
      if (!active) return;
      if (worker.state === "installed" && !firstInstall) needRefresh();
      if (worker.state === "activated" && firstInstall)
        callbacks.onOfflineReady();
      if (worker.state === "activated" || worker.state === "redundant") {
        worker.removeEventListener("statechange", stateChanged);
        observed.delete(worker);
      }
    };
    observed.set(worker, stateChanged);
    worker.addEventListener("statechange", stateChanged);
    stateChanged();
  }
  if (container)
    container.addEventListener("controllerchange", controllerChanged);
  const ready = container
    ? Promise.resolve()
        .then(() =>
          container.register(url.href, { scope: new URL(".", url).href }),
        )
        .then((registration) => {
          if (!active) return registration;
          const updateFound = () =>
            observe(registration, registration.installing);
          registration.addEventListener("updatefound", updateFound);
          cleanups.push(() =>
            registration.removeEventListener("updatefound", updateFound),
          );
          observe(registration, registration.installing);
          observe(registration, registration.waiting);
          if (!controller) observe(registration, registration.active);
          callbacks.onRegisteredSW(url.href, registration);
          return registration;
        })
        .catch(() => {
          if (active) callbacks.onRegisterError();
          return null;
        })
    : Promise.resolve(null);
  return {
    async update() {
      const registration = await ready;
      if (!active) return;
      captureController();
      if (changedController) {
        requested = null;
        callbacks.onReloadReady();
        return;
      }
      const waiting = registration?.waiting;
      if (!waiting) throw Error("新版本尚未就緒。");
      requested = waiting;
      try {
        waiting.postMessage({ type: "SKIP_WAITING" });
      } catch (error) {
        requested = null;
        throw error;
      }
    },
    dispose() {
      active = false;
      requested = null;
      container?.removeEventListener("controllerchange", controllerChanged);
      observed.forEach((listener, worker) =>
        worker.removeEventListener("statechange", listener),
      );
      observed.clear();
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}

export function reloadPwaPage() {
  window.location.reload();
}
