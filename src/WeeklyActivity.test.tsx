// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WeeklyGoal } from "./WeeklyActivity";
afterEach(cleanup);
it("shows actual minutes past the goal while bounding the accessible progress bar", () => {
  render(<WeeklyGoal minutes={180} goal={150} onChange={() => true} />);
  const bar = screen.getByRole("progressbar") as HTMLProgressElement;
  expect(bar.value).toBe(150);
  expect(bar.max).toBe(150);
  expect(screen.getByText("180")).toBeTruthy();
  expect(screen.getByText(/已達到自己的累積目標/)).toBeTruthy();
});
it("saves a user goal only after explicit submission", () => {
  const save = vi.fn(() => true);
  render(<WeeklyGoal minutes={20} goal={150} onChange={save} />);
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
    { target: { value: "90" } },
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "儲存目標" }));
  expect(save).toHaveBeenCalledWith(90);
});

it("reports drafts before layout, focuses the input and returns focus after successful save", () => {
  const draft = vi.fn(),
    save = vi.fn(() => true);
  const { unmount } = render(
    <WeeklyGoal
      minutes={20}
      goal={150}
      onChange={save}
      onDraftChange={draft}
    />,
  );
  const toggle = screen.getByRole("button", { name: "調整目標" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.hasAttribute("aria-controls")).toBe(false);
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-controls")).toBe(
    screen.getByRole("form", { name: "每週運動目標" }).id,
  );
  expect(draft).toHaveBeenLastCalledWith(true);
  const field = screen.getByRole("spinbutton", { name: "每週目標（分鐘）" });
  expect(document.activeElement).toBe(field);
  expect(
    screen
      .getByRole("button", { name: "取消調整" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  fireEvent.change(field, { target: { value: "180" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存目標" }));
  expect(save).toHaveBeenCalledWith(180);
  expect(draft).toHaveBeenLastCalledWith(false);
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  expect(draft).toHaveBeenLastCalledWith(true);
  unmount();
  expect(draft).toHaveBeenLastCalledWith(false);
});

it("retains a failed save and its draft lock, then cancels without another save", () => {
  const draft = vi.fn(),
    save = vi.fn(() => false);
  render(
    <WeeklyGoal
      minutes={20}
      goal={150}
      onChange={save}
      onDraftChange={draft}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  const field = screen.getByRole("spinbutton", { name: "每週目標（分鐘）" });
  fireEvent.change(field, { target: { value: "180" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存目標" }));
  expect(field).toHaveProperty("value", "180");
  expect(draft).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "取消調整" }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(draft).toHaveBeenLastCalledWith(false);
});

it("clears validation feedback on cancel and reopens with the saved goal", () => {
  const save = vi.fn(() => true);
  render(<WeeklyGoal minutes={20} goal={150} onChange={save} />);
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
    { target: { value: "9" } },
  );
  fireEvent.submit(screen.getByRole("form", { name: "每週運動目標" }));
  expect(screen.getByRole("status").textContent).toContain("10–2000");
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消調整" }));
  fireEvent.click(screen.getByRole("button", { name: "調整目標" }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    screen.getByRole("spinbutton", { name: "每週目標（分鐘）" }),
  ).toHaveProperty("value", "150");
});
