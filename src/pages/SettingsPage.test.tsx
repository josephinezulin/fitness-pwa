// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

afterEach(cleanup);
const props = () => ({
  visible: true,
  cloud: false,
  localWritable: false,
  localRecovery: { raw: "{fictional-unreadable" },
  recoveryBlocked: false,
  onExportOriginal: vi.fn(() => true),
  onRepair: vi.fn(async () => {}),
  workoutCount: 0,
  metricCount: 0,
  children: null,
  onExport: vi.fn(),
  onRestore: vi.fn(async () => {}),
  restoring: false,
  onCancelRestore: vi.fn(),
  healthSync: null,
  online: false,
});
const original = () =>
  screen.getByRole("button", { name: "下載待修復原始檔案" });
const acknowledgement = () =>
  screen.getByRole("checkbox", { name: "我已確認原始檔案保存在自己的裝置" });
const repair = () => screen.getByRole("button", { name: "選擇有效備份來修復" });
const disabled = (element: HTMLElement) =>
  (element as HTMLButtonElement).disabled;

it("requires a requested original download and explicit saved-file acknowledgement before repair", () => {
  const input = props();
  render(<SettingsPage {...input} />);
  expect(disabled(acknowledgement())).toBe(true);
  expect(disabled(repair())).toBe(true);
  fireEvent.click(original());
  expect(input.onExportOriginal).toHaveBeenCalledWith(input.localRecovery);
  expect(disabled(acknowledgement())).toBe(false);
  expect(disabled(repair())).toBe(true);
  fireEvent.click(acknowledgement());
  expect(disabled(repair())).toBe(false);
  const file = new File(["fictional"], "fictional.json");
  fireEvent.change(screen.getByLabelText("選擇有效備份來修復"), {
    target: { files: [file] },
  });
  expect(input.onRepair).toHaveBeenCalledWith(file, input.localRecovery);
  expect(input.onRestore).not.toHaveBeenCalled();
  expect(disabled(screen.getByLabelText("還原 JSON 備份"))).toBe(true);
});

it("does not unlock repair after a failed download request", () => {
  const input = props();
  input.onExportOriginal.mockReturnValue(false);
  render(<SettingsPage {...input} />);
  fireEvent.click(original());
  expect(disabled(acknowledgement())).toBe(true);
  expect(disabled(repair())).toBe(true);
});

it("binds the acknowledgement to the exact source and disables repair while drafts or reads are active", () => {
  const input = props();
  const { rerender } = render(<SettingsPage {...input} />);
  fireEvent.click(original());
  fireEvent.click(acknowledgement());
  rerender(<SettingsPage {...input} recoveryBlocked />);
  expect(disabled(original())).toBe(true);
  expect(disabled(repair())).toBe(true);
  rerender(<SettingsPage {...input} restoring />);
  expect(disabled(repair())).toBe(true);
  expect(screen.getByRole("button", { name: "取消讀取" })).toBeTruthy();
  rerender(
    <SettingsPage
      {...input}
      localRecovery={{ raw: input.localRecovery.raw }}
    />,
  );
  expect(disabled(acknowledgement())).toBe(true);
  expect((acknowledgement() as HTMLInputElement).checked).toBe(false);
  expect(disabled(repair())).toBe(true);
});

it("only offers local recovery for an observed unreadable payload", () => {
  const input = props();
  const { rerender } = render(<SettingsPage {...input} cloud />);
  expect(screen.queryByText("以備份修復本機資料")).toBeNull();
  rerender(<SettingsPage {...input} localRecovery={null} />);
  expect(screen.queryByText("以備份修復本機資料")).toBeNull();
});
