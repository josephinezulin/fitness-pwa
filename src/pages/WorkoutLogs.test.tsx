// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkoutLogs } from "./WorkoutLogs";
import type { Workout } from "../model";
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
