// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudPanel } from "./CloudPanel";
import { rememberSelection } from "./workspace";
const mock = vi.hoisted(() => ({
  login: vi.fn(),
  prepare: vi.fn(),
  choose: vi.fn(),
  inspect: vi.fn(),
  config: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("./google", () => ({
  login: mock.login,
  prepareGoogle: mock.prepare,
  chooseSpreadsheet: mock.choose,
  revoke: mock.revoke,
}));
vi.mock("./site-config", () => ({ loadSiteConfig: mock.config }));
vi.mock("./sheets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sheets")>()),
  inspectSpreadsheet: mock.inspect,
}));
const config = {
  clientId: "test.apps.googleusercontent.com",
  apiKey: "public-placeholder",
  projectNumber: "12345",
};
const session = (subject = "A") => ({
  accessToken: "memory-only",
  subject,
  email: `${subject.toLowerCase()}@example.com`,
  expiresAt: Date.now() + 3600000,
});
const inspection = () => ({
  id: "sheet-private-1",
  title: "私人表",
  timezone: "Asia/Taipei",
  checkedAt: new Date().toISOString(),
  report: {
    ok: true,
    errors: [],
    counts: {
      HealthMetrics: 0,
      DailySteps: 0,
      WorkoutLogs: 0,
      WorkoutPlans: 3,
      SyncLogs: 0,
    },
  },
  data: { version: 1, workouts: [], metrics: [] },
});
const props = () => ({
  visible: true,
  activeSpreadsheetId: null as string | null,
  onUseSnapshot: vi.fn(),
  onDisconnect: vi.fn(),
  onReadState: vi.fn(),
});
async function ready() {
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "使用 Google 登入",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
}
async function connect() {
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
  await screen.findByText("a@example.com");
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mock.config.mockResolvedValue(config);
  mock.prepare.mockResolvedValue(undefined);
  mock.login.mockResolvedValue(session());
  mock.choose.mockResolvedValue({ id: "sheet-private-1", title: "私人表" });
  mock.inspect.mockResolvedValue(inspection());
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("Google connection lifecycle", () => {
  it("asks for no API key inputs and leaves login unavailable if the site is not configured", async () => {
    mock.config.mockResolvedValue(null);
    render(<CloudPanel {...props()} />);
    await screen.findByText(/Google 連線準備中/);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      (
        screen.getByRole("button", {
          name: "使用 Google 登入",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mock.prepare).not.toHaveBeenCalled();
  });
  it("restores only the selected file belonging to the authenticated account", async () => {
    rememberSelection(localStorage, "A", {
      id: "sheet-private-1",
      title: "私人表",
    });
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledTimes(1));
    expect(mock.inspect.mock.calls[0][0]).toBe("sheet-private-1");
    expect(p.onUseSnapshot.mock.calls[0][0].subject).toBe("A");
    expect(mock.choose).not.toHaveBeenCalled();
    expect(
      [...Array(localStorage.length)]
        .map((_, i) => localStorage.getItem(localStorage.key(i)!))
        .join(""),
    ).not.toContain("memory-only");
  });
  it("does not apply an old account response after logout and another account login", async () => {
    rememberSelection(localStorage, "A", {
      id: "sheet-private-1",
      title: "私人表",
    });
    let finish!: (value: ReturnType<typeof inspection>) => void;
    mock.inspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mock.login
      .mockResolvedValueOnce(session("A"))
      .mockResolvedValueOnce(session("B"));
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    await waitFor(() => expect(mock.inspect).toHaveBeenCalledTimes(1));
    const signal = mock.inspect.mock.calls[0][2] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    expect(signal.aborted).toBe(true);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
    await screen.findByText("b@example.com");
    await act(async () => finish(inspection()));
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
    expect(mock.inspect).toHaveBeenCalledTimes(1);
  });
  it("ignores a completed login after the user cancels", async () => {
    let finish!: (value: ReturnType<typeof session>) => void;
    mock.login.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const p = props();
    render(<CloudPanel {...p} />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
    const signal = mock.login.mock.calls[0][1] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(signal.aborted).toBe(true);
    await act(async () => finish(session()));
    expect(screen.queryByText("a@example.com")).toBeNull();
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
  });
  it("does not switch back to cloud when a pending refresh completes after returning to local", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式檢查通過");
    fireEvent.click(
      screen.getByRole("button", { name: "在首頁查看這份雲端資料" }),
    );
    expect(p.onUseSnapshot).toHaveBeenCalledTimes(1);
    view.rerender(<CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />);
    let finish!: (value: ReturnType<typeof inspection>) => void;
    mock.inspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => window.dispatchEvent(new Event("daily-movement-refresh")));
    await waitFor(() => expect(mock.inspect).toHaveBeenCalledTimes(2));
    view.rerender(<CloudPanel {...p} activeSpreadsheetId={null} />);
    await act(async () => finish(inspection()));
    expect(p.onUseSnapshot).toHaveBeenCalledTimes(1);
  });
  it("keeps the last snapshot and reports a failed refresh outside the settings panel", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式檢查通過");
    fireEvent.click(
      screen.getByRole("button", { name: "在首頁查看這份雲端資料" }),
    );
    view.rerender(<CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />);
    mock.inspect.mockRejectedValueOnce(Error("offline"));
    act(() => window.dispatchEvent(new Event("daily-movement-refresh")));
    await waitFor(() =>
      expect(p.onReadState).toHaveBeenLastCalledWith({
        busy: false,
        error: expect.stringContaining("仍保留上次"),
      }),
    );
    expect(p.onUseSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText("格式檢查通過")).toBeTruthy();
  });
  it("hides the cloud connection and notifies the parent when access expires", async () => {
    vi.useFakeTimers();
    mock.login.mockResolvedValue({
      ...session(),
      expiresAt: Date.now() + 1000,
    });
    const p = props();
    render(<CloudPanel {...p} />);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
    });
    expect(screen.getByText("a@example.com")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    expect(screen.queryByText("a@example.com")).toBeNull();
    expect(p.onDisconnect).toHaveBeenCalledWith(
      expect.stringContaining("過期"),
    );
  });
});
