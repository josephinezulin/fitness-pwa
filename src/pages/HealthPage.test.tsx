// @vitest-environment jsdom
import { useEffect } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthPage } from "./HealthPage";
import { calendarDaysEnding } from "../calendar";

afterEach(cleanup);

const metrics = () =>
  calendarDaysEnding("2026-11-07", 50).map((date, index) => ({
    id: `fictional-${date}`,
    date,
    weight: 60 + index / 100,
  }));
const props = () => ({
  metrics: metrics(),
  workspaceKey: "fictional-account-a:file-a",
  viewToday: "2026-11-07",
  range: 30,
  cloud: false,
  chart: <div>保留的曲線圖</div>,
  onAdd: vi.fn(),
  onDelete: vi.fn(),
});
const history = () => screen.getByRole("region", { name: "健康摘要" });
const list = () => screen.getByRole("list", { name: "健康摘要紀錄" });
const entries = () => within(list()).getAllByRole("listitem");

describe("bounded health summary history", () => {
  it("uses inclusive chart calendar dates, preserves zero/missing values and leaves input order unchanged", () => {
    const input = props();
    const data = [
      { id: "start", date: "2026-11-01", steps: 0, fat: 0 },
      { id: "old", date: "2026-10-31", weight: 60 },
      { id: "today", date: "2026-11-07", steps: 1234, heart: 65 },
      { id: "future", date: "2026-11-08", steps: 4567 },
    ];
    render(<HealthPage {...input} metrics={data} range={7} />);
    expect(entries()).toHaveLength(2);
    expect(within(entries()[0]).getByRole("heading").textContent).toBe(
      "2026-11-07",
    );
    expect(within(entries()[0]).getByText("1,234 步")).toBeTruthy();
    expect(within(entries()[1]).getByText("0 步")).toBeTruthy();
    expect(within(entries()[1]).getByText("0 %")).toBeTruthy();
    expect(within(entries()[1]).getAllByText("未記錄")).toHaveLength(2);
    expect(within(history()).getByRole("status").textContent).toContain(
      "近 7 天 · 已顯示 2 / 2 筆",
    );
    expect(screen.queryByText("2026-10-31")).toBeNull();
    expect(screen.queryByText("2026-11-08")).toBeNull();
    expect(data.map((row) => row.id)).toEqual([
      "start",
      "old",
      "today",
      "future",
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "刪除 2026-11-01 健康摘要" }),
    );
    expect(input.onDelete).toHaveBeenCalledWith("start");
    fireEvent.click(screen.getByRole("button", { name: "新增健康數據" }));
    expect(input.onAdd).toHaveBeenCalledOnce();
  });

  it("reveals older batches with focus on the first new date, preserving the expanded view after refresh and delete", () => {
    const input = props();
    const { rerender } = render(<HealthPage {...input} />);
    expect(entries()).toHaveLength(14);
    expect(within(history()).getByRole("status").textContent).toContain(
      "14 / 30 筆",
    );
    fireEvent.click(screen.getByRole("button", { name: "再顯示 14 筆" }));
    expect(entries()).toHaveLength(28);
    expect(document.activeElement).toBe(
      within(entries()[14]).getByRole("heading"),
    );
    expect(document.activeElement?.textContent).toBe("2026-10-24");
    fireEvent.click(screen.getByRole("button", { name: "再顯示 2 筆" }));
    expect(entries()).toHaveLength(30);
    expect(document.activeElement).toBe(
      within(entries()[28]).getByRole("heading"),
    );
    expect(screen.queryByRole("button", { name: /再顯示/ })).toBeNull();
    rerender(<HealthPage {...input} metrics={input.metrics.slice(0, -1)} />);
    expect(entries()).toHaveLength(29);
    expect(
      new Set(entries().map((row) => row.querySelector("time")?.dateTime)).size,
    ).toBe(29);
    expect(within(history()).getByRole("status").textContent).toContain(
      "29 / 29 筆",
    );
  });

  it("offers all dates without truncating stored history and marks future records outside the chart", () => {
    const input = props();
    const data = [
      ...input.metrics,
      { id: "future", date: "2026-11-08", weight: 60 },
    ];
    const { rerender } = render(
      <HealthPage {...input} metrics={data} range={7} />,
    );
    expect(entries()).toHaveLength(7);
    fireEvent.click(screen.getByRole("checkbox", { name: "全部日期" }));
    expect(entries()).toHaveLength(14);
    expect(within(history()).getByRole("status").textContent).toContain(
      "全部日期 · 已顯示 14 / 51 筆",
    );
    expect(within(entries()[0]).getByText("（未來日期）")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再顯示 14 筆" }));
    rerender(<HealthPage {...input} metrics={[...data]} range={7} />);
    expect(entries()).toHaveLength(28);
    fireEvent.click(screen.getByRole("checkbox", { name: "全部日期" }));
    expect(entries()).toHaveLength(7);
    expect(screen.queryByText("2026-11-08")).toBeNull();
    expect(data).toHaveLength(51);
  });

  it("resets history on chart range, day, account or file changes without remounting the chart", () => {
    const mounted = vi.fn();
    function Chart() {
      useEffect(mounted, []);
      return <div>圖表</div>;
    }
    const input = { ...props(), chart: <Chart /> };
    const { rerender } = render(<HealthPage {...input} />);
    for (const change of [
      { range: 7 },
      { viewToday: "2026-11-08" },
      { workspaceKey: "fictional-account-b:file-a" },
      { workspaceKey: "fictional-account-b:file-b" },
    ]) {
      fireEvent.click(screen.getByRole("checkbox", { name: "全部日期" }));
      fireEvent.click(screen.getByRole("button", { name: "再顯示 14 筆" }));
      Object.assign(input, change);
      rerender(<HealthPage {...input} />);
      expect(
        (screen.getByRole("checkbox", { name: "全部日期" }) as HTMLInputElement)
          .checked,
      ).toBe(false);
      expect(entries().length).toBeLessThanOrEqual(14);
    }
    expect(mounted).toHaveBeenCalledOnce();
  });

  it("explains empty periods and keeps cloud health read-only", () => {
    const input = props();
    const { rerender } = render(
      <HealthPage
        {...input}
        metrics={[{ id: "old", date: "2026-01-01", weight: 60 }]}
        cloud
      />,
    );
    expect(screen.getByText(/近 30 天沒有健康摘要/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "全部日期" }));
    expect(entries()).toHaveLength(1);
    expect(
      within(history()).queryByRole("button", { name: /刪除/ }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "新增健康數據",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/雲端健康摘要為唯讀/)).toBeTruthy();
    rerender(<HealthPage {...input} metrics={[]} cloud />);
    expect(screen.getByText("連接的試算表尚無健康摘要。")).toBeTruthy();
    rerender(<HealthPage {...input} metrics={[]} />);
    expect(
      screen.getByText("尚無健康摘要，新增健康數據就能開始記錄。"),
    ).toBeTruthy();
    expect(input.onDelete).not.toHaveBeenCalled();
  });
});
