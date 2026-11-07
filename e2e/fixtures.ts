import {
  test as base,
  expect,
  type Page,
  type Locator,
} from "@playwright/test";
import type { Data, Workout } from "../src/model";

export const ORIGIN = "http://127.0.0.1:4173";
export const STORAGE_KEY = "daily-movement-v1";
export const TODAY = "2026-11-07";
const day = (offset: number) => {
  const date = new Date(`${TODAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

// Fictional fixtures only. No login, storageState, private sheet IDs or tokens.
export const sourceWorkout: Workout = {
  id: "fictional-treadmill",
  date: day(-1),
  type: "walk",
  minutes: 30,
  calories: 222,
  note: "虛構跑步機紀錄",
  segments: [
    { minutes: 10, speed: 4, incline: 0 },
    { minutes: 20, speed: 5, incline: 3 },
  ],
};
export const longWorkout: Workout = {
  ...sourceWorkout,
  id: "fictional-long",
  date: day(-4),
  minutes: 500,
  note: "虛構長表單",
  segments: Array.from({ length: 50 }, () => ({
    minutes: 10,
    speed: 4,
    incline: 0,
  })),
};
export const fixtureData: Data = {
  version: 1,
  metrics: Array.from({ length: 90 }, (_, index) => ({
    id: `fictional-metric-${index}`,
    date: day(-index),
    weight: 60 + (index % 3) / 10,
    ...(index === 6
      ? { steps: 0 }
      : index === 4
        ? { steps: 1200 }
        : index === 3
          ? { steps: 1400 }
          : {}),
  })),
  workouts: [
    {
      id: "fictional-home",
      date: TODAY,
      type: "home",
      minutes: 20,
      calories: 0,
      note: "虛構居家訓練",
    },
    sourceWorkout,
    {
      id: "fictional-outdoor",
      date: day(-2),
      type: "walk",
      minutes: 25,
      calories: 90,
      note: "虛構戶外健走",
    },
    longWorkout,
  ],
};

export const test = base.extend({
  page: async ({ page, context }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Keep dates stable across CI midnight; timers and rendering still run normally.
    await page.clock.setFixedTime(new Date(`${TODAY}T04:00:00Z`));
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === ORIGIN
        ? route.continue()
        : route.abort(),
    );
    await context.addInitScript(
      ({ key, data, origin }) => {
        if (location.origin === origin && !localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(data));
      },
      { key: STORAGE_KEY, data: fixtureData, origin: ORIGIN },
    );
    await use(page);
    expect(errors, "不可有未捕捉的頁面錯誤").toEqual([]);
  },
});
export { expect };

export function workoutRow(page: Page, note: string): Locator {
  return page
    .locator(".log-wrap")
    .filter({ has: page.locator(".note").filter({ hasText: note }) });
}
export async function readData(page: Page): Promise<Data> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
}
export async function expectNoOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(size.document).toBeLessThanOrEqual(size.width + 1);
  expect(size.body).toBeLessThanOrEqual(size.width + 1);
}
export async function reloadOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("目前離線，仍可查看與記錄本機資料。", { exact: true }),
  ).toBeVisible();
}
