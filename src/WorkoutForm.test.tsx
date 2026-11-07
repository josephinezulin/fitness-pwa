// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkoutForm } from "./WorkoutForm";
import { repeatWorkoutDraft } from "./exercise";
import type { Workout } from "./model";
const props = () => ({
  editing: null,
  today: "2026-11-06",
  disabled: false,
  onSave: vi.fn((_record: import("./model").Workout) => true),
});
afterEach(cleanup);
function field(name: string) {
  return screen.getByRole("spinbutton", { name }) as HTMLInputElement;
}
describe("workout recording experience", () => {
  it("opens repeated treadmill settings for today with independent segments, a new ID and fresh calories", () => {
    const p = props();
    const original: Workout = {
      id: "previous",
      date: "2026-10-30",
      type: "walk",
      minutes: 30,
      calories: 222,
      note: "上坡機台",
      segments: [
        { minutes: 12.5, speed: 4, incline: 0 },
        { minutes: 17.5, speed: 5, incline: 3 },
      ],
    };
    render(<WorkoutForm {...p} initialDraft={repeatWorkoutDraft(original)} />);
    expect((screen.getByLabelText("日期") as HTMLInputElement).value).toBe(
      p.today,
    );
    expect(field("消耗熱量（kcal）").value).toBe("0");
    expect(field("第 2 段分鐘").value).toBe("17.5");
    expect(field("第 2 段坡度").value).toBe("3");
    expect(screen.getByText(/已帶入 2026-10-30/)).toBeTruthy();
    expect(p.onSave).not.toHaveBeenCalled();
    fireEvent.change(field("第 1 段速度"), { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
    const saved = p.onSave.mock.calls[0][0];
    expect(saved).toMatchObject({
      date: p.today,
      type: "walk",
      minutes: 30,
      calories: 0,
      note: "上坡機台",
    });
    expect(saved.id).not.toBe(original.id);
    expect(saved.segments![0].speed).toBe(4.5);
    expect(original.segments![0].speed).toBe(4);
    expect(saved).not.toHaveProperty("fromDate");
  });
  it("repeats outdoor walking without enabling treadmill or copying the previous calories", () => {
    const p = props();
    render(
      <WorkoutForm
        {...p}
        initialDraft={repeatWorkoutDraft({
          id: "outdoor",
          date: "2026-10-30",
          type: "walk",
          minutes: 23,
          calories: 80,
          note: "公園走路",
        })}
      />,
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
    expect(field("分鐘數").value).toBe("23");
    fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
    expect(p.onSave.mock.calls[0][0]).not.toHaveProperty("segments");
    expect(p.onSave.mock.calls[0][0]).toMatchObject({
      type: "walk",
      calories: 0,
      note: "公園走路",
    });
  });
  it("opens walk with treadmill enabled and applies a complete preset", () => {
    const p = props();
    render(<WorkoutForm {...p} />);
    fireEvent.change(screen.getByRole("combobox", { name: "運動類型" }), {
      target: { value: "walk" },
    });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "緩坡快走 30 分" }));
    expect(
      screen.getAllByRole("spinbutton", { name: /第 .* 段分鐘/ }),
    ).toHaveLength(3);
    expect(field("分鐘數").value).toBe("30");
    fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
    expect(p.onSave.mock.calls[0][0]).toMatchObject({
      type: "walk",
      minutes: 30,
      segments: [
        { minutes: 5, speed: 4, incline: 0 },
        { minutes: 20, speed: 5, incline: 3 },
        { minutes: 5, speed: 4, incline: 0 },
      ],
    });
  });
  it("keeps the existing machine calories when settings change, and only applies an estimate explicitly", () => {
    const p = props();
    render(
      <WorkoutForm
        {...p}
        editing={{
          id: "w",
          date: "2026-11-06",
          type: "walk",
          minutes: 30,
          calories: 123,
          note: "",
          segments: [{ minutes: 30, speed: 5, incline: 3 }],
        }}
        metrics={[{ id: "weight", date: "2026-11-01", weight: 60 }]}
      />,
    );
    fireEvent.change(field("第 1 段坡度"), { target: { value: "4" } });
    expect(field("消耗熱量（kcal）").value).toBe("123");
    fireEvent.click(screen.getByText("幫我估算熱量"));
    fireEvent.click(screen.getByRole("button", { name: "套用估算熱量" }));
    expect(field("消耗熱量（kcal）").value).toBe("161");
    fireEvent.change(field("第 1 段坡度"), { target: { value: "5" } });
    expect(field("消耗熱量（kcal）").value).toBe("161");
    expect(screen.getByText(/設定已變更/)).toBeTruthy();
  });
  it("updates the historical estimate weight when changing date, without modifying metrics", () => {
    const metrics = [
      { id: "old", date: "2026-10-01", weight: 70 },
      { id: "new", date: "2026-11-01", weight: 60 },
    ];
    render(<WorkoutForm {...props()} metrics={metrics} />);
    fireEvent.click(screen.getByText("幫我估算熱量"));
    expect(
      (
        screen.getByRole("textbox", {
          name: "估算用體重（kg）",
        }) as HTMLInputElement
      ).placeholder,
    ).toBe("60");
    fireEvent.change(screen.getByLabelText("日期"), {
      target: { value: "2026-10-15" },
    });
    expect(
      (
        screen.getByRole("textbox", {
          name: "估算用體重（kg）",
        }) as HTMLInputElement
      ).placeholder,
    ).toBe("70");
    fireEvent.change(
      screen.getByRole("textbox", { name: "估算用體重（kg）" }),
      { target: { value: "80" } },
    );
    expect(metrics[0].weight).toBe(70);
  });
  it("prefills a video draft but does not record it until submit", () => {
    const p = props();
    render(
      <WorkoutForm
        {...p}
        initialDraft={{
          type: "yoga",
          minutes: 20,
          note: "影片：測試教學",
          videoId: "v7AYKMP6rOE",
        }}
      />,
    );
    expect(p.onSave).not.toHaveBeenCalled();
    expect(field("分鐘數").value).toBe("20");
    fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
    expect(p.onSave.mock.calls[0][0]).toMatchObject({
      type: "yoga",
      minutes: 20,
      note: "影片：測試教學",
    });
    expect(p.onSave.mock.calls[0][0]).not.toHaveProperty("videoId");
  });
  it("shows segment-specific errors and does not submit invalid segments", () => {
    const p = props();
    const { container } = render(<WorkoutForm {...p} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "walk" },
    });
    fireEvent.change(field("第 1 段速度"), { target: { value: "30" } });
    expect(screen.getByText(/第 1 段速度需為/)).toBeTruthy();
    fireEvent.submit(container.querySelector("form")!);
    expect(p.onSave).not.toHaveBeenCalled();
  });
});
