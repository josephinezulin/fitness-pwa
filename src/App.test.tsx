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
const lifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
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
                const inspection = testInspection();
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
beforeEach(() => {
  lifecycle.mounts = 0;
  lifecycle.unmounts = 0;
  localStorage.clear();
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
  expect(screen.getByText("虛構其他分頁最新紀錄")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("does not refresh local data while a backup is being read and preserves the newer storage", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
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
  fireEvent.click(screen.getByRole("button", { name: "運動紀錄" }));
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
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
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
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
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
  fireEvent.click(screen.getByRole("button", { name: "運動紀錄" }));
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
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
  fireEvent.click(screen.getByText("連線測試帳號A"));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "記錄運動" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "總覽" }));
  expect(screen.queryByText(/私人雲端：/)).toBeNull();
  expect(screen.queryByText("虛構表A")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "帳號與同步設定" }));
  expect(screen.getByText("虛構表A")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "管理 Google 連線" }));
  expect(screen.getByRole("heading", { name: "設定與備份" })).toBeTruthy();
  expect(lifecycle.mounts).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "記錄運動" }));
  fireEvent.click(screen.getByRole("button", { name: "儲存紀錄" }));
  expect(screen.getByText("1 筆修改保留在此裝置")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "帳號與同步" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "本週課表" }));
  fireEvent.click(screen.getByLabelText("編輯帳號A課表"));
  fireEvent.change(screen.getByLabelText("課表名稱"), {
    target: { value: "帳號A的未儲存草稿" },
  });
  await waitFor(() =>
    expect(
      (screen.getByText("測試更新版本") as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole("button", { name: "總覽" }));
  fireEvent.click(screen.getByRole("button", { name: "本週課表" }));
  expect((screen.getByLabelText("課表名稱") as HTMLInputElement).value).toBe(
    "帳號A的未儲存草稿",
  );
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
  await act(async () => {
    fireEvent.click(screen.getByText("連線測試帳號B"));
  });
  fireEvent.click(screen.getByRole("button", { name: "本週課表" }));
  expect(screen.queryByLabelText("課表名稱")).toBeNull();
  expect(screen.getByLabelText("編輯帳號B課表")).toBeTruthy();
  expect((screen.getByText("測試更新版本") as HTMLButtonElement).disabled).toBe(
    false,
  );
  expect(lifecycle.mounts).toBe(1);
  expect(lifecycle.unmounts).toBe(0);
  expect(JSON.stringify(localStorage)).not.toContain("must-never-persist");
});
