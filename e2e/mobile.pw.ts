import {
  test,
  expect,
  TODAY,
  fixtureData,
  STORAGE_KEY,
  sourceWorkout,
  longWorkout,
  workoutRow,
  readData,
  expectNoOverflow,
  reloadOffline,
} from "./fixtures";
import { readFile } from "node:fs/promises";

test("平滑曲線、缺值及數值清單保留真實零", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "健康趨勢", exact: true }).click();
  await page.getByRole("combobox", { name: "趨勢時間範圍" }).selectOption("7");
  const chart = page.getByRole("application");
  await expect(chart.locator(".recharts-area-curve")).toHaveAttribute("d", /C/);
  await expect(chart.locator(".recharts-area-dot")).toHaveCount(0);
  await page.getByRole("button", { name: "步數", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await chart.locator(".recharts-area-curve").getAttribute("d"))?.match(
          /M/g,
        )?.length,
    )
    .toBe(2);
  await expect(chart.locator(".recharts-area-dot")).toHaveCount(1);
  await page.mouse.move(2, 2);
  await chart.focus();
  await expect(page.locator(".chart .trend-tooltip")).toContainText("0 步");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".chart .trend-tooltip")).toContainText("未記錄");
  await page.getByText("查看每日數值", { exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(8);
  await expect(
    table.getByRole("row", { name: "2026-11-01 0", exact: true }),
  ).toBeAttached();
  await expect(
    table.getByRole("row", { name: "2026-11-02 未記錄", exact: true }),
  ).toBeAttached();
  await expectNoOverflow(page);
});

test("每日與每週數值限制高度，捲到底仍可直接收合", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "健康趨勢", exact: true }).click();
  await page.getByRole("combobox", { name: "趨勢時間範圍" }).selectOption("90");
  const verify = async (label: string, rowCount: number) => {
    const summary = page.getByText(label, { exact: true });
    const details = summary.locator("..");
    await summary.click();
    const region = details.getByRole("region", { name: /可捲動數值清單/ });
    await region.scrollIntoViewIfNeeded();
    const size = await region.evaluate((el) => ({
      height: el.clientHeight,
      total: el.scrollHeight,
    }));
    expect(size.height).toBeLessThanOrEqual(
      Math.min(320, page.viewportSize()!.height / 2) + 1,
    );
    expect(size.total).toBeGreaterThan(size.height);
    await expect(details.getByRole("row")).toHaveCount(rowCount);
    const top = (await summary.boundingBox())!.y;
    const documentY = await page.evaluate(() => scrollY);
    await region.focus();
    await page.keyboard.press("End");
    await expect
      .poll(() =>
        region.evaluate(
          (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => scrollY)).toBe(documentY);
    const after = (await summary.boundingBox())!;
    expect(Math.abs(after.y - top)).toBeLessThan(1);
    expect(after.y).toBeGreaterThanOrEqual(0);
    expect(after.y + after.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
    expect(
      Math.abs(
        (await details.locator("thead").boundingBox())!.y -
          (await region.boundingBox())!.y,
      ),
    ).toBeLessThanOrEqual(2);
    await summary.click();
    await expect(details).not.toHaveAttribute("open");
    expect((await details.boundingBox())!.height).toBeLessThanOrEqual(50);
  };
  await verify("查看每日數值", 91);
  await page.getByRole("button", { name: "運動紀錄", exact: true }).click();
  await verify("查看每週數值", 9);
  await expectNoOverflow(page);
});

test("健康摘要分批閱讀，切換範圍後重設視窗", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "健康趨勢", exact: true }).click();
  const history = page.getByRole("region", { name: "健康摘要", exact: true });
  const entries = history.getByRole("listitem");
  await expect(entries).toHaveCount(14);
  await expect(history.getByRole("status")).toContainText("14 / 30 筆");
  await history.getByRole("checkbox", { name: "全部日期" }).check();
  await expect(history.getByRole("status")).toContainText("14 / 90 筆");
  await history.getByRole("button", { name: "再顯示 14 筆" }).click();
  await expect(entries).toHaveCount(28);
  await expect(entries.nth(14).getByRole("heading")).toBeFocused();
  await page.getByRole("combobox", { name: "趨勢時間範圍" }).selectOption("7");
  await expect(entries).toHaveCount(7);
  await expect(history.getByRole("checkbox")).not.toBeChecked();
  expect((await readData(page)).metrics).toHaveLength(90);
  await expectNoOverflow(page);
});

