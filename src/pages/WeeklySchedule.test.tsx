// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanManager, WeeklySchedule } from "./WeeklySchedule";
import { defaultPlans, weekDays } from "../model";
afterEach(cleanup);
describe("weekly plan experience", () => {
  it("saves an explicit plan with ISO weekday and a literal title", () => {
    const save = vi.fn(() => true);
    render(
      <PlanManager plans={[]} canEdit onSave={save} onDraftChange={() => {}} />,
    );
    fireEvent.click(screen.getByText("新增課表"));
    fireEvent.change(screen.getByLabelText("課表名稱"), {
      target: { value: "=輕鬆瑜伽" },
    });
    fireEvent.change(screen.getByLabelText("星期"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("運動類型"), {
      target: { value: "yoga" },
    });
    fireEvent.click(screen.getByText("儲存課表"));
    expect(save).toHaveBeenCalledWith([
      expect.objectContaining({
        weekday: 7,
        type: "yoga",
        title: "=輕鬆瑜伽",
        active: true,
      }),
    ]);
  });
  it("preserves the draft on a changed remote record and on save failure", () => {
    const save = vi.fn(() => false),
      onDraftChange = vi.fn();
    const { rerender } = render(
      <PlanManager
        plans={[defaultPlans[0]]}
        canEdit
        onSave={save}
        onDraftChange={onDraftChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("編輯居家徒手訓練"));
    fireEvent.change(screen.getByLabelText("課表名稱"), {
      target: { value: "我的草稿" },
    });
    fireEvent.click(screen.getByText("儲存課表"));
    expect((screen.getByLabelText("課表名稱") as HTMLInputElement).value).toBe(
      "我的草稿",
    );
    save.mockClear();
    rerender(
      <PlanManager
        plans={[{ ...defaultPlans[0], title: "遠端更新" }]}
        canEdit
        onSave={save}
        onDraftChange={onDraftChange}
      />,
    );
    fireEvent.click(screen.getByText("儲存課表"));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("草稿仍保留");
    expect(onDraftChange).toHaveBeenCalledWith(true);
  });
  it("blocks duplicate enabling and allows pausing without deleting records", () => {
    const save = vi.fn(() => true),
      p = defaultPlans[0];
    const { rerender } = render(
      <PlanManager
        plans={[p, { ...p, id: "paused", title: "另一個", active: false }]}
        canEdit
        onSave={save}
        onDraftChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("啟用另一個"));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("同一天");
    rerender(
      <PlanManager
        plans={[p]}
        canEdit
        onSave={save}
        onDraftChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("停用居家徒手訓練"));
    expect(save).toHaveBeenCalledWith([{ ...p, active: false }]);
  });
  it("shows dynamic completion and embeds direct tutorial links only after a tap", () => {
    const p = {
      ...defaultPlans[0],
      tutorialUrl: "https://youtu.be/v7AYKMP6rOE",
    };
    const { container, rerender } = render(
      <WeeklySchedule
        plans={[p]}
        workouts={[
          {
            id: "w1",
            date: "2026-11-02",
            type: "home",
            minutes: 10,
            calories: 0,
            note: "",
          },
        ]}
        days={weekDays(new Date("2026-11-06T12:00:00"))}
        viewToday="2026-11-06"
        onManage={() => {}}
      />,
    );
    expect(screen.getByText("1 / 1 完成")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByText("播放教學"));
    expect(container.querySelector("iframe")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/v7AYKMP6rOE?playsinline=1",
    );
    rerender(
      <WeeklySchedule
        plans={[]}
        workouts={[]}
        days={weekDays()}
        viewToday="2026-11-06"
        onManage={() => {}}
      />,
    );
    expect(screen.getByText("0 / 0 完成")).toBeTruthy();
    expect(screen.getByText(/目前沒有啟用/)).toBeTruthy();
  });
});
