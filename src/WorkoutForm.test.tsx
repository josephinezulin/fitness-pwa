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
  it("carries valid totals on activity changes and keeps later manual minutes", () => {
    render(<WorkoutForm {...props()} />);
    const type = screen.getByRole("combobox", { name: "運動類型" });
    fireEvent.change(type, { target: { value: "walk" } });
    fireEvent.change(field("第 1 段分鐘"), { target: { value: "45" } });
    fireEvent.change(type, { target: { value: "cycling" } });
    expect(field("分鐘數").value).toBe("45");
    expect(screen.getByText(/已帶入分段總時間 45 分鐘/)).toBeTruthy();
    expect(field("分鐘數").getAttribute("aria-describedby")).toBe(
      screen.getByRole("status").id,
    );
    fireEvent.change(field("分鐘數"), { target: { value: "47" } });
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.change(type, { target: { value: "yoga" } });
    expect(field("分鐘數").value).toBe("47");
  });
  it.each(["", "30"])(
    "does not invent duration from an incomplete or invalid speed %s",
    (speed) => {
      render(<WorkoutForm {...props()} />);
      fireEvent.change(field("分鐘數"), { target: { value: "71" } });
      fireEvent.change(screen.getByRole("combobox", { name: "運動類型" }), {
        target: { value: "walk" },
      });
      fireEvent.change(field("第 1 段分鐘"), { target: { value: "45.5" } });
      fireEvent.change(field("第 1 段速度"), { target: { value: speed } });
      fireEvent.click(screen.getByRole("checkbox"));
      expect(field("分鐘數").value).toBe("71");
      expect(screen.getByText(/未帶入總時間/)).toBeTruthy();
    },
  );
  it("keeps precise segments, calories and applied-estimate status on a mode round trip", () => {
    const p = props();
    const original: Workout = {
      id: "fictional-precise",
      date: p.today,
      type: "run",
      minutes: 45.5,
      calories: 123,
      note: "虛構精確時長",
      segments: [{ minutes: 45.5, speed: 8.5, incline: 1 }],
    };
    render(
      <WorkoutForm
        {...p}
        editing={original}
        metrics={[{ id: "fictional-weight", date: p.today, weight: 60 }]}
      />,
    );
    fireEvent.click(screen.getByText("幫我估算熱量"));
    fireEvent.click(screen.getByRole("button", { name: "套用估算熱量" }));
    const calories = field("消耗熱量（kcal）").value;
    fireEvent.click(screen.getByRole("checkbox"));
    expect(field("分鐘數").value).toBe("46");
    expect(screen.getByText(/分段共 45.5 分鐘/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(field("第 1 段分鐘").value).toBe("45.5");
    expect(field("分鐘數").value).toBe("45.5");
    expect(field("消耗熱量（kcal）").value).toBe(calories);
    expect(screen.queryByText(/設定已變更/)).toBeNull();
    expect(original.minutes).toBe(45.5);
    expect(original.calories).toBe(123);
  });
  it("carries the current treadmill duration into whole-minute recording when leaving treadmill mode", () => {
    const p = props();
    render(<WorkoutForm {...p} />);
    fireEvent.change(screen.getByRole("combobox", { name: "運動類型" }), {
      target: { value: "walk" },
    });
    fireEvent.change(field("第 1 段分鐘"), { target: { value: "45.5" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(field("分鐘數").value).toBe("46");
    fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
    expect(p.onSave.mock.calls[0][0]).toMatchObject({
      type: "walk",
      minutes: 46,
    });
    expect(p.onSave.mock.calls[0][0]).not.toHaveProperty("segments");
  });
  it("keeps type-specific defaults until a segment has actually been configured", () => {
    render(<WorkoutForm {...props()} />);
    const type = screen.getByRole("combobox", { name: "運動類型" });
    fireEvent.change(type, { target: { value: "walk" } });
    expect(field("第 1 段速度").value).toBe("5.5");
    fireEvent.change(type, { target: { value: "run" } });
    expect(field("第 1 段速度").value).toBe("8.5");
    expect(field("第 1 段分鐘").value).toBe("20");
  });
  it("retains incomplete and decimal segment fields through another activity and a treadmill toggle", () => {
    const p = props();
    const { container } = render(<WorkoutForm {...p} />);
    const type = screen.getByRole("combobox", { name: "運動類型" });
    fireEvent.change(type, { target: { value: "walk" } });
    fireEvent.change(field("第 1 段分鐘"), { target: { value: "12.5" } });
    fireEvent.change(field("第 1 段速度"), { target: { value: "" } });
    fireEvent.change(field("第 1 段坡度"), { target: { value: "0" } });
    fireEvent.change(field("消耗熱量（kcal）"), { target: { value: "123" } });
    fireEvent.change(screen.getByRole("textbox", { name: "備註" }), {
      target: { value: "虛構未完成草稿" },
    });
    fireEvent.change(type, { target: { value: "cycling" } });
    expect(
      screen.queryByRole("spinbutton", { name: "第 1 段速度" }),
    ).toBeNull();
    fireEvent.change(type, { target: { value: "run" } });
    expect(field("第 1 段速度").value).toBe("");
    expect(field("第 1 段分鐘").value).toBe("12.5");
    expect(field("第 1 段坡度").value).toBe("0");
    fireEvent.submit(container.querySelector("form")!);
    expect(p.onSave).not.toHaveBeenCalled();
    fireEvent.change(field("第 1 段速度"), { target: { value: "8.5" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(field("第 1 段分鐘").value).toBe("12.5");
    expect(field("消耗熱量（kcal）").value).toBe("123");
    expect(screen.getByRole("textbox", { name: "備註" })).toHaveProperty(
      "value",
      "虛構未完成草稿",
    );
  });
  it.each([
    ["新增一段", 2],
    ["複製上一段", 2],
    ["平地健走 20 分", 3],
    ["刪除第 2 段", 1],
  ] as const)(
    "preserves structural segment changes from %s when changing type",
    (action, count) => {
      render(<WorkoutForm {...props()} />);
      const type = screen.getByRole("combobox", { name: "運動類型" });
      fireEvent.change(type, { target: { value: "walk" } });
      if (action.startsWith("刪除"))
        fireEvent.click(screen.getByRole("button", { name: /新增一段/ }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(action) }));
      const before = screen
        .getAllByRole("spinbutton", { name: /第 .* 段/ })
        .map((node) => (node as HTMLInputElement).value);
      fireEvent.change(type, { target: { value: "run" } });
      expect(
        screen.getAllByRole("spinbutton", { name: /第 .* 段分鐘/ }),
      ).toHaveLength(count);
      expect(
        screen
          .getAllByRole("spinbutton", { name: /第 .* 段/ })
          .map((node) => (node as HTMLInputElement).value),
      ).toEqual(before);
    },
  );
  it("preserves repeated segments when changing between walking and running", () => {
    const p = props();
    const original: Workout = {
      id: "fictional-repeat",
      date: "2026-10-30",
      type: "walk",
      minutes: 30,
      calories: 99,
      note: "虛構分段",
      segments: [
        { minutes: 12.5, speed: 4, incline: 0 },
        { minutes: 17.5, speed: 5, incline: 3 },
      ],
    };
    render(<WorkoutForm {...p} initialDraft={repeatWorkoutDraft(original)} />);
    fireEvent.change(screen.getByRole("combobox", { name: "運動類型" }), {
      target: { value: "run" },
    });
    expect(
      screen.getAllByRole("spinbutton", { name: /第 .* 段分鐘/ }),
    ).toHaveLength(2);
    expect(field("第 1 段分鐘").value).toBe("12.5");
    expect(field("第 2 段坡度").value).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: /儲存紀錄/ }));
    expect(p.onSave.mock.calls[0][0]).toMatchObject({
      type: "run",
      minutes: 30,
      calories: 0,
      segments: original.segments,
    });
    expect(original.type).toBe("walk");
    expect(original.calories).toBe(99);
  });
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
