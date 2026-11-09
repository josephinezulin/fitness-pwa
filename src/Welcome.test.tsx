// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Welcome } from "./Welcome";
afterEach(cleanup);
it("shows a single accessible connection error and offers a retry", () => {
  const retry = vi.fn();
  render(
    <Welcome
      account=""
      loginReady
      waiting={false}
      onLogin={retry}
      onLocal={() => {}}
      error="已取消連線，請重試。"
    />,
  );
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe("已取消連線，請重試。");
  const button = screen.getByRole("button", { name: "重試 Google 連線" });
  expect(button.getAttribute("aria-describedby")).toBe(alert.id);
  fireEvent.click(button);
  expect(retry).toHaveBeenCalledOnce();
});
