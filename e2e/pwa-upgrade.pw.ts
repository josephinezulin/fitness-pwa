import { test, expect, type Page } from "@playwright/test";
import {
  fixtureData,
  STORAGE_KEY,
  TODAY,
  expectNoOverflow,
  readData,
} from "./fixtures";
import { startPwaUpgradeServer } from "./pwa-server";

function controllerVersion(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) {
          reject(Error("No active test worker"));
          return;
        }
        const channel = new MessageChannel();
        const timeout = setTimeout(() => {
          channel.port1.close();
          reject(Error("Worker did not reply"));
        }, 2000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          channel.port1.close();
          resolve(event.data);
        };
        controller.postMessage({ type: "FICTIONAL_VERSION" }, [channel.port2]);
      }),
  );
}

test("回前景發現新介面，先保護草稿，再明確套用真實 Service Worker 更新", async ({
  page,
  context,
}) => {
  const server = await startPwaUpgradeServer();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.clock.setFixedTime(new Date(`${TODAY}T04:00:00Z`));
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === server.origin
        ? route.continue()
        : route.abort(),
    );
    await context.addInitScript(
      ({ key, data, origin }) => {
        if (location.origin === origin && !localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(data));
      },
      { key: STORAGE_KEY, data: fixtureData, origin: server.origin },
    );
    await page.goto(server.url);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(() => controllerVersion(page)).toBe(1);
    await page.getByRole("button", { name: "記錄運動", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const note = dialog.getByRole("textbox", { name: "備註", exact: true });
    await note.fill("虛構更新前未儲存草稿");
    server.publishNextVersion();
    await page.clock.setFixedTime(new Date(`${TODAY}T04:01:01Z`));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("新版本已就緒。", { exact: false }),
    ).toBeVisible();
    const update = page.getByRole("button", { name: "更新版本", exact: true });
    await expect(update).toBeDisabled();
    await expect(note).toHaveValue("虛構更新前未儲存草稿");
    expect(await controllerVersion(page)).toBe(1);
    expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
    await expectNoOverflow(page);
    await dialog.getByRole("button", { name: "關閉", exact: true }).click();
    await expect(update).toBeEnabled();
    expect(await controllerVersion(page)).toBe(1);
    await Promise.all([page.waitForEvent("load"), update.click()]);
    await expect.poll(() => controllerVersion(page)).toBe(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
    expect((await readData(page)).metrics).toEqual(fixtureData.metrics);
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
  }
});