test("50 段長表單關閉按鈕可見，焦點與取消正常", async ({ page }) => {
  await page.goto("./");
  const opener = workoutRow(page, longWorkout.note).getByRole("button", {
    name: "編輯運動",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog");
  const close = dialog.getByRole("button", { name: "關閉", exact: true });
  const form = dialog.locator("form");
  await expect(close).toBeFocused();
  await expect(dialog.getByLabel(/^第 \d+ 段速度$/)).toHaveCount(50);
  const headerTop = (await dialog.locator(".dialog-head").boundingBox())!.y;
  await form.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(await form.evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
  expect((await dialog.locator(".dialog-head").boundingBox())!.y).toBe(
    headerTop,
  );
  const bounds = (await close.boundingBox())!;
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  await expect(close).toBeInViewport({ ratio: 1 });
  expect(
    await close.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
      );
    }),
  ).toBe(true);
  await dialog
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("虛構待取消的備註");
  await close.click();
  await expect(opener).toBeFocused();
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await opener.click();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: /儲存紀錄/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await expectNoOverflow(page);
});

test("再記一次保留原紀錄，離線重載仍可新增", async ({ page }) => {
  await page.goto("./");
  const source = workoutRow(page, sourceWorkout.note);
  await source.getByRole("button", { name: /再記一次/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("日期", { exact: true })).toHaveValue(TODAY);
  await expect(dialog.getByLabel("消耗熱量（kcal）")).toHaveValue("0");
  await expect(dialog.getByLabel("第 2 段坡度", { exact: true })).toHaveValue(
    "3",
  );
  await dialog.getByLabel("第 1 段速度", { exact: true }).fill("4.5");
  await dialog.getByRole("button", { name: "關閉", exact: true }).click();
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await source.getByRole("button", { name: /再記一次/ }).click();
  await expect(dialog.getByLabel("第 1 段速度", { exact: true })).toHaveValue(
    "4",
  );
  await dialog.getByLabel("第 1 段速度", { exact: true }).fill("4.5");
  await dialog.getByLabel("消耗熱量（kcal）").fill("150");
  await dialog.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(dialog).toHaveCount(0);
  let saved = await readData(page);
  const fresh = saved.workouts.find(
    (w) => !fixtureData.workouts.some((source) => source.id === w.id),
  )!;
  expect(saved.workouts).toHaveLength(5);
  expect(fresh).toMatchObject({
    date: TODAY,
    calories: 150,
    segments: [
      { minutes: 10, speed: 4.5, incline: 0 },
      { minutes: 20, speed: 5, incline: 3 },
    ],
  });
  expect(saved.workouts.find((w) => w.id === sourceWorkout.id)).toEqual(
    sourceWorkout,
  );
  await reloadOffline(page);
  await page.getByRole("button", { name: "運動紀錄", exact: true }).click();
  await workoutRow(page, "虛構戶外健走")
    .getByRole("button", { name: /再記一次/ })
    .click();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(dialog.getByLabel("分鐘數", { exact: true })).toHaveValue("25");
  await dialog.getByRole("button", { name: /儲存紀錄/ }).click();
  saved = await readData(page);
  expect(saved.workouts).toHaveLength(6);
  for (const original of fixtureData.workouts)
    expect(saved.workouts.find((w) => w.id === original.id)).toEqual(original);
  expect(new Set(saved.workouts.map((w) => w.id)).size).toBe(6);
  await expectNoOverflow(page);
});

test("健康表單欄位字級與寬度適合手機，零步可儲存", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "健康趨勢", exact: true }).click();
  await page.getByRole("button", { name: "新增健康數據", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "記錄健康數據" });
  const date = dialog.getByLabel("日期", { exact: true });
  await expect(date).toHaveValue(TODAY);
  expect(
    await date.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  const bounds = (await date.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  await dialog.getByLabel("體重（kg）", { exact: true }).fill("62");
  await dialog.getByLabel("每日步數", { exact: true }).fill("0");
  await dialog.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(dialog).toHaveCount(0);
  const data = await readData(page);
  expect(data.metrics).toHaveLength(90);
  expect(data.metrics.find((metric) => metric.date === TODAY)).toMatchObject({
    weight: 62,
    steps: 0,
  });
  await expectNoOverflow(page);
});

