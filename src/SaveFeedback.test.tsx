// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSaveFeedback } from "./SaveFeedback";
const original = window.matchMedia;
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: original,
  });
});
const media = (matches: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches }),
  });
it("finishes immediately when reduced motion is requested", () => {
  media(true);
  const done = vi.fn();
  const { result } = renderHook(useSaveFeedback);
  act(() => result.current.finish(done));
  expect(done).toHaveBeenCalledOnce();
  expect(result.current.saved).toBe(false);
});
it("acknowledges a save before closing, once the check animation completes", () => {
  media(false);
  const done = vi.fn(),
    duplicate = vi.fn();
  const { result } = renderHook(useSaveFeedback);
  act(() => result.current.finish(done));
  expect(result.current.saved).toBe(true);
  expect(done).not.toHaveBeenCalled();
  act(() => result.current.finish(duplicate));
  act(() => {
    result.current.complete();
    result.current.complete();
  });
  expect(done).toHaveBeenCalledOnce();
  expect(duplicate).not.toHaveBeenCalled();
  expect(result.current.saved).toBe(false);
});
it("does not close a new form from a completion after unmount", () => {
  media(false);
  const done = vi.fn();
  const { result, unmount } = renderHook(useSaveFeedback);
  act(() => result.current.finish(done));
  const complete = result.current.complete;
  unmount();
  act(complete);
  expect(done).not.toHaveBeenCalled();
});
it("clears a cancelled acknowledgement so an inline editor can be reopened", () => {
  media(false);
  const old = vi.fn(),
    next = vi.fn();
  const { result } = renderHook(useSaveFeedback);
  act(() => result.current.finish(old));
  act(() => result.current.cancel());
  act(() => result.current.finish(next));
  act(() => result.current.complete());
  expect(old).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledOnce();
});
