// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HealthSyncCard } from "./HealthSyncCard";
import type { HealthSyncEntry } from "./health-sync-status";
afterEach(cleanup);
const entry = (
  status: HealthSyncEntry["status"],
  receivedAt = "2026-11-07T18:00:00Z",
): HealthSyncEntry => ({
  receivedAt,
  status,
  acceptedCount: 5,
  rejectedCount: 0,
});
const props = {
  cloud: true,
  timezone: "Asia/Taipei",
  readAt: "2026-11-07T19:00:00Z",
  online: true,
};
it("separates local mode, unavailable cached metadata and an inspected empty log", () => {
  const { rerender } = render(
    <HealthSyncCard {...props} cloud={false} summary={null} />,
  );
  expect(screen.getByText("尚未連線")).toBeTruthy();
  rerender(<HealthSyncCard {...props} summary={null} online={false} />);
  expect(screen.getByText("待更新資料")).toBeTruthy();
  expect(screen.getByText(/目前沒有可用的同步紀錄資訊/)).toBeTruthy();
  expect(screen.getByText(/目前離線，尚未重新確認/)).toBeTruthy();
  rerender(
    <HealthSyncCard {...props} summary={{ latest: null, lastSuccess: null }} />,
  );
  expect(screen.getByText("尚無同步紀錄")).toBeTruthy();
  expect(screen.queryByText(/最近批次已完成/)).toBeNull();
  expect(
    screen
      .getByRole("link", { name: /查看捷徑同步設定說明/ })
      .getAttribute("href"),
  ).toMatch(/^https:\/\/github.com\/josephinezulin\/fitness-pwa\//);
});
it("shows successful processing without claiming inputs are new rows or all health data is current", () => {
  const success = entry("committed");
  const { container } = render(
    <HealthSyncCard
      {...props}
      summary={{ latest: success, lastSuccess: success }}
    />,
  );
  expect(screen.getByText("最近批次已完成")).toBeTruthy();
  expect(screen.getByText(/本批已處理 5 筆輸入/).textContent).toContain(
    "這不是本次新增的筆數",
  );
  expect(screen.getByText(/也不代表所有健康資料都已同步/)).toBeTruthy();
  expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
    success.receivedAt,
  );
  expect(container.querySelector("time")?.textContent).toContain("2026/11/8");
});
it("retains last success while an incomplete or failed latest batch remains explicit", () => {
  const success = entry("committed", "2026-11-06T00:00:00Z");
  const { rerender, container } = render(
    <HealthSyncCard
      {...props}
      summary={{ latest: entry("partial"), lastSuccess: success }}
    />,
  );
  expect(screen.getByText("最近批次未確認完成")).toBeTruthy();
  expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
    success.receivedAt,
  );
  expect(screen.getByText(/目前不能視為成功/)).toBeTruthy();
  rerender(
    <HealthSyncCard
      {...props}
      summary={{ latest: entry("failed"), lastSuccess: null }}
    />,
  );
  expect(screen.getByText("最近批次失敗")).toBeTruthy();
  expect(screen.getByText("尚無成功批次")).toBeTruthy();
});
