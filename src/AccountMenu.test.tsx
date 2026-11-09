// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";
afterEach(cleanup);
const props = () => ({
  cloud: {
    subject: "A",
    spreadsheetId: "sheet-private-1",
    title: "虛構私人試算表",
    timezone: "Asia/Taipei",
    checkedAt: "2026-11-07T00:00:00.000Z",
  },
  online: true,
  readBusy: false,
  syncBusy: false,
  pendingCount: 0,
  issue: false,
  contextKey: "A:sheet:overview",
  onRefresh: vi.fn(),
  onSettings: vi.fn(),
  onLocal: vi.fn(),
});
it("shows private sheet details only after opening and routes settings without owning a session", () => {
  const input = props();
  render(<AccountMenu {...input} />);
  expect(screen.queryByText(input.cloud.title)).toBeNull();
  const avatar = screen.getByRole("button", { name: "帳號與同步設定" });
  fireEvent.click(avatar);
  expect(avatar.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("region", { name: "帳號與同步" })).toBeTruthy();
  expect(screen.getByText(input.cloud.title)).toBeTruthy();
  expect(screen.getByText("Asia/Taipei")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "更新資料" }));
  expect(input.onRefresh).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "設定與備份" }));
  expect(input.onSettings).toHaveBeenCalledTimes(1);
  expect(avatar.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(avatar);
});
it("disables refresh offline or during writes, and keeps local switching separate from logout", () => {
  const input = props();
  const { rerender } = render(
    <AccountMenu {...input} online={false} pendingCount={2} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "帳號與同步設定" }));
  expect(screen.getByText("2 筆修改待同步")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "更新資料" }));
  expect(input.onRefresh).not.toHaveBeenCalled();
  rerender(<AccountMenu {...input} syncBusy />);
  expect(
    (screen.getByRole("button", { name: "更新資料" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "切回本機" }));
  expect(input.onLocal).toHaveBeenCalledTimes(1);
  rerender(<AccountMenu {...input} cloud={null} />);
  fireEvent.click(screen.getByRole("button", { name: "帳號與同步設定" }));
  expect(screen.getByText("本機模式")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "切回本機" })).toBeNull();
});
it("closes on Escape/outside/Tab/context changes without reopening stale account details", () => {
  const input = props();
  const { rerender } = render(
    <>
      <AccountMenu {...input} />
      <button>外部</button>
    </>,
  );
  const avatar = screen.getByRole("button", { name: "帳號與同步設定" });
  fireEvent.click(avatar);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.activeElement).toBe(avatar);
  expect(avatar.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(avatar);
  fireEvent.pointerDown(screen.getByText("外部"));
  expect(screen.queryByRole("region")).toBeNull();
  fireEvent.click(avatar);
  fireEvent.blur(avatar, { relatedTarget: screen.getByText("外部") });
  expect(screen.queryByRole("region")).toBeNull();
  fireEvent.click(avatar);
  rerender(
    <>
      <AccountMenu {...input} contextKey="B:sheet:overview" />
      <button>外部</button>
    </>,
  );
  expect(screen.queryByRole("region")).toBeNull();
  rerender(
    <>
      <AccountMenu {...input} />
      <button>外部</button>
    </>,
  );
  expect(screen.queryByRole("region")).toBeNull();
});

it("opens offline information from its icon and returns focus there on Escape", () => {
  const p = props();
  const view = render(<AccountMenu {...p} online={false} />);
  const button = screen.getByRole("button", { name: "離線說明" });
  fireEvent.click(button);
  expect(
    screen.getByRole("note", { name: "離線模式說明" }).textContent,
  ).toContain("有效 Google 授權後補同步");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  view.rerender(<AccountMenu {...p} online />);
  expect(screen.queryByRole("button", { name: "離線說明" })).toBeNull();
  expect(screen.queryByRole("note")).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "帳號與同步設定" }),
  );
});
