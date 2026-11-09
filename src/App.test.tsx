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
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { today, type Workout } from "./model";
import { testInspection } from "./test-fixtures";
import { readOutbox } from "./outbox";
import { LOCAL_KEY } from "./workspace";
import { preferenceKey } from "./preferences";
const lifecycle = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  snapshot: null as ReturnType<typeof testInspection> | null,
}));
vi.mock("./pages/HealthChart", () => ({
  HealthChart: () => <div>健康圖表</div>,
}));
vi.mock("./PwaUpdate", () => ({
  PwaUpdate: ({ blocked }: { blocked: boolean }) => (
    <button disabled={blocked}>測試更新版本</button>
  ),
}));
vi.mock("./WeeklyActivity", async (original) => ({
  ...(await original<typeof import("./WeeklyActivity")>()),
  WeeklyActivity: () => null,
}));
vi.mock("./CloudPanel", async () => {
  const { testInspection, TEST_TIME } = await import("./test-fixtures");
  return {
    CloudPanel: ({ onSessionChange, onUseSnapshot }: any) => {
      React.useEffect(() => {
        lifecycle.mounts++;
        return () => {
          lifecycle.unmounts++;
        };
      }, []);
      return (
        <div>
          {["A", "B"].map((subject) => (
            <button
              key={subject}
              onClick={() => {
                const inspection = lifecycle.snapshot ?? testInspection();
                inspection.data!.plans![0].title = `帳號${subject}課表`;
                inspection.source!.grids.WorkoutPlans[1][3] = `帳號${subject}課表`;
                onSessionChange({
                  subject,
                  email: "test@example.com",
                  expiresAt: Date.now() + 3600000,
                  accessToken: "must-never-persist",
                });
                onUseSnapshot(
                  {
                    subject,
                    spreadsheetId: "sheet-private-1",
                    title: `虛構表${subject}`,
                    timezone: "Asia/Taipei",
                    checkedAt: TEST_TIME,
                  },
                  inspection.data,
                  inspection.source,
                );
              }}
            >
              連線測試帳號{subject}
            </button>
          ))}
        </div>
      );
    },
  };
});
/** Settings now live in the avatar menu instead of the bottom dock. */
function openSettings() {
  fireEvent.click(screen.getByRole("button", { name: "帳號與同步設定" }));
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
}
beforeEach(() => {
  lifecycle.snapshot = null;
  lifecycle.mounts = 0;
  lifecycle.unmounts = 0;
  localStorage.clear();
  // Skip the welcome screen; these tests exercise the signed-out local workspace.
  localStorage.setItem("daily-movement-entry-v1", "local");
  localStorage.setItem(
    "daily-movement-profile-v1",
    JSON.stringify({ onboarded: true, nickname: "" }),
  );
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn((_key, _options, callback) =>
        Promise.resolve(callback({ name: "editor" })),
      ),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("blocks interface updates while a weekly-goal draft is open and releases after save or navigation", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
    { target: { value: "180" } },
  );
  expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
    "disabled",
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "記錄運動" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉" }));
  expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
  ).toHaveProperty("value", "180");
  fireEvent.click(screen.getByRole("button", { name: "儲存目標" }));
  expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
    "disabled",
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  fireEvent.click(screen.getByRole("button", { name: "影片" }));
  expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
    "disabled",
    false,
  );
});
it("clears the goal draft and its update lock when the existing workspace key changes", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
    { target: { value: "180" } },
  );
  await act(async () => {
    fireEvent.click(screen.getByText("連線測試帳號A"));
  });
  expect(
    screen.queryByRole("spinbutton", { name: "每週目標（分鐘）" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
    "disabled",
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  expect(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
  ).toHaveProperty("value", "150");
  expect(localStorage.getItem(preferenceKey())).toBeNull();
});
it("protects a video draft from interface updates while searching and releases the lock on close or navigation", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "影片" }));
  fireEvent.click(screen.getByRole("button", { name: "新增影片" }));
  fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
    target: { value: "虛構未儲存影片" },
  });
  expect(
    (screen.getByRole("button", { name: "測試更新版本" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByRole("searchbox", { name: "搜尋運動影片" }), {
    target: { value: "瑜伽" },
  });
  expect(
    (screen.getByRole("textbox", { name: "名稱" }) as HTMLInputElement).value,
  ).toBe("虛構未儲存影片");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(
    (screen.getByRole("button", { name: "測試更新版本" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "新增影片" }));
  fireEvent.click(screen.getByRole("button", { name: "首頁" }));
  expect(
    (screen.getByRole("button", { name: "測試更新版本" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("advances the displayed day, steps and training week when returning to the foreground", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  const data = {
    version: 1,
    metrics: [{ id: "fictional-sunday", date: "2026-11-08", steps: 1234 }],
    workouts: [
      {
        id: "fictional-sunday-workout",
        date: "2026-11-08",
        type: "home",
        minutes: 20,
        calories: 0,
        note: "虛構週日運動",
      },
    ],
  };
  const raw = JSON.stringify(data);
  localStorage.setItem(LOCAL_KEY, raw);
  const { container } = render(<App />);
  const heading = container.querySelector(".title-row .eyebrow")!;
  const steps = screen.getByText("今日步數").closest("article")!;
  const week = screen
    .getByText("本週運動", { exact: true })
    .closest("article")!;
  expect(heading.textContent).toContain("11月8日");
  expect(steps.textContent).toContain("1,234");
  expect(week.querySelector(".stat-value")!.textContent).toContain("20");
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(heading.textContent).toContain("11月9日");
  expect(steps.textContent).not.toContain("1,234");
  expect(week.querySelector(".stat-value")!.textContent).toContain("0");
  expect(localStorage.getItem(LOCAL_KEY)).toBe(raw);
  expect(lifecycle.mounts).toBe(1);
  expect(lifecycle.unmounts).toBe(0);
});
it("preserves an open health form's date and values while crossing into a new day", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "記錄健康數據" }));
  const date = screen.getByLabelText("日期") as HTMLInputElement;
  const weight = screen.getByLabelText("體重（kg）") as HTMLInputElement;
  fireEvent.change(weight, { target: { value: "60.5" } });
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(document.querySelector(".title-row .eyebrow")!.textContent).toContain(
    "11月9日",
  );
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  act(() => window.dispatchEvent(new Event("online")));
  expect(date.value).toBe("2026-11-08");
  expect(weight.value).toBe("60.5");
});
it("exports the exact unreadable original and restores a valid backup through the explicit repair flow", async () => {
  const raw = "{fictional-unreadable \ud800";
  localStorage.setItem(LOCAL_KEY, raw);
  const create = vi.fn(
    (_blob: Blob | MediaSource) => "blob:fictional-original",
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<App />);
  openSettings();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "下載待修復原始檔案" }));
  vi.advanceTimersByTime(1000);
  vi.useRealTimers();
  const original = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(create.mock.calls[0][0] as Blob);
  });
  expect(JSON.parse(original)).toEqual({
    format: "daily-movement-unreadable-local-v1",
    raw,
  });
  expect(localStorage.getItem(LOCAL_KEY)).toBe(raw);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "我已確認原始檔案保存在自己的裝置" }),
  );
  const next = {
    version: 1,
    metrics: [],
    workouts: [
      {
        id: "fictional-restored",
        date: today(),
        type: "home",
        minutes: 20,
        calories: 0,
        note: "虛構修復後紀錄",
      },
    ],
  };
  const file = new File([JSON.stringify(next)], "fictional-backup.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: async () => JSON.stringify(next),
  });
  fireEvent.change(screen.getByLabelText("選擇有效備份來修復"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.queryByText("以備份修復本機資料")).toBeNull(),
  );
  expect(confirm).toHaveBeenCalledOnce();
  expect(confirm).toHaveBeenCalledWith(
    expect.stringContaining("無法解讀的本機原始內容"),
  );
  expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!)).toEqual(next);
  expect(
    (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.getByText("已成功還原資料")).toBeTruthy();
});
it("offers a retry on an initially unreadable store without replacing its contents", () => {
  localStorage.setItem(LOCAL_KEY, "{fictional-invalid");
  render(<App />);
  const refresh = screen.getByRole("button", { name: "重新讀取本機資料" });
  expect(screen.getByText("本機資料需要重新讀取")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(refresh);
  expect(localStorage.getItem(LOCAL_KEY)).toBe("{fictional-invalid");
  localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify({ version: 1, workouts: [], metrics: [] }),
  );
  fireEvent.click(refresh);
  expect(screen.queryByText("本機資料需要重新讀取")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("retains a local draft, blocks stale writes and explicitly refreshes another page's records before continuing", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "記錄運動" }));
  const note = screen.getByRole("textbox", {
    name: "備註",
  }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "虛構未儲存草稿" } });
  const latest = {
    version: 1,
    metrics: [],
    workouts: [
      {
        id: "fictional-other-tab",
        date: today(),
        type: "home",
        minutes: 20,
        calories: 0,
        note: "虛構其他分頁最新紀錄",
      },
    ],
  };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(latest));
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: LOCAL_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  expect(note.value).toBe("虛構未儲存草稿");
  expect(
    (screen.getByRole("button", { name: /儲存紀錄/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  const refresh = screen.getByRole("button", {
    name: "重新讀取本機資料",
  }) as HTMLButtonElement;
  expect(refresh.disabled).toBe(true);
  expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!)).toEqual(latest);
  fireEvent.click(screen.getByRole("button", { name: "關閉" }));
  expect(refresh.disabled).toBe(false);
  fireEvent.click(refresh);
  expect(screen.queryByText("本機資料已變更")).toBeNull();
  // The home page no longer lists records; the refreshed record shows on the log page.
  fireEvent.click(screen.getByRole("button", { name: "紀錄" }));
  expect(screen.getByText("虛構其他分頁最新紀錄")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("does not refresh local data while a backup is being read and preserves the newer storage", async () => {
  render(<App />);
  openSettings();
  let finish!: (text: string) => void;
  const file = new File(["fictional"], "fictional.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.change(screen.getByLabelText("還原 JSON 備份"), {
    target: { files: [file] },
  });
  const latest = {
    version: 1,
    workouts: [],
    metrics: [{ id: "fictional-latest", date: today(), weight: 60 }],
  };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(latest));
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: LOCAL_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  const refresh = screen.getByRole("button", {
    name: "重新讀取本機資料",
  }) as HTMLButtonElement;
  expect(refresh.disabled).toBe(true);
  await act(async () =>
    finish(JSON.stringify({ version: 1, workouts: [], metrics: [] })),
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(refresh.disabled).toBe(false);
  expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!)).toEqual(latest);
  expect(
    (screen.getByLabelText("還原 JSON 備份") as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.click(refresh);
  expect(
    (screen.getByLabelText("還原 JSON 備份") as HTMLInputElement).disabled,
  ).toBe(false);
});
it("resets workout filters across cloud accounts without resetting the Google panel", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "紀錄" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "搜尋運動紀錄" }), {
    target: { value: "虛構本機篩選" },
  });
  fireEvent.click(screen.getByText("連線測試帳號A"));
  await waitFor(() =>
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(""),
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "虛構帳號A篩選" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "運動種類" }), {
    target: { value: "yoga" },
  });
  fireEvent.click(screen.getByText("連線測試帳號B"));
  await waitFor(() =>
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(""),
  );
  expect(
    (screen.getByRole("combobox", { name: "運動種類" }) as HTMLSelectElement)
      .value,
  ).toBe("all");
  expect(lifecycle.mounts).toBe(1);
  expect(lifecycle.unmounts).toBe(0);
});
it("does not apply a local backup after switching to a cloud account while its file is loading", async () => {
  const backup = testInspection().data!;
  backup.plans![0].title = "帳號A課表";
  backup.workouts = [
    {
      id: "fictional-restore",
      date: "2026-01-01",
      type: "home",
      minutes: 20,
      calories: 0,
      note: "虛構待還原資料",
    },
  ];
  let finishRead!: (text: string) => void;
  const file = new File(["fictional"], "fictional-backup.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<App />);
  openSettings();
  fireEvent.change(screen.getByLabelText("還原 JSON 備份"), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByText("連線測試帳號A"));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  await act(async () => {
    finishRead(JSON.stringify(backup));
  });
  expect(
    readOutbox(localStorage, {
      subject: "A",
      spreadsheetId: "sheet-private-1",
    }),
  ).toEqual([]);
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.queryByText("已成功還原資料")).toBeNull();
});
it("blocks version updates during a backup read and lets the user cancel it", async () => {
  let finishRead!: (text: string) => void;
  const file = new File(["fictional"], "fictional-backup.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<App />);
  openSettings();
  const input = screen.getByLabelText("還原 JSON 備份") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  expect(input.disabled).toBe(true);
  expect((screen.getByText("測試更新版本") as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(screen.getByText("正在讀取並檢查備份…")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消讀取" }));
  expect(input.disabled).toBe(false);
  expect((screen.getByText("測試更新版本") as HTMLButtonElement).disabled).toBe(
    false,
  );
  await act(async () => {
    finishRead(JSON.stringify({ version: 1, workouts: [], metrics: [] }));
  });
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByText("已取消讀取備份，現有資料未變更。")).toBeTruthy();
});
it("repeats a workout only after save, preserving the source and cancelling without writes", () => {
  const original: Workout = {
    id: "source",
    date: "2026-01-01",
    type: "walk",
    minutes: 30,
    calories: 222,
    note: "虛構原始紀錄",
    segments: [
      { minutes: 10, speed: 4, incline: 0 },
      { minutes: 20, speed: 5, incline: 3 },
    ],
  };
  localStorage.setItem(
    "daily-movement-v1",
    JSON.stringify({ version: 1, metrics: [], workouts: [original] }),
  );
  const read = () =>
    JSON.parse(localStorage.getItem("daily-movement-v1")!)
      .workouts as Workout[];
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "紀錄" }));
  fireEvent.click(
    screen.getByRole("button", { name: /以 2026-01-01 .*再記一次/ }),
  );
  expect(read()).toEqual([original]);
  expect((screen.getByLabelText("日期") as HTMLInputElement).value).toBe(
    today(),
  );
  fireEvent.change(screen.getByLabelText("第 1 段速度"), {
    target: { value: "4.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "關閉" }));
  expect(read()).toEqual([original]);
  fireEvent.click(screen.getByRole("button", { name: /再記一次/ }));
  expect((screen.getByLabelText("第 1 段速度") as HTMLInputElement).value).toBe(
    "4",
  );
  fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
  const saved = read();
  expect(saved).toHaveLength(2);
  expect(saved.find((workout) => workout.id === original.id)).toEqual(original);
  expect(saved.find((workout) => workout.id !== original.id)).toMatchObject({
    date: today(),
    type: "walk",
    calories: 0,
    segments: original.segments,
  });
});
it("keeps Google mounted across pages, preserves a navigation draft, and clears it across accounts", async () => {
  render(<App />);
  expect(lifecycle.mounts).toBe(1);
  openSettings();
  fireEvent.click(screen.getByText("連線測試帳號A"));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "首頁" }));
  expect(screen.queryByText(/私人雲端：/)).toBeNull();
  expect(screen.queryByText("虛構表A")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "帳號與同步設定" }));
  expect(screen.getByText("虛構表A")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
  expect(screen.getByRole("heading", { name: "設定與備份" })).toBeTruthy();
  expect(lifecycle.mounts).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "記錄運動" }));
  fireEvent.click(screen.getByRole("button", { name: "儲存紀錄" }));
  expect(screen.getByText("1 筆修改保留在此裝置")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "帳號與同步" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "課表" }));
  fireEvent.click(screen.getByLabelText("編輯帳號A課表"));
  fireEvent.change(screen.getByLabelText("課表名稱"), {
    target: { value: "帳號A的未儲存草稿" },
  });
  await waitFor(() =>
    expect(
      (screen.getByText("測試更新版本") as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole("button", { name: "首頁" }));
  fireEvent.click(screen.getByRole("button", { name: "課表" }));
  expect((screen.getByLabelText("課表名稱") as HTMLInputElement).value).toBe(
    "帳號A的未儲存草稿",
  );
  openSettings();
  await act(async () => {
    fireEvent.click(screen.getByText("連線測試帳號B"));
  });
  fireEvent.click(screen.getByRole("button", { name: "課表" }));
  expect(screen.queryByLabelText("課表名稱")).toBeNull();
  expect(screen.getByLabelText("編輯帳號B課表")).toBeTruthy();
  expect((screen.getByText("測試更新版本") as HTMLButtonElement).disabled).toBe(
    false,
  );
  expect(lifecycle.mounts).toBe(1);
  expect(lifecycle.unmounts).toBe(0);
  expect(JSON.stringify(localStorage)).not.toContain("must-never-persist");
});
it("starts with a welcome screen and remembers browsing without signing in", () => {
  localStorage.removeItem("daily-movement-entry-v1");
  const view = render(<App />);
  expect(screen.getByRole("dialog", { name: "日常動作" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "先逛逛" }));
  expect(screen.queryByRole("dialog", { name: "日常動作" })).toBeNull();
  expect(localStorage.getItem("daily-movement-entry-v1")).toBe("local");
  view.unmount();
  render(<App />);
  expect(screen.queryByRole("dialog", { name: "日常動作" })).toBeNull();
});
it("checks off today's plan through a prefilled form and confirms before removing it", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const saved = () =>
    JSON.parse(localStorage.getItem(LOCAL_KEY) || '{"workouts":[]}')
      .workouts as Workout[];
  render(<App />);
  fireEvent.click(screen.getByRole("checkbox", { name: "健身房上坡快走" }));
  expect(
    screen.getAllByRole("spinbutton", { name: /第 .* 段分鐘/ }),
  ).toHaveLength(3);
  expect((screen.getByLabelText("分鐘數") as HTMLInputElement).value).toBe(
    "55",
  );
  expect(saved()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
  expect(saved()).toMatchObject([
    { date: "2026-11-04", type: "walk", minutes: 55 },
  ]);
  const done = screen.getByRole("checkbox", {
    name: "健身房上坡快走（已完成）",
  });
  expect(done.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(done);
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("11/04"));
  expect(saved()).toHaveLength(0);
});

