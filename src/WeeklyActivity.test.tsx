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
