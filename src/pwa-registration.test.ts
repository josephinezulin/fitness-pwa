// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerPwa, type PwaRegistrationCallbacks } from "./pwa-registration";

class Worker extends EventTarget {
  state: ServiceWorkerState = "installing";
  postMessage = vi.fn();
  asWorker() {
    return this as unknown as ServiceWorker;
  }
  change(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}
class Registration extends EventTarget {
  active: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
  waiting: ServiceWorker | null = null;
  asRegistration() {
    return this as unknown as ServiceWorkerRegistration;
  }
}
class Container extends EventTarget {
  controller: ServiceWorker | null = null;
  register = vi.fn();
  claim(worker: Worker) {
    this.controller = worker.asWorker();
    this.dispatchEvent(new Event("controllerchange"));
  }
}
const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
let handles: ReturnType<typeof registerPwa>[];
beforeEach(() => {
  handles = [];
  vi.stubEnv("BASE_URL", "/fitness-pwa/");
});
afterEach(() => {
  handles.forEach((handle) => handle.dispose());
  if (original) Object.defineProperty(navigator, "serviceWorker", original);
  else Reflect.deleteProperty(navigator, "serviceWorker");
  vi.unstubAllEnvs();
});
function setup(controlled = true) {
  const container = new Container(),
    registration = new Registration(),
    old = new Worker();
  old.state = "activated";
  if (controlled) {
    container.controller = old.asWorker();
    registration.active = old.asWorker();
  }
  container.register.mockResolvedValue(registration.asRegistration());
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
  const callbacks: PwaRegistrationCallbacks = {
    onRegisteredSW: vi.fn(),
    onNeedRefresh: vi.fn(),
    onOfflineReady: vi.fn(),
    onRegisterError: vi.fn(),
    onReloadReady: vi.fn(),
  };
  const start = () => {
    const handle = registerPwa(callbacks);
    handles.push(handle);
    return handle;
  };
  const ready = () =>
    vi.waitFor(() => expect(callbacks.onRegisteredSW).toHaveBeenCalledOnce());
  return { container, registration, old, callbacks, start, ready };
}

describe("page-owned PWA activation and reload decisions", () => {
  it("registers under the Pages base and explicitly activates a waiting worker before requesting reload", async () => {
    const s = setup(),
      next = new Worker();
    next.state = "installed";
    s.registration.waiting = next.asWorker();
    const handle = s.start();
    await s.ready();
    const url = new URL("/fitness-pwa/sw.js", document.baseURI).href;
    expect(s.container.register).toHaveBeenCalledWith(url, {
      scope: new URL(".", url).href,
    });
    expect(s.callbacks.onNeedRefresh).toHaveBeenCalled();
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    await handle.update();
    expect(next.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    s.registration.waiting = null;
    s.registration.active = next.asWorker();
    s.container.claim(next);
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
    s.container.claim(next);
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
  });
  it("does not reload on another tab's activation and can reload explicitly without a waiting worker", async () => {
    const s = setup(),
      next = new Worker();
    const handle = s.start();
    await s.ready();
    s.registration.active = next.asWorker();
    s.container.claim(next);
    expect(s.callbacks.onNeedRefresh).toHaveBeenCalledOnce();
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    await handle.update();
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
    expect(next.postMessage).not.toHaveBeenCalled();
  });
  it("notifies first-install offline readiness on activation without requesting a reload", async () => {
    const s = setup(false),
      first = new Worker();
    s.registration.installing = first.asWorker();
    s.start();
    await s.ready();
    first.change("installed");
    expect(s.callbacks.onNeedRefresh).not.toHaveBeenCalled();
    expect(s.callbacks.onOfflineReady).not.toHaveBeenCalled();
    s.registration.active = first.asWorker();
    first.change("activated");
    s.container.claim(first);
    expect(s.callbacks.onOfflineReady).toHaveBeenCalledOnce();
    expect(s.callbacks.onNeedRefresh).not.toHaveBeenCalled();
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
  });
  it("observes new installing workers and handles first control after a known update", async () => {
    const s = setup(false),
      old = new Worker(),
      next = new Worker();
    s.registration.active = old.asWorker();
    old.state = "activated";
    const handle = s.start();
    await s.ready();
    s.registration.installing = next.asWorker();
    s.registration.dispatchEvent(new Event("updatefound"));
    next.change("installed");
    expect(s.callbacks.onNeedRefresh).toHaveBeenCalledOnce();
    s.registration.active = next.asWorker();
    s.container.claim(next);
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    await handle.update();
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
  });
  it("handles a controller switch before its event without sending duplicate reload requests", async () => {
    const s = setup(),
      next = new Worker();
    s.registration.waiting = next.asWorker();
    const handle = s.start();
    await s.ready();
    await handle.update();
    s.container.controller = next.asWorker();
    s.registration.waiting = null;
    await handle.update();
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
    s.container.dispatchEvent(new Event("controllerchange"));
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
  });
  it("keeps failed activation retryable and does not turn an external change into a stale auto-reload", async () => {
    const s = setup(),
      next = new Worker();
    s.registration.waiting = next.asWorker();
    next.postMessage.mockImplementationOnce(() => {
      throw Error("fictional activation failure");
    });
    const handle = s.start();
    await s.ready();
    await expect(handle.update()).rejects.toThrow(
      "fictional activation failure",
    );
    s.registration.waiting = null;
    s.container.claim(next);
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    await handle.update();
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
  });
  it("does not reuse an activation request when a different worker takes control", async () => {
    const s = setup(),
      requestedWorker = new Worker(),
      otherWorker = new Worker();
    s.registration.waiting = requestedWorker.asWorker();
    const handle = s.start();
    await s.ready();
    await handle.update();
    s.registration.waiting = null;
    s.container.claim(otherWorker);
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    await handle.update();
    expect(s.callbacks.onReloadReady).toHaveBeenCalledOnce();
  });
  it.each([false, true])(
    "contains registration failure (synchronous: %s)",
    async (synchronous) => {
      const s = setup();
      if (synchronous)
        s.container.register.mockImplementationOnce(() => {
          throw Error("fictional policy failure");
        });
      else
        s.container.register.mockRejectedValueOnce(
          Error("fictional offline failure"),
        );
      const handle = s.start();
      await vi.waitFor(() =>
        expect(s.callbacks.onRegisterError).toHaveBeenCalledOnce(),
      );
      await expect(handle.update()).rejects.toThrow("尚未就緒");
      expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
    },
  );
  it("ignores a late registration after disposal and removes established listeners", async () => {
    const s = setup(),
      worker = new Worker();
    let finish!: (value: ServiceWorkerRegistration) => void;
    s.container.register.mockReturnValueOnce(
      new Promise<ServiceWorkerRegistration>((resolve) => {
        finish = resolve;
      }),
    );
    const handle = s.start();
    await Promise.resolve();
    handle.dispose();
    s.registration.waiting = worker.asWorker();
    finish(s.registration.asRegistration());
    await handle.update();
    expect(s.callbacks.onRegisteredSW).not.toHaveBeenCalled();
    expect(s.callbacks.onNeedRefresh).not.toHaveBeenCalled();
    expect(worker.postMessage).not.toHaveBeenCalled();
    const live = s.start();
    await s.ready();
    vi.mocked(s.callbacks.onNeedRefresh).mockClear();
    live.dispose();
    s.container.claim(worker);
    worker.change("installed");
    s.registration.dispatchEvent(new Event("updatefound"));
    expect(s.callbacks.onNeedRefresh).not.toHaveBeenCalled();
    expect(s.callbacks.onReloadReady).not.toHaveBeenCalled();
  });
  it("supports browsers without ServiceWorker without registering anything", async () => {
    const s = setup();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
    const handle = s.start();
    await expect(handle.update()).rejects.toThrow("尚未就緒");
    expect(s.container.register).not.toHaveBeenCalled();
    expect(s.callbacks.onRegisterError).not.toHaveBeenCalled();
  });
});