it.each(["note", "segments", "deleted", "unchanged", "other"])(
  "preserves the workout draft and checks its base after a cloud %s change",
  async (change) => {
    const source = testInspection().source!;
    const original: Workout = {
      id: "fictional-edit-target",
      date: today(),
      type: "walk",
      minutes: 30,
      calories: 123,
      note: "虛構原始運動",
      segments: [{ minutes: 30, speed: 5, incline: 2 }],
    };
    source.grids.WorkoutLogs.push([
      original.id,
      original.date,
      "Asia/Taipei",
      original.type,
      30,
      123,
      original.note,
      "pwa",
      1,
      "2026-11-06T12:00:00.000Z",
      "",
    ]);
    source.grids.TreadmillSegments!.push([
      "fictional-segment",
      original.id,
      1,
      30,
      5,
      2,
      "2026-11-06T12:00:00.000Z",
      "",
    ]);
    lifecycle.snapshot = testInspection(source);
    render(<App />);
    openSettings();
    await act(async () => fireEvent.click(screen.getByText("連線測試帳號A")));
    fireEvent.click(screen.getByRole("button", { name: "紀錄" }));
    await waitFor(() =>
      expect(screen.getByLabelText("編輯運動")).toHaveProperty(
        "disabled",
        false,
      ),
    );
    fireEvent.click(screen.getByLabelText("編輯運動"));
    fireEvent.change(screen.getByRole("textbox", { name: "備註" }), {
      target: { value: "虛構保留的草稿" },
    });
    const newer = structuredClone(source);
    if (change === "note") newer.grids.WorkoutLogs[1][6] = "虛構雲端新備註";
    if (change === "segments") newer.grids.TreadmillSegments![1][4] = 6;
    if (change === "deleted")
      newer.grids.WorkoutLogs[1][10] = "2026-11-07T12:00:00.000Z";
    if (change === "unchanged") newer.grids.WorkoutLogs[1][8] = 2;
    if (change === "other")
      newer.grids.WorkoutLogs.push([
        "fictional-other-workout",
        original.date,
        "Asia/Taipei",
        "yoga",
        10,
        0,
        "虛構其他運動",
        "pwa",
        1,
        "2026-11-06T12:00:00.000Z",
        "",
      ]);
    lifecycle.snapshot = testInspection(newer);
    await act(async () => fireEvent.click(screen.getByText("連線測試帳號A")));
    if (change === "unchanged" || change === "other") {
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("textbox", { name: "備註" })).toHaveProperty(
        "value",
        "虛構保留的草稿",
      );
      expect(screen.getByRole("button", { name: "儲存紀錄" })).toHaveProperty(
        "disabled",
        false,
      );
      fireEvent.click(screen.getByRole("button", { name: "儲存紀錄" }));
      const queue = readOutbox(localStorage, {
        subject: "A",
        spreadsheetId: "sheet-private-1",
      });
      expect(queue).toHaveLength(1);
      expect(queue[0].value).toEqual(
        expect.objectContaining({ id: original.id, note: "虛構保留的草稿" }),
      );
      if (change === "unchanged")
        expect(queue[0].base).toEqual(expect.objectContaining({ revision: 2 }));
      else expect(screen.getByText("虛構其他運動")).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
      return;
    }
    expect(screen.getByRole("alert").textContent).toContain(
      "運動紀錄已更新或刪除",
    );
    expect(screen.getByRole("textbox", { name: "備註" })).toHaveProperty(
      "value",
      "虛構保留的草稿",
    );
    expect(screen.getByRole("button", { name: "儲存紀錄" })).toHaveProperty(
      "disabled",
      true,
    );
    // A forced form submission must not bypass the disabled control.
    fireEvent.submit(
      screen.getByRole("button", { name: "儲存紀錄" }).closest("form")!,
    );
    expect(
      readOutbox(localStorage, {
        subject: "A",
        spreadsheetId: "sheet-private-1",
      }),
    ).toEqual([]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "關閉" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    if (change === "deleted")
      expect(screen.queryByLabelText("編輯運動")).toBeNull();
    else {
      fireEvent.click(screen.getByLabelText("編輯運動"));
      expect(screen.queryByRole("alert")).toBeNull();
      if (change === "note")
        expect(screen.getByRole("textbox", { name: "備註" })).toHaveProperty(
          "value",
          "虛構雲端新備註",
        );
      else
        expect(
          screen.getByRole("spinbutton", { name: "第 1 段速度" }),
        ).toHaveProperty("value", "6");
      expect(screen.getByRole("button", { name: "儲存紀錄" })).toHaveProperty(
        "disabled",
        false,
      );
    }
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
  },
);

