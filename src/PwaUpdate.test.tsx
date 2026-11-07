// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PwaUpdate } from "./PwaUpdate";
const mock = vi.hoisted(() => ({
  register: vi.fn(),
  apply: vi.fn(),
  dispose: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("./pwa-registration", () => ({
  registerPwa: mock.register,
  reloadPwaPage: mock.reload,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
  mock.apply.mockResolvedValue(undefined);
  mock.register.mockReturnValue({ update: mock.apply, dispose: mock.dispose });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("watches the registered worker without activating it and ignores late registrations after unmount", async () => {
  let now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const registration = {
    update: vi.fn().mockResolvedValue(undefined),
    installing: null,
    waiting: null,
  };
  const late = {
    ...registration,
    update: vi.fn().mockResolvedValue(undefined),
  };
  const view = render(<PwaUpdate blocked />);
  const options = mock.register.mock.calls[0][0];
  act(() => options.onRegisteredSW("/fictional/sw.js", registration));
  now += 60_001;
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(registration.update).toHaveBeenCalledOnce();
  expect(mock.apply).not.toHaveBeenCalled();
  act(() => options.onNeedRefresh());
  expect(
    (screen.getByRole("button", { name: "更新版本" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.unmount();
  act(() => options.onRegisteredSW("/fictional/sw.js", late));
  now += 60_001;
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(registration.update).toHaveBeenCalledOnce();
  expect(late.update).not.toHaveBeenCalled();
});
it("keeps an unsuccessful explicit update retryable", async () => {
  mock.apply.mockRejectedValueOnce(new Error("fictional update failure"));
  render(<PwaUpdate blocked={false} />);
  act(() => mock.register.mock.calls[0][0].onNeedRefresh());
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "更新版本" })),
  );
  expect(screen.getByText("更新未完成，請確認網路後重試。")).toBeTruthy();
  const button = screen.getByRole("button", {
    name: "更新版本",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  await act(async () => fireEvent.click(button));
  expect(mock.apply).toHaveBeenCalledTimes(2);
});
it("protects an open form from reload and updates only after an explicit click", async () => {
  const view = render(<PwaUpdate blocked={true} />);
  act(() => mock.register.mock.calls[0][0].onNeedRefresh());
  const button = screen.getByRole("button", {
    name: "更新版本",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(mock.apply).not.toHaveBeenCalled();
  view.rerender(<PwaUpdate blocked={false} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "更新版本" })),
  );
  expect(mock.apply).toHaveBeenCalledOnce();
});
it("rechecks the current form lock when activation finishes and reloads only after a safe explicit retry", () => {
  const view = render(<PwaUpdate blocked={false} />);
  const options = mock.register.mock.calls[0][0];
  view.rerender(<PwaUpdate blocked />);
  act(() => options.onReloadReady());
  expect(mock.reload).not.toHaveBeenCalled();
  expect(
    (screen.getByRole("button", { name: "更新版本" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.rerender(<PwaUpdate blocked={false} />);
  act(() => options.onReloadReady());
  expect(mock.reload).toHaveBeenCalledOnce();
  view.unmount();
  expect(mock.dispose).toHaveBeenCalledOnce();
  act(() => options.onReloadReady());
  expect(mock.reload).toHaveBeenCalledOnce();
});
it("reports offline interface readiness without promising health data synchronization", () => {
  render(<PwaUpdate blocked={false} />);
  act(() => mock.register.mock.calls[0][0].onOfflineReady());
  expect(screen.getByText("離線介面已準備好。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "關閉離線通知" }));
  expect(screen.queryByRole("status")).toBeNull();
});
