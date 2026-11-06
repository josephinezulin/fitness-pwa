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
afterEach(cleanup);
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