it.each(["updated", "deleted"])(
  "does not queue a stale cloud video draft after %s refresh",
  async (change) => {
    const source = testInspection().source!;
    source.grids.Videos!.push([
      "fictional-cloud-video",
      "https://youtu.be/v7AYKMP6rOE",
      "虛構雲端原影片",
      "瑜伽",
      20,
      "2026-11-06T12:00:00.000Z",
      "",
    ]);
    lifecycle.snapshot = testInspection(source);
    render(<App />);
    openSettings();
    await act(async () => fireEvent.click(screen.getByText("連線測試帳號A")));
    fireEvent.click(screen.getByRole("button", { name: "影片" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "編輯影片：虛構雲端原影片" }),
      ).toHaveProperty("disabled", false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "編輯影片：虛構雲端原影片" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
      target: { value: "虛構未提交影片草稿" },
    });
    const next = structuredClone(source);
    if (change === "updated") next.grids.Videos![1][2] = "虛構雲端新影片";
    else next.grids.Videos![1][6] = "2026-11-07T12:00:00.000Z";
    lifecycle.snapshot = testInspection(next);
    await act(async () => fireEvent.click(screen.getByText("連線測試帳號A")));
    fireEvent.submit(
      screen.getByRole("button", { name: "儲存影片" }).closest("form")!,
    );
    expect(
      readOutbox(localStorage, {
        subject: "A",
        spreadsheetId: "sheet-private-1",
      }),
    ).toEqual([]);
    expect(screen.getByRole("alert").textContent).toContain("影片已更新或刪除");
    expect(screen.getByRole("textbox", { name: "名稱" })).toHaveProperty(
      "value",
      "虛構未提交影片草稿",
    );
    expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("button", { name: "測試更新版本" })).toHaveProperty(
      "disabled",
      false,
    );
    if (change === "updated") {
      fireEvent.click(
        screen.getByRole("button", { name: "編輯影片：虛構雲端新影片" }),
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("textbox", { name: "名稱" })).toHaveProperty(
        "value",
        "虛構雲端新影片",
      );
    } else
      expect(
        screen.queryByRole("button", { name: "編輯影片：虛構雲端原影片" }),
      ).toBeNull();
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
  },
);
it("browsing first asks for a short setup and keeps the answers on this device", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  localStorage.removeItem("daily-movement-entry-v1");
  localStorage.removeItem("daily-movement-profile-v1");
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "先逛逛" }));
  expect(screen.getByRole("dialog", { name: "初次設定" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("暱稱"), {
    target: { value: "小明" },
  });
  fireEvent.click(screen.getByRole("button", { name: /下一步/ }));
  fireEvent.change(screen.getByLabelText("目前體重（kg）"), {
    target: { value: "68.4" },
  });
  fireEvent.click(screen.getByRole("button", { name: /下一步/ }));
  fireEvent.click(screen.getByRole("button", { name: "210" }));
  fireEvent.click(screen.getByRole("button", { name: /下一步/ }));
  fireEvent.click(screen.getByRole("button", { name: "週五" }));
  fireEvent.change(screen.getByLabelText("週五運動"), {
    target: { value: "yoga" },
  });
  fireEvent.click(screen.getByRole("button", { name: /開始/ }));
  expect(screen.queryByRole("dialog", { name: "初次設定" })).toBeNull();
  const stored = JSON.parse(localStorage.getItem(LOCAL_KEY)!);
  expect(stored.metrics).toMatchObject([{ date: "2026-11-04", weight: 68.4 }]);
  expect(
    stored.plans.map((p: { weekday: number; type: string }) => [
      p.weekday,
      p.type,
    ]),
  ).toEqual([
    [1, "home"],
    [3, "walk"],
    [5, "yoga"],
    [6, "home"],
  ]);
  expect(
    JSON.parse(localStorage.getItem(preferenceKey(null))!).weeklyGoal,
  ).toBe(210);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "小明",
  );
  view.unmount();
  render(<App />);
  expect(screen.queryByRole("dialog", { name: "初次設定" })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "日常動作" })).toBeNull();
  expect(screen.getByText(/68\.4/)).toBeTruthy();
});
