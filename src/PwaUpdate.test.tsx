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
const mock = vi.hoisted(() => ({ register: vi.fn(), apply: vi.fn() }));
vi.mock("virtual:pwa-register", () => ({ registerSW: mock.register }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
  mock.apply.mockResolvedValue(undefined);
  mock.register.mockReturnValue(mock.apply);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
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
  expect(mock.apply).toHaveBeenCalledWith(true);
});
it("reports offline interface readiness without promising health data synchronization", () => {
  render(<PwaUpdate blocked={false} />);
  act(() => mock.register.mock.calls[0][0].onOfflineReady());
  expect(screen.getByText("離線介面已準備好。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "關閉離線通知" }));
  expect(screen.queryByRole("status")).toBeNull();
});
