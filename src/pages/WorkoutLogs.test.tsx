// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkoutLogs } from "./WorkoutLogs";
import type { Workout } from "../model";
import { calendarDaysEnding } from "../calendar";
afterEach(cleanup);
it("only opens a repeat draft when editing is available and identifies its source date", () => {
  const source: Workout = {
    id: "fictional",
    date: "2026-11-01",
    type: "yoga",
    minutes: 20,
    calories: 80,
    note: "",
  };
  const props = {
    workouts: [source],
    canEdit: false,
    onBegin: vi.fn(),
    onRepeat: vi.fn(),
    onDelete: vi.fn(),
    expanded: null,
    setExpanded: vi.fn(),
  };
  const { rerender } = render(<WorkoutLogs {...props} />);
  const button = screen.getByRole("button", {
    name: "以 2026-11-01 的瑜伽再記一次",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(props.onRepeat).not.toHaveBeenCalled();
  rerender(<WorkoutLogs {...props} canEdit />);
  fireEvent.click(button);
  expect(props.onRepeat).toHaveBeenCalledWith(source);
  expect(props.onBegin).not.toHaveBeenCalled();
  expect(props.onDelete).not.toHaveBeenCalled();
});

const historyProps = () => ({
  workouts: calendarDaysEnding("2026-11-07", 30).map(
    (date, index): Workout => ({
      id: `fictional-${index}`,
      date,
      type: index % 2 ? "yoga" : "walk",
      minutes: 10,
      calories: 0,
      note: `虛構${index}`,
    }),
  ),
  canEdit: true,
  onBegin: vi.fn(),
  onRepeat: vi.fn(),
  onDelete: vi.fn(),
  expanded: null,
  setExpanded: vi.fn(),
  history: true,
});
const rows = () => document.querySelectorAll<HTMLElement>(".log-wrap");

it("shows bounded batches and totals for all matches, with focus on newly revealed records", () => {
  const input = historyProps();
  const { rerender } = render(<WorkoutLogs {...input} />);
  expect(rows()).toHaveLength(12);
  expect(screen.getByRole("status").textContent).toContain(
    "找到 30 筆 · 已顯示 12 筆",
  );
  expect(screen.getByText(/符合條件的全部紀錄：300 分鐘/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "再顯示 12 筆運動" }));
  expect(rows()).toHaveLength(24);
  expect(document.activeElement).toBe(within(rows()[12]).getByRole("heading"));
  fireEvent.click(screen.getByRole("button", { name: "再顯示 6 筆運動" }));
  expect(rows()).toHaveLength(30);
  expect(document.activeElement).toBe(within(rows()[24]).getByRole("heading"));
  expect(screen.queryByRole("button", { name: /再顯示/ })).toBeNull();
  rerender(<WorkoutLogs {...input} workouts={[...input.workouts].slice(1)} />);
  expect(rows()).toHaveLength(29);
  expect(screen.getByRole("status").textContent).toContain("已顯示 29 筆");
  expect(input.workouts).toHaveLength(30);
  expect(input.onBegin).not.toHaveBeenCalled();
  expect(input.onDelete).not.toHaveBeenCalled();
});

it("combines search, type and inclusive dates, keeps search focus, and resets the batch when filters change", () => {
  const input = historyProps();
  const { rerender } = render(<WorkoutLogs {...input} />);
  fireEvent.click(screen.getByRole("button", { name: "再顯示 12 筆運動" }));
  const search = screen.getByRole("searchbox", { name: "搜尋運動紀錄" });
  search.focus();
  fireEvent.change(search, { target: { value: "虛構" } });
  expect(rows()).toHaveLength(12);
  expect(document.activeElement).toBe(search);
  fireEvent.change(screen.getByRole("combobox", { name: "運動種類" }), {
    target: { value: "yoga" },
  });
  fireEvent.change(screen.getByLabelText("開始日期"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText("結束日期"), {
    target: { value: "2026-11-07" },
  });
  expect(rows()).toHaveLength(4);
  expect(screen.getByRole("status").textContent).toContain("找到 4 筆");
  expect(screen.getByText(/符合條件的全部紀錄：40 分鐘/)).toBeTruthy();
  const source = within(rows()[0]);
  fireEvent.click(source.getByRole("button", { name: /再記一次/ }));
  expect(input.onRepeat).toHaveBeenCalledWith(input.workouts[29]);
  fireEvent.click(source.getByRole("button", { name: "編輯運動" }));
  expect(input.onBegin).toHaveBeenCalledWith(input.workouts[29]);
  fireEvent.click(source.getByRole("button", { name: "刪除運動" }));
  expect(input.onDelete).toHaveBeenCalledWith(input.workouts[29].id);
  rerender(<WorkoutLogs {...input} workouts={[...input.workouts]} />);
  expect(rows()).toHaveLength(4);
  expect((search as HTMLInputElement).value).toBe("虛構");
  fireEvent.change(search, { target: { value: "完全不存在的虛構關鍵字" } });
  expect(rows()).toHaveLength(0);
  expect(screen.getByText(/沒有符合條件的紀錄/)).toBeTruthy();
  expect(screen.queryByText("你的運動故事，從第一筆開始。")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
  expect(rows()).toHaveLength(12);
  expect((search as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("開始日期") as HTMLInputElement).value).toBe(
    "",
  );
});

it("explains a reversed date range and preserves records while the range is corrected", () => {
  const input = historyProps();
  render(<WorkoutLogs {...input} />);
  fireEvent.change(screen.getByLabelText("開始日期"), {
    target: { value: "2026-11-07" },
  });
  fireEvent.change(screen.getByLabelText("結束日期"), {
    target: { value: "2026-11-01" },
  });
  expect(screen.getByRole("alert").textContent).toContain("不能晚於");
  expect(screen.getByLabelText("開始日期").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(rows()).toHaveLength(0);
  expect(input.workouts).toHaveLength(30);
  fireEvent.change(screen.getByLabelText("結束日期"), {
    target: { value: "2026-11-07" },
  });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(rows()).toHaveLength(1);
  expect(input.onDelete).not.toHaveBeenCalled();
});

it("keeps filters available without edit permission and leaves the overview limited to four records", () => {
  const input = historyProps();
  const { rerender } = render(<WorkoutLogs {...input} canEdit={false} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "虛構29" },
  });
  expect(rows()).toHaveLength(1);
  for (const name of [/再記一次/, "編輯運動", "刪除運動"]) {
    const button = within(rows()[0]).getByRole("button", {
      name,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(input.onRepeat).not.toHaveBeenCalled();
  expect(input.onBegin).not.toHaveBeenCalled();
  expect(input.onDelete).not.toHaveBeenCalled();
  rerender(<WorkoutLogs {...input} history={false} limit={4} />);
  expect(rows()).toHaveLength(4);
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", { name: /再顯示/ })).toBeNull();
});
