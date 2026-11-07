// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchPwaUpdates } from "./pwa-updates";

let cleanups: (() => void)[];
let now: number;
let visible: DocumentVisibilityState;
let online: boolean;
beforeEach(() => {
  now = 1_000_000;
  visible = "visible";
  online = true;
  cleanups = [];
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visible,
  );
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
});
afterEach(() => {
  cleanups.forEach((stop) => stop());
  vi.restoreAllMocks();
});
function setup() {
  const registration = {
    update: vi.fn().mockResolvedValue(undefined),
    installing: null as ServiceWorker | null,
    waiting: null as ServiceWorker | null,
  };
  const stop = watchPwaUpdates(registration);
  cleanups.push(stop);
  return { registration, stop };
}
const event = (type: "focus" | "online" | "visibilitychange") =>
  (type === "visibilitychange" ? document : window).dispatchEvent(
    new Event(type),
  );
const settle = async () => {
  await Promise.resolve();
};

describe("foreground PWA update checks", () => {
  it("coalesces foreground events with a one-minute cooldown and no automatic timer", async () => {
    const { registration } = setup();
    event("focus");
    expect(registration.update).not.toHaveBeenCalled();
    now += 60_000;
    event("focus");
    event("online");
    event("visibilitychange");
    expect(registration.update).toHaveBeenCalledOnce();
    await settle();
    now += 59_999;
    event("focus");
    expect(registration.update).toHaveBeenCalledOnce();
    now++;
    expect(registration.update).toHaveBeenCalledOnce();
    event("visibilitychange");
    expect(registration.update).toHaveBeenCalledTimes(2);
  });
  it("does not check hidden/offline pages or workers already installing or waiting", async () => {
    const { registration } = setup();
    now += 60_001;
    visible = "hidden";
    event("focus");
    event("visibilitychange");
    visible = "visible";
    online = false;
    event("online");
    online = true;
    registration.installing = {} as ServiceWorker;
    event("focus");
    registration.installing = null;
    registration.waiting = {} as ServiceWorker;
    event("focus");
    expect(registration.update).not.toHaveBeenCalled();
    registration.waiting = null;
    event("online");
    await settle();
    expect(registration.update).toHaveBeenCalledOnce();
  });
  it("keeps a slow check single-flight even after the cooldown and removes listeners on cleanup", async () => {
    const { registration, stop } = setup();
    let finish!: () => void;
    registration.update.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    now += 60_001;
    event("focus");
    now += 600_000;
    event("online");
    expect(registration.update).toHaveBeenCalledOnce();
    stop();
    finish();
    await settle();
    event("visibilitychange");
    event("online");
    event("focus");
    expect(registration.update).toHaveBeenCalledOnce();
  });
  it("contains rejected or synchronous failures and retries on a later foreground event", async () => {
    const { registration } = setup();
    registration.update.mockRejectedValueOnce(
      new Error("fictional offline failure"),
    );
    now += 60_001;
    event("focus");
    await settle();
    event("online");
    expect(registration.update).toHaveBeenCalledOnce();
    registration.update.mockImplementationOnce(() => {
      throw Error("fictional sync failure");
    });
    now += 60_001;
    event("online");
    await settle();
    now += 60_001;
    event("visibilitychange");
    await settle();
    expect(registration.update).toHaveBeenCalledTimes(3);
  });
  it("does not get stuck when the device clock moves backward", async () => {
    const { registration } = setup();
    now -= 3_600_000;
    event("focus");
    await settle();
    expect(registration.update).toHaveBeenCalledOnce();
    event("focus");
    expect(registration.update).toHaveBeenCalledOnce();
  });
});