test("JSON 備份可下載及還原，取消與壞檔保留原資料", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "設定與備份", exact: true }).click();
  const downloadReady = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "匯出 JSON 備份", exact: true })
    .click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe(`日常動作-${TODAY}.json`);
  const path = (await download.path())!;
  const exported = JSON.parse(await readFile(path, "utf8"));
  expect(exported.workouts).toEqual(fixtureData.workouts);
  expect(exported.metrics).toEqual(fixtureData.metrics);
  let accept = false,
    confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
  const input = page.getByLabel("還原 JSON 備份", { exact: true });
  await input.setInputFiles({
    name: "fictional-invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("invalid-json"),
  });
  await expect(page.getByText(/無法還原：/)).toBeVisible();
  expect(confirmations).toBe(0);
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await input.setInputFiles(path);
  await expect.poll(() => confirmations).toBe(1);
  await expect(input).toBeEnabled();
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("虛構備份之後的新紀錄");
  await dialog.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(dialog).toHaveCount(0);
  expect((await readData(page)).workouts).toHaveLength(5);
  accept = true;
  await input.setInputFiles(path);
  await expect(page.getByText("已成功還原資料", { exact: true })).toBeVisible();
  expect(confirmations).toBe(2);
  expect((await readData(page)).workouts).toEqual(exported.workouts);
  expect((await readData(page)).metrics).toEqual(exported.metrics);
  await expectNoOverflow(page);
});

