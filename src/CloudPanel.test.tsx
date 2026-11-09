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
import { readSelection, rememberSelection, selectionKey } from "./workspace";
import { testSource } from "./test-fixtures";
import type { SheetInspection } from "./sheets";
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
const inspection = (): SheetInspection => ({
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
async function connect(automatic = false) {
  await ready();
  const first = !readSelection(localStorage, "A");
  // Cancel the automatic first-login picker; individual tests exercise explicit selection separately.
  if (first && !automatic) mock.choose.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
  await screen.findByText("a@example.com");
  if (first && !automatic) {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
      ).toHaveProperty("disabled", false),
    );
    mock.choose.mockClear();
  }
}
beforeEach(() => {
  vi.resetAllMocks();
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
    await screen.findByText(/Google 連線暫時無法使用/);
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
  it("immediately applies and remembers a first valid pick, restoring it on the next login", async () => {
    const result = { ...inspection(), source: testSource() };
    mock.inspect.mockResolvedValue(result);
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式檢查通過");
    expect(p.onUseSnapshot).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ subject: "A", spreadsheetId: result.id }),
      result.data,
      result.source,
    );
    expect(readSelection(localStorage, "A")).toEqual({
      id: result.id,
      title: result.title,
    });
    expect(
      screen.queryByRole("button", { name: "在首頁查看這份雲端資料" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    await connect();
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledTimes(2));
    expect(mock.choose).toHaveBeenCalledTimes(1);
    expect(mock.inspect).toHaveBeenNthCalledWith(
      2,
      result.id,
      expect.objectContaining({ subject: "A" }),
      expect.any(AbortSignal),
    );
    expect(
      [...Array(localStorage.length)]
        .map((_, i) => localStorage.getItem(localStorage.key(i)!))
        .join(""),
    ).not.toContain("memory-only");
  });
  it.each(["invalid", "missing-data"])(
    "does not activate or remember a picked result that is %s",
    async (kind) => {
      const result = inspection();
      if (kind === "invalid")
        result.report = {
          ...result.report,
          ok: false,
          errors: ["虛構格式錯誤"],
        };
      else delete (result as Partial<ReturnType<typeof inspection>>).data;
      mock.inspect.mockResolvedValue(result);
      const p = props();
      render(<CloudPanel {...p} />);
      await connect();
      fireEvent.click(
        screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
      );
      await screen.findByText(
        kind === "invalid" ? "格式尚未符合需求" : "格式檢查通過",
      );
      expect(p.onUseSnapshot).not.toHaveBeenCalled();
      expect(readSelection(localStorage, "A")).toBeNull();
    },
  );
  it("does not inspect or change the selection when the picker is cancelled", async () => {
    mock.choose.mockResolvedValue(null);
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(mock.choose).toHaveBeenCalledOnce());
    expect(mock.inspect).not.toHaveBeenCalled();
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
    expect(readSelection(localStorage, "A")).toBeNull();
  });
  it("does not apply or remember a picker response after logout and another account login", async () => {
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
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(mock.inspect).toHaveBeenCalledOnce());
    const signal = mock.inspect.mock.calls[0][2] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    expect(signal.aborted).toBe(true);
    await ready();
    mock.choose.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
    await screen.findByText("b@example.com");
    await act(async () => finish(inspection()));
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
    expect(readSelection(localStorage, "A")).toBeNull();
    expect(readSelection(localStorage, "B")).toBeNull();
  });
  it("rejects an otherwise valid picked result if the session has expired", async () => {
    const current = session();
    mock.login.mockResolvedValue(current);
    let finish!: (value: ReturnType<typeof inspection>) => void;
    mock.inspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(mock.inspect).toHaveBeenCalledOnce());
    const now = vi.spyOn(Date, "now").mockReturnValue(current.expiresAt + 1);
    try {
      await act(async () => finish(inspection()));
      expect(p.onUseSnapshot).not.toHaveBeenCalled();
      expect(readSelection(localStorage, "A")).toBeNull();
    } finally {
      now.mockRestore();
    }
  });
  it("keeps a valid selection usable and explains when remembering is denied", async () => {
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw Error("denied");
      });
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
      );
      await screen.findByText(
        "已讀取資料，但無法記住這份檔案，下次登入需重新選擇。",
      );
      expect(p.onUseSnapshot).toHaveBeenCalledOnce();
    } finally {
      write.mockRestore();
    }
  });
  it("does not remember a new file when activation itself fails", async () => {
    const p = props();
    p.onUseSnapshot.mockImplementation(() => {
      throw Error("虛構套用失敗");
    });
    render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("虛構套用失敗");
    expect(readSelection(localStorage, "A")).toBeNull();
  });
  it("applies and remembers a repaired first selection after explicit reinspection", async () => {
    const good = { ...inspection(), source: testSource() };
    mock.inspect
      .mockResolvedValueOnce({
        ...good,
        report: { ...good.report, ok: false, errors: ["虛構待修正欄位"] },
      })
      .mockResolvedValueOnce(good);
    const p = props();
    render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式尚未符合需求");
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
    expect(readSelection(localStorage, "A")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取這份試算表" }));
    await screen.findByText("格式檢查通過");
    expect(p.onUseSnapshot).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ spreadsheetId: good.id }),
      good.data,
      good.source,
    );
    expect(readSelection(localStorage, "A")).toEqual({
      id: good.id,
      title: good.title,
    });
    expect(mock.choose).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "在首頁查看這份雲端資料" }),
    ).toBeNull();
  });
  it("switches from the active file to a repaired selected file only on explicit reinspection", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
    view.rerender(<CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />);
    const second = {
      ...inspection(),
      id: "sheet-private-2",
      title: "修好的第二份表",
    };
    mock.choose.mockResolvedValueOnce({ id: second.id, title: second.title });
    mock.inspect
      .mockResolvedValueOnce({
        ...second,
        report: { ...second.report, ok: false, errors: ["虛構格式問題"] },
      })
      .mockResolvedValueOnce(second);
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式尚未符合需求");
    expect(readSelection(localStorage, "A")?.id).toBe("sheet-private-1");
    fireEvent.click(screen.getByRole("button", { name: "重新讀取這份試算表" }));
    await screen.findByText("格式檢查通過");
    expect(p.onUseSnapshot).toHaveBeenCalledTimes(2);
    expect(p.onUseSnapshot.mock.calls[1][0].spreadsheetId).toBe(second.id);
    expect(readSelection(localStorage, "A")?.id).toBe(second.id);
  });
  it("keeps local mode and the remembered file if a pending selected-file reinspection finishes later", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
    view.rerender(<CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />);
    const second = {
      ...inspection(),
      id: "sheet-private-2",
      title: "另一份表",
    };
    mock.choose.mockResolvedValueOnce({ id: second.id, title: second.title });
    mock.inspect.mockResolvedValueOnce({
      ...second,
      report: { ...second.report, ok: false, errors: ["虛構格式問題"] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式尚未符合需求");
    let finish!: (value: SheetInspection) => void;
    mock.inspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "重新讀取這份試算表" }));
    await waitFor(() => expect(mock.inspect).toHaveBeenCalledTimes(3));
    view.rerender(<CloudPanel {...p} activeSpreadsheetId={null} />);
    await act(async () => finish(second));
    expect(p.onUseSnapshot).toHaveBeenCalledTimes(1);
    expect(readSelection(localStorage, "A")?.id).toBe("sheet-private-1");
    expect(
      screen.getByText("資料來源已切換，這次讀取未套用；需要時請重新選擇。"),
    ).toBeTruthy();
  });
  it.each(["format", "network"])(
    "keeps the current file when a selected-file reinspection fails with %s",
    async (reason) => {
      const p = props();
      const view = render(<CloudPanel {...p} />);
      await connect();
      fireEvent.click(
        screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
      );
      await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
      view.rerender(
        <CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />,
      );
      const bad = {
        ...inspection(),
        id: "sheet-private-2",
        report: { ...inspection().report, ok: false, errors: ["虛構格式問題"] },
      };
      mock.choose.mockResolvedValueOnce({ id: bad.id, title: bad.title });
      mock.inspect.mockResolvedValueOnce(bad);
      fireEvent.click(
        screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
      );
      await screen.findByText("格式尚未符合需求");
      if (reason === "network")
        mock.inspect.mockRejectedValueOnce(Error("offline"));
      else mock.inspect.mockResolvedValueOnce(bad);
      const retry = screen.getByRole("button", {
        name: "重新讀取這份試算表",
      }) as HTMLButtonElement;
      fireEvent.click(retry);
      await waitFor(() => expect(mock.inspect).toHaveBeenCalledTimes(3));
      await waitFor(() => expect(retry.disabled).toBe(false));
      expect(p.onUseSnapshot).toHaveBeenCalledTimes(1);
      expect(readSelection(localStorage, "A")?.id).toBe("sheet-private-1");
    },
  );
  it("keeps automatic and toolbar refresh limited to the active file after another selection fails", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
    view.rerender(<CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />);
    const bad = {
      ...inspection(),
      id: "sheet-private-2",
      report: { ...inspection().report, ok: false, errors: ["虛構格式問題"] },
    };
    mock.choose.mockResolvedValueOnce({ id: bad.id, title: bad.title });
    mock.inspect.mockResolvedValueOnce(bad);
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await screen.findByText("格式尚未符合需求");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
      ).toHaveProperty("disabled", false),
    );
    act(() => window.dispatchEvent(new Event("daily-movement-refresh")));
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledTimes(2));
    expect(mock.inspect.mock.calls[2][0]).toBe("sheet-private-1");
    expect(readSelection(localStorage, "A")?.id).toBe("sheet-private-1");
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
    // Account B has no remembered file, so sign-in opens the picker; the user cancels it.
    mock.choose.mockResolvedValueOnce(null);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
    await screen.findByText("b@example.com");
    await waitFor(() => expect(mock.choose).toHaveBeenCalledTimes(1));
    await act(async () => finish(inspection()));
    expect(p.onUseSnapshot).not.toHaveBeenCalled();
    expect(mock.inspect).toHaveBeenCalledTimes(1);
  });
  it("opens the picker on first sign-in and applies and remembers a compatible pick at once", async () => {
    const p = props();
    render(<CloudPanel {...p} />);
    await connect(true);
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledTimes(1));
    expect(mock.choose).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "在首頁查看這份雲端資料" }),
    ).toBeNull();
    expect(JSON.parse(localStorage.getItem(selectionKey("A"))!).id).toBe(
      "sheet-private-1",
    );
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
    await connect(true);
    await screen.findByText("格式檢查通過");
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledTimes(1));
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
  it("does not apply or remember a pending new pick after returning to local", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect();
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
    view.rerender(<CloudPanel {...p} activeSpreadsheetId="sheet-private-1" />);
    const second = {
      ...inspection(),
      id: "sheet-private-2",
      title: "另一份私人表",
    };
    mock.choose.mockResolvedValueOnce({ id: second.id, title: second.title });
    let finish!: (value: SheetInspection) => void;
    mock.inspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "選擇自己的副本並驗收" }),
    );
    await waitFor(() => expect(mock.inspect).toHaveBeenCalledTimes(2));
    view.rerender(<CloudPanel {...p} activeSpreadsheetId={null} />);
    await act(async () => finish(second));
    expect(p.onUseSnapshot).toHaveBeenCalledTimes(1);
    expect(readSelection(localStorage, "A")?.id).toBe("sheet-private-1");
    expect(
      screen.getByText("資料來源已切換，這次選表未套用；需要時請重新選擇。"),
    ).toBeTruthy();
  });
  it("keeps the last snapshot and reports a failed refresh outside the settings panel", async () => {
    const p = props();
    const view = render(<CloudPanel {...p} />);
    await connect(true);
    await screen.findByText("格式檢查通過");
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

it("lets the welcome page retry SDK preparation without opening OAuth outside a user click", async () => {
  const p = { ...props(), eager: true };
  const readyAction = vi.fn();
  mock.prepare.mockRejectedValueOnce(Error("虛構 SDK 載入失敗"));
  render(<CloudPanel {...p} onLoginReady={readyAction} />);
  await waitFor(() =>
    expect(p.onReadState).toHaveBeenLastCalledWith({
      busy: false,
      error: expect.stringContaining("Google 登入暫時無法使用"),
    }),
  );
  expect(readyAction.mock.calls.at(-1)![0]).toBeTypeOf("function");
  await act(async () => readyAction.mock.calls.at(-1)![0]());
  await ready();
  expect(mock.prepare).toHaveBeenCalledTimes(2);
  expect(mock.login).not.toHaveBeenCalled();
  expect(p.onReadState).toHaveBeenLastCalledWith({ busy: false, error: "" });
  await act(async () => readyAction.mock.calls.at(-1)![0]());
  await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
  expect(mock.login).toHaveBeenCalledOnce();
});

it("reports welcome login and picker cancellation errors and retries the picker without logging in again", async () => {
  const p = { ...props(), eager: true };
  const readyAction = vi.fn();
  render(<CloudPanel {...p} onLoginReady={readyAction} />);
  await ready();
  mock.login.mockRejectedValueOnce(Error("虛構登入取消"));
  fireEvent.click(screen.getByRole("button", { name: "使用 Google 登入" }));
  await waitFor(() =>
    expect(p.onReadState).toHaveBeenLastCalledWith({
      busy: false,
      error: "虛構登入取消",
    }),
  );
  mock.choose.mockResolvedValueOnce(null);
  await act(async () => readyAction.mock.calls.at(-1)![0]());
  await waitFor(() =>
    expect(p.onReadState).toHaveBeenLastCalledWith({
      busy: false,
      error: expect.stringContaining("已取消選擇試算表"),
    }),
  );
  expect(readyAction.mock.calls.at(-1)![0]).toBeTypeOf("function");
  await act(async () => readyAction.mock.calls.at(-1)![0]());
  await waitFor(() => expect(p.onUseSnapshot).toHaveBeenCalledOnce());
  expect(mock.login).toHaveBeenCalledTimes(2);
  expect(mock.choose).toHaveBeenCalledTimes(2);
  expect(p.onReadState).toHaveBeenLastCalledWith({ busy: false, error: "" });
});