test("本機內容損壞可先另存原始檔案，再用有效備份修復並繼續記錄", async ({
  page,
}) => {
  await page.goto("./");
  const raw = "{虛構不可解讀內容 \ud800";
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw,
  });
  await page.reload();
  await page.getByRole("button", { name: "設定與備份", exact: true }).click();
  const input = page.getByLabel("選擇有效備份來修復", { exact: true });
  const choose = page.getByRole("button", {
    name: "選擇有效備份來修復",
    exact: true,
  });
  const acknowledgement = page.getByRole("checkbox", {
    name: "我已確認原始檔案保存在自己的裝置",
  });
  await expect(input).toBeDisabled();
  await expect(choose).toBeDisabled();
  await expect(acknowledgement).toBeDisabled();
  const downloadReady = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下載待修復原始檔案", exact: true })
    .click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe(
    `日常動作-待修復原始內容-${TODAY}.json`,
  );
  const path = (await download.path())!;
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
    format: "daily-movement-unreadable-local-v1",
    raw,
  });
  await acknowledgement.check();
  await expect(choose).toBeEnabled();
  expect((await choose.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(
    (await acknowledgement.locator("..").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await expectNoOverflow(page);
  let accept = false,
    confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    expect(dialog.message()).toContain("無法解讀的本機原始內容");
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
  const pickerReady = page.waitForEvent("filechooser");
  await choose.focus();
  await page.keyboard.press("Enter");
  await (await pickerReady).setFiles(path);
  await expect(page.getByText(/無法還原：/)).toBeVisible();
  expect(confirmations).toBe(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(raw);
  const backup = {
    name: "fictional-valid-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixtureData)),
  };
  await input.setInputFiles(backup);
  await expect.poll(() => confirmations).toBe(1);
  await expect(input).toBeEnabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(raw);
  accept = true;
  await input.setInputFiles(backup);
  await expect(page.getByText("已成功還原資料", { exact: true })).toBeVisible();
  expect(confirmations).toBe(2);
  expect(await readData(page)).toEqual(fixtureData);
  await expect(
    page.getByText("以備份修復本機資料", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("備註", { exact: true })
    .fill("虛構修復後新增");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /儲存紀錄/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await reloadOffline(page);
  const restored = await readData(page);
  expect(restored.workouts).toHaveLength(5);
  expect(
    restored.workouts.some((workout) => workout.note === "虛構修復後新增"),
  ).toBe(true);
  expect(restored.metrics).toEqual(fixtureData.metrics);
  await expectNoOverflow(page);
});

test("運動歷史可篩選與分批，保留全部資料並可再記一次", async ({ page }) => {
  await page.goto("./");
  const stored = {
    ...fixtureData,
    workouts: [
      ...fixtureData.workouts,
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `fictional-history-${index}`,
        date: fixtureData.metrics[index + 1].date,
        type: "yoga" as const,
        minutes: 10,
        calories: 30,
        note: `虛構歷史 Yoga ${index}${index === 29 ? " 下班伸展" : ""}`,
      })),
    ],
  };
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: STORAGE_KEY, data: stored },
  );
  await page.reload();
  await page.getByRole("button", { name: "運動紀錄", exact: true }).click();
  const history = page.getByRole("region", { name: "運動紀錄", exact: true });
  const rows = history.locator(".log-wrap");
  await expect(rows).toHaveCount(12);
  await expect(history.getByRole("status")).toContainText(
    "找到 34 筆 · 已顯示 12 筆",
  );
  const weekly = await page.locator(".week-summary").innerText();
  await history.getByRole("button", { name: "再顯示 12 筆運動" }).click();
  await expect(rows).toHaveCount(24);
  await expect(rows.nth(12).getByRole("heading")).toBeFocused();
  const search = history.getByRole("searchbox", { name: "搜尋運動紀錄" });
  await search.fill("虛構歷史 yoga");
  await expect(search).toBeFocused();
  await expect(rows).toHaveCount(12);
  await history
    .getByRole("combobox", { name: "運動種類" })
    .selectOption("yoga");
  await history.getByText("日期範圍", { exact: true }).click();
  await history.getByLabel("開始日期", { exact: true }).fill("2026-11-01");
  await history.getByLabel("結束日期", { exact: true }).fill(TODAY);
  await expect(rows).toHaveCount(6);
  await expect(history.getByText(/符合條件的全部紀錄：60 分鐘/)).toBeVisible();
  for (const field of [
    search,
    history.getByLabel("開始日期"),
    history.getByLabel("結束日期"),
  ]) {
    const bounds = (await field.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
    expect(
      await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator(".week-summary").innerText()).toBe(weekly);
  expect((await readData(page)).workouts).toEqual(stored.workouts);
  await search.fill("完全不存在的虛構關鍵字");
  await expect(rows).toHaveCount(0);
  await expect(history.getByText(/沒有符合條件的紀錄/)).toBeVisible();
  await history.getByRole("button", { name: "清除篩選" }).click();
  await expect(rows).toHaveCount(12);
  await search.fill("下班伸展");
  await expect(rows).toHaveCount(1);
  await rows.getByRole("button", { name: /再記一次/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("日期", { exact: true })).toHaveValue(TODAY);
  await expect(dialog.getByLabel("分鐘數", { exact: true })).toHaveValue("10");
  await dialog.getByRole("button", { name: "關閉", exact: true }).click();
  expect((await readData(page)).workouts).toEqual(stored.workouts);
  await expectNoOverflow(page);
  await reloadOffline(page);
  await page.getByRole("button", { name: "運動紀錄", exact: true }).click();
  await expect(history.getByRole("searchbox")).toHaveValue("");
  await expect(rows).toHaveCount(12);
  await history.getByRole("searchbox").fill("虛構歷史");
  await expect(history.getByRole("status")).toContainText("找到 30 筆");
  expect((await readData(page)).workouts).toEqual(stored.workouts);
  await expectNoOverflow(page);
});

test("本機舊分頁不覆蓋新紀錄，關閉草稿後可重新讀取並繼續記錄", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  const draft = page.getByRole("dialog");
  await draft.getByLabel("備註", { exact: true }).fill("虛構 A 未儲存草稿");
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date(`${TODAY}T04:00:00Z`));
  await other.goto("http://127.0.0.1:4173/fitness-pwa/");
  await other.getByRole("button", { name: "記錄運動", exact: true }).click();
  const otherForm = other.getByRole("dialog");
  await otherForm.getByLabel("備註", { exact: true }).fill("虛構 B 已儲存紀錄");
  await otherForm.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(otherForm).toHaveCount(0);
  expect(
    (await readData(page)).workouts.some((w) => w.note === "虛構 B 已儲存紀錄"),
  ).toBe(true);
  await expect(draft.getByRole("button", { name: /儲存紀錄/ })).toBeDisabled();
  await expect(draft.getByLabel("備註", { exact: true })).toHaveValue(
    "虛構 A 未儲存草稿",
  );
  const refresh = page.getByRole("button", {
    name: "重新讀取本機資料",
    exact: true,
  });
  await expect(refresh).toBeDisabled();
  await expectNoOverflow(page);
  expect(
    (await readData(page)).workouts.some((w) => w.note === "虛構 B 已儲存紀錄"),
  ).toBe(true);
  await draft.getByRole("button", { name: "關閉", exact: true }).click();
  await refresh.click();
  await expect(page.getByText("本機資料已變更", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("虛構 B 已儲存紀錄", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("備註", { exact: true })
    .fill("虛構 A 重新記錄");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /儲存紀錄/ })
    .click();
  const stored = await readData(page);
  expect(stored.workouts).toHaveLength(6);
  expect(stored.workouts.some((w) => w.note === "虛構 B 已儲存紀錄")).toBe(
    true,
  );
  expect(stored.workouts.some((w) => w.note === "虛構 A 重新記錄")).toBe(true);
  for (const source of fixtureData.workouts)
    expect(stored.workouts.find((w) => w.id === source.id)).toEqual(source);
  await expectNoOverflow(page);
});
