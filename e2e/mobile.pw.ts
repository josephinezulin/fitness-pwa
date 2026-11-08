import {
  test,
  expect,
  TODAY,
  ORIGIN,
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
import { BUILT_IN_VIDEOS, VIDEO_KEY } from "../src/videos";
import { preferenceKey } from "../src/preferences";
import { defaultPlans } from "../src/model";

test("長課表清單開啟編輯會定位欄位，取消與離線儲存後回到原按鈕", async ({
  page,
}) => {
  const plans = [
    ...defaultPlans,
    ...Array.from({ length: 14 }, (_, i) => ({
      ...defaultPlans[0],
      id: `fictional-paused-${i}`,
      title: `虛構停用課表 ${i + 1}`,
      active: false,
    })),
  ];
  const original = { ...fixtureData, plans };
  await page.goto("./");
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: STORAGE_KEY, data: original },
  );
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "本週課表", exact: true }).click();
  const manager = page.locator(".plan-manager");
  const opener = manager
    .getByRole("button", { name: "編輯居家徒手訓練", exact: true })
    .first();
  await opener.click();
  const name = manager.getByLabel("課表名稱", { exact: true });
  await expect(name).toBeFocused();
  const form = manager.getByRole("form", { name: "編輯課表", exact: true });
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  await expect(opener).toHaveAttribute(
    "aria-controls",
    (await form.getAttribute("id"))!,
  );
  const rect = await name.boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(0);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await expect(name).toHaveCSS("font-size", "16px");
  for (const field of [
    name,
    form.getByLabel("最少分鐘", { exact: true }),
    form.getByLabel("最多分鐘", { exact: true }),
    form.getByRole("combobox", { name: "星期", exact: true }),
    form.getByRole("combobox", { name: "運動類型", exact: true }),
  ]) {
    const box = await field.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(field).toHaveCSS("font-size", "16px");
  }
  expect(
    await name.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return (
        document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ) === node
      );
    }),
  ).toBe(true);
  for (const button of [
    opener,
    form.getByRole("button", { name: "取消編輯課表", exact: true }),
  ]) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await name.press("Tab");
  await expect(
    form.getByRole("combobox", { name: "星期", exact: true }),
  ).toBeFocused();
  await form
    .getByRole("combobox", { name: "星期", exact: true })
    .press("Shift+Tab");
  await expect(name).toBeFocused();
  await name.fill("虛構取消草稿");
  await form.getByRole("button", { name: "取消編輯課表", exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  expect(await readData(page)).toEqual(original);
  await expectNoOverflow(page);
  await opener.click();
  await expect(name).toBeFocused();
  await name.fill("虛構調整課表");
  await form.getByLabel("最少分鐘", { exact: true }).fill("22");
  await form.getByLabel("最多分鐘", { exact: true }).fill("35");
  await page.context().setOffline(true);
  await form.getByRole("button", { name: "儲存課表", exact: true }).click();
  await expect(form).toHaveCount(0);
  const updatedOpener = manager.getByRole("button", {
    name: "編輯虛構調整課表",
    exact: true,
  });
  await expect(updatedOpener).toBeFocused();
  const saved = await readData(page);
  expect(saved.plans).toContainEqual({
    ...plans[0],
    title: "虛構調整課表",
    minMinutes: 22,
    maxMinutes: 35,
  });
  expect(saved.plans!.filter((p) => p.id !== plans[0].id)).toEqual(
    plans.slice(1),
  );
  expect(saved.workouts).toEqual(original.workouts);
  expect(saved.metrics).toEqual(original.metrics);
  const add = manager.getByRole("button", { name: "新增課表", exact: true });
  await add.click();
  const newForm = manager.getByRole("form", { name: "新增課表", exact: true });
  await expect(newForm.getByLabel("課表名稱", { exact: true })).toBeFocused();
  await newForm
    .getByRole("button", { name: "取消編輯課表", exact: true })
    .click();
  await expect(add).toBeFocused();
  expect(await readData(page)).toEqual(saved);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "本週課表", exact: true }).click();
  await expect(updatedOpener).toBeVisible();
  await expect(manager.getByRole("form")).toHaveCount(0);
  expect(await readData(page)).toEqual(saved);
  await expectNoOverflow(page);
});

test("離開跑步機時帶入總分鐘並說明小數轉換，可修改後離線儲存整數紀錄", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  const form = page.getByRole("dialog");
  const type = form.getByRole("combobox", { name: "運動類型", exact: true });
  const minutes = form.getByLabel("分鐘數", { exact: true });
  await type.selectOption("walk");
  await form.getByLabel("第 1 段分鐘", { exact: true }).fill("45.5");
  await form.getByLabel("消耗熱量（kcal）", { exact: true }).fill("123");
  await form
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("虛構帶出分段時間");
  await type.selectOption("cycling");
  await expect(minutes).toHaveValue("46");
  const notice = form.getByText(
    "分段共 45.5 分鐘；未使用分段時以整數 46 分鐘記錄，可自行調整。",
    { exact: true },
  );
  await expect(notice).toBeVisible();
  await expect(minutes).toHaveAttribute(
    "aria-describedby",
    (await notice.getAttribute("id"))!,
  );
  expect(
    await minutes.evaluate(
      (node) => (node as HTMLInputElement).validity.stepMismatch,
    ),
  ).toBe(false);
  await minutes.fill("44");
  await expect(notice).toHaveCount(0);
  await type.selectOption("yoga");
  await expect(minutes).toHaveValue("44");
  await type.selectOption("walk");
  await expect(form.getByLabel("第 1 段分鐘", { exact: true })).toHaveValue(
    "45.5",
  );
  await expect(minutes).toHaveValue("45.5");
  await form.getByRole("checkbox").uncheck();
  await expect(minutes).toHaveValue("46");
  await expect(notice).toBeVisible();
  await form.getByRole("checkbox").check();
  await expect(form.getByLabel("第 1 段分鐘", { exact: true })).toHaveValue(
    "45.5",
  );
  await form.getByRole("checkbox").uncheck();
  await expect(minutes).toHaveValue("46");
  await expect(
    form.getByLabel("消耗熱量（kcal）", { exact: true }),
  ).toHaveValue("123");
  await expect(form.getByLabel("日期", { exact: true })).toHaveValue(TODAY);
  expect(await readData(page)).toEqual(fixtureData);
  await expectNoOverflow(page);
  await page.context().setOffline(true);
  await form.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(form).toHaveCount(0);
  const saved = await readData(page);
  const fresh = saved.workouts.find(
    (row) => !fixtureData.workouts.some((old) => old.id === row.id),
  )!;
  expect(fresh).toMatchObject({
    type: "walk",
    minutes: 46,
    calories: 123,
    date: TODAY,
    note: "虛構帶出分段時間",
  });
  expect(fresh).not.toHaveProperty("segments");
  expect(saved.workouts).toHaveLength(fixtureData.workouts.length + 1);
  expect(saved.workouts.filter((row) => row.id !== fresh.id)).toEqual(
    fixtureData.workouts,
  );
  expect(saved.metrics).toEqual(fixtureData.metrics);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "運動紀錄", exact: true }).click();
  await workoutRow(page, fresh.note)
    .getByRole("button", { name: "編輯運動", exact: true })
    .click();
  await expect(minutes).toHaveValue("46");
  await expect(form.getByRole("checkbox")).not.toBeChecked();
  await form.getByRole("button", { name: "關閉", exact: true }).click();
  expect(await readData(page)).toEqual(saved);
  await expectNoOverflow(page);
});

test("跑步機分段在切換類型與模式時保留，取消不寫入，離線儲存與重開仍完整", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const source = workoutRow(page, sourceWorkout.note);
  await source.getByRole("button", { name: /再記一次/ }).click();
  const form = page.getByRole("dialog");
  const type = form.getByRole("combobox", { name: "運動類型", exact: true });
  const count = () => form.getByRole("spinbutton", { name: /^第 \d+ 段分鐘$/ });
  await type.selectOption("run");
  await expect(count()).toHaveCount(2);
  await expect(form.getByLabel("第 2 段坡度", { exact: true })).toHaveValue(
    "3",
  );
  await form.getByLabel("第 1 段分鐘", { exact: true }).fill("12.5");
  await form.getByLabel("第 2 段分鐘", { exact: true }).fill("17.5");
  await form.getByLabel("第 1 段速度", { exact: true }).fill("");
  await form.getByLabel("消耗熱量（kcal）", { exact: true }).fill("123");
  await form
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("虛構分段切換草稿");
  await type.selectOption("cycling");
  await expect(count()).toHaveCount(0);
  await type.selectOption("walk");
  await expect(count()).toHaveCount(2);
  await expect(form.getByLabel("第 1 段速度", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("第 1 段分鐘", { exact: true })).toHaveValue(
    "12.5",
  );
  await expect(form.getByLabel("第 2 段分鐘", { exact: true })).toHaveValue(
    "17.5",
  );
  await form.getByLabel("第 1 段速度", { exact: true }).fill("8.5");
  await form.getByRole("checkbox").uncheck();
  await expect(count()).toHaveCount(0);
  await form.getByRole("checkbox").check();
  await expect(count()).toHaveCount(2);
  await expect(form.getByLabel("第 1 段速度", { exact: true })).toHaveValue(
    "8.5",
  );
  await expect(
    form.getByLabel("消耗熱量（kcal）", { exact: true }),
  ).toHaveValue("123");
  await expect(
    form.getByRole("textbox", { name: "備註", exact: true }),
  ).toHaveValue("虛構分段切換草稿");
  await expect(form.getByLabel("日期", { exact: true })).toHaveValue(TODAY);
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await expectNoOverflow(page);
  await form
    .getByRole("button", { name: "平地健走 20 分", exact: true })
    .click();
  await expect(count()).toHaveCount(3);
  await expect(form.getByLabel("分鐘數", { exact: true })).toHaveValue("20");
  await form.getByRole("button", { name: "關閉", exact: true }).click();
  expect((await readData(page)).workouts).toEqual(fixtureData.workouts);
  await source.getByRole("button", { name: /再記一次/ }).click();
  await expect(count()).toHaveCount(2);
  await expect(form.getByLabel("第 1 段分鐘", { exact: true })).toHaveValue(
    "10",
  );
  await form.getByLabel("第 1 段分鐘", { exact: true }).fill("12.5");
  await form.getByLabel("第 2 段分鐘", { exact: true }).fill("17.5");
  await form.getByLabel("第 1 段速度", { exact: true }).fill("8.5");
  await form.getByLabel("第 2 段速度", { exact: true }).fill("9");
  await type.selectOption("run");
  await expect(count()).toHaveCount(2);
  await form.getByLabel("消耗熱量（kcal）", { exact: true }).fill("123");
  await form
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("虛構切換後保留分段");
  await page.context().setOffline(true);
  await form.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(form).toHaveCount(0);
  const saved = await readData(page);
  expect(saved.workouts).toHaveLength(fixtureData.workouts.length + 1);
  const fresh = saved.workouts.find(
    (row) => !fixtureData.workouts.some((old) => old.id === row.id),
  )!;
  expect(fresh).toMatchObject({
    date: TODAY,
    type: "run",
    minutes: 30,
    calories: 123,
    note: "虛構切換後保留分段",
    segments: [
      { minutes: 12.5, speed: 8.5, incline: 0 },
      { minutes: 17.5, speed: 9, incline: 3 },
    ],
  });
  expect(saved.workouts.find((row) => row.id === sourceWorkout.id)).toEqual(
    sourceWorkout,
  );
  expect(saved.metrics).toEqual(fixtureData.metrics);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "運動紀錄", exact: true }).click();
  await workoutRow(page, fresh.note)
    .getByRole("button", { name: "編輯運動", exact: true })
    .click();
  await type.selectOption("walk");
  await expect(count()).toHaveCount(2);
  await expect(form.getByLabel("第 1 段分鐘", { exact: true })).toHaveValue(
    "12.5",
  );
  await expect(form.getByLabel("第 2 段速度", { exact: true })).toHaveValue(
    "9",
  );
  await form.getByRole("button", { name: "關閉", exact: true }).click();
  expect(await readData(page)).toEqual(saved);
  await expectNoOverflow(page);
});

test("影片分類可用原生鍵盤切換與清除，保留播放器和完整資料，離線仍可篩選", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const custom = [
    {
      id: "fictional-home",
      youtubeId: "F0000000001",
      title: "虛構徒手影片",
      category: "居家徒手",
    },
    {
      id: "fictional-yoga",
      youtubeId: "F0000000002",
      title: "虛構瑜伽影片",
      category: "瑜伽",
    },
    {
      id: "fictional-stretch",
      youtubeId: "F0000000003",
      title: "虛構伸展影片",
      category: "伸展放鬆",
    },
  ];
  await page.evaluate(
    ({ key, library }) => localStorage.setItem(key, JSON.stringify(library)),
    {
      key: VIDEO_KEY,
      library: { version: 1, custom, hidden: BUILT_IN_VIDEOS.map((v) => v.id) },
    },
  );
  const before = await page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    [VIDEO_KEY, STORAGE_KEY, preferenceKey()],
  );
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  const toast = page.getByRole("button", { name: "關閉離線通知", exact: true });
  if (await toast.isVisible()) await toast.click();
  const library = page.locator(".video-library");
  await library
    .getByRole("button", { name: "播放：虛構徒手影片", exact: true })
    .click();
  const iframe = library.locator("iframe"),
    frame = (await iframe.elementHandle())!;
  const group = library.getByRole("group", { name: "影片分類", exact: true });
  const all = group.getByRole("button", { name: /^全部/ });
  const home = group.getByRole("button", { name: /^居家徒手/ });
  const yoga = group.getByRole("button", { name: /^瑜伽/ });
  const stretch = group.getByRole("button", { name: /^伸展放鬆/ });
  const search = library.getByRole("searchbox", { name: "搜尋運動影片" });
  await search.focus();
  await page.keyboard.press("Tab");
  await expect(
    library.getByRole("combobox", { name: "影片長度" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(all).toBeFocused();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(home).toBeFocused();
  const focus = await home.evaluate((node) => ({
    outline: getComputedStyle(node).outlineStyle,
    width: parseFloat(getComputedStyle(node).outlineWidth),
    height: node.getBoundingClientRect().height,
  }));
  expect(focus.outline).toBe("solid");
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Enter");
  await expect(home).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await expect(home).toBeFocused();
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(
    library.getByRole("heading", { name: "虛構徒手影片", exact: true }).last(),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(yoga).toBeFocused();
  await page.keyboard.press("Space");
  await expect(yoga).toHaveAttribute("aria-pressed", "true");
  await expect(home).toHaveAttribute("aria-pressed", "false");
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(
    library.getByRole("heading", { name: "虛構瑜伽影片", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(stretch).toBeFocused();
  const scrolled = await group.evaluate((node) => ({
    width: node.clientWidth,
    content: node.scrollWidth,
    left: node.scrollLeft,
  }));
  if (scrolled.content > scrolled.width)
    expect(scrolled.left).toBeGreaterThan(0);
  const bounds = await stretch.evaluate((node) => ({
    button: {
      left: node.getBoundingClientRect().left,
      right: node.getBoundingClientRect().right,
    },
    group: {
      left: node.parentElement!.getBoundingClientRect().left,
      right: node.parentElement!.getBoundingClientRect().right,
    },
  }));
  expect(bounds.button.left).toBeGreaterThanOrEqual(bounds.group.left - 1);
  expect(bounds.button.right).toBeLessThanOrEqual(bounds.group.right + 1);
  await page.keyboard.press("Enter");
  await expect(stretch).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Shift+Tab");
  await expect(yoga).toBeFocused();
  await page.keyboard.press("Space");
  await expect(yoga).toHaveAttribute("aria-pressed", "true");
  expect(
    await iframe.evaluate((node, original) => node === original, frame),
  ).toBe(true);
  await library
    .getByRole("button", { name: "清除影片篩選", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(search).toBeFocused();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(library.getByRole("article")).toHaveCount(3);
  await page.context().setOffline(true);
  await yoga.focus();
  await page.keyboard.press("Enter");
  await expect(yoga).toHaveAttribute("aria-pressed", "true");
  await expect(library.getByRole("article")).toHaveCount(1);
  expect(
    await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      [VIDEO_KEY, STORAGE_KEY, preferenceKey()],
    ),
  ).toEqual(before);
  await expectNoOverflow(page);
  await page.reload();
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(library.getByRole("article")).toHaveCount(3);
  await expectNoOverflow(page);
});

test("本機自訂影片可取消或編輯，保留原 ID、排序、播放與偏好，離線和備份仍完整", async ({
  page,
}) => {
  const custom = Array.from({ length: 25 }, (_, index) => ({
    id: `fictional-edit-${index}`,
    youtubeId: `F${String(index).padStart(10, "0")}`,
    title: `虛構自訂影片 ${index + 1}`,
    category: "瑜伽",
    minutes: 20,
  }));
  const original = {
    version: 1,
    custom,
    hidden: BUILT_IN_VIDEOS.map((v) => v.id),
  };
  const preferences = {
    version: 1,
    weeklyGoal: 150,
    favorites: [custom[0].youtubeId],
    seen: { [custom[0].youtubeId]: 2 },
  };
  await page.addInitScript(
    ({ videoKey, preferencesKey, library, preferences, origin }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem(videoKey))
        localStorage.setItem(videoKey, JSON.stringify(library));
      if (!localStorage.getItem(preferencesKey))
        localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    },
    {
      videoKey: VIDEO_KEY,
      preferencesKey: preferenceKey(),
      library: original,
      preferences,
      origin: ORIGIN,
    },
  );
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    VIDEO_KEY,
  );
  const healthRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  const preferencesRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    preferenceKey(),
  );
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  const toast = page.getByRole("button", { name: "關閉離線通知", exact: true });
  if (await toast.isVisible()) await toast.click();
  const library = page.locator(".video-library");
  await library.getByRole("searchbox").fill(custom[0].youtubeId);
  await library
    .getByRole("button", { name: `播放：${custom[0].title}` })
    .click();
  const iframe = library.locator("iframe"),
    frame = (await iframe.elementHandle())!;
  const edit = library.getByRole("button", {
    name: `編輯影片：${custom[0].title}`,
  });
  expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await edit.click();
  const form = library.locator(".video-form");
  const url = form.getByRole("textbox", { name: "YouTube 網址" });
  await expect(url).toBeFocused();
  await expect(url).toHaveValue(
    `https://www.youtube.com/watch?v=${custom[0].youtubeId}`,
  );
  await form
    .getByRole("textbox", { name: "名稱", exact: true })
    .fill("虛構取消修改");
  await expectNoOverflow(page);
  await library.getByRole("button", { name: "取消", exact: true }).click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), VIDEO_KEY),
  ).toBe(raw);
  await edit.click();
  await url.fill(custom[1].youtubeId);
  await form.getByRole("button", { name: "儲存影片" }).click();
  await expect(
    library.getByText("這部影片已在清單中。", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), VIDEO_KEY),
  ).toBe(raw);
  await url.fill(custom[0].youtubeId);
  await form
    .getByRole("textbox", { name: "名稱", exact: true })
    .fill("虛構修正版影片");
  await form.getByRole("spinbutton").fill("");
  await form.getByRole("button", { name: "儲存影片" }).click();
  await expect(library.getByRole("article")).toHaveCount(25);
  await expect(
    library.getByRole("heading", { name: "虛構修正版影片", exact: true }),
  ).toBeFocused();
  let stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    VIDEO_KEY,
  );
  expect(stored.custom.map((v: { id: string }) => v.id)).toEqual(
    custom.map((v) => v.id),
  );
  expect(stored.custom[0]).toEqual({
    id: custom[0].id,
    youtubeId: custom[0].youtubeId,
    title: "虛構修正版影片",
    category: "瑜伽",
  });
  expect(stored.custom.slice(1)).toEqual(custom.slice(1));
  expect(stored.hidden).toEqual(original.hidden);
  await expect(
    library.getByRole("button", { name: "收藏影片：虛構修正版影片" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await iframe.evaluate((node, original) => node === original, frame),
  ).toBe(true);
  await library
    .getByRole("button", { name: "編輯影片：虛構修正版影片" })
    .click();
  await url.fill("https://youtu.be/N0000000001");
  await form
    .getByRole("combobox", { name: "分類", exact: true })
    .selectOption("伸展放鬆");
  await form.getByRole("spinbutton").fill("15");
  await form.getByRole("button", { name: "儲存影片" }).click();
  stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    VIDEO_KEY,
  );
  expect(stored.custom[0]).toEqual({
    id: custom[0].id,
    youtubeId: "N0000000001",
    title: "虛構修正版影片",
    category: "伸展放鬆",
    minutes: 15,
  });
  expect(stored.custom.slice(1)).toEqual(custom.slice(1));
  expect(
    await iframe.evaluate((node, original) => node === original, frame),
  ).toBe(true);
  await expect(iframe).toHaveAttribute("src", /embed\/F0000000000/);
  await expect(
    library.getByRole("button", { name: "收藏影片：虛構修正版影片" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey()),
  ).toBe(preferencesRaw);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(healthRaw);
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "設定與備份", exact: true }).click();
  const ready = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "匯出 JSON 備份", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await ready).path())!, "utf8"),
  );
  expect(backup.videoLibrary).toEqual(stored);
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  await library.getByRole("searchbox").fill("N0000000001");
  await expect(
    library.getByRole("heading", { name: "虛構修正版影片", exact: true }),
  ).toBeVisible();
  await expect(library.getByText("15 分", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      VIDEO_KEY,
    ),
  ).toEqual(stored);
  await expectNoOverflow(page);
});

test("影片庫雙分頁保留草稿與播放器，明確重新讀取後新增不覆蓋另一頁影片", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const first = {
    id: "fictional-first",
    youtubeId: "F0000000000",
    title: "虛構原有影片",
    category: "瑜伽",
    minutes: 10,
  };
  await page.evaluate(
    ({ key, library }) => localStorage.setItem(key, JSON.stringify(library)),
    {
      key: VIDEO_KEY,
      library: {
        version: 1,
        custom: [first],
        hidden: BUILT_IN_VIDEOS.map((v) => v.id),
      },
    },
  );
  const healthRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  const toast = page.getByRole("button", { name: "關閉離線通知", exact: true });
  if (await toast.isVisible()) await toast.click();
  const library = page.locator(".video-library");
  await library.getByRole("searchbox").fill("虛構");
  await library.getByRole("button", { name: `播放：${first.title}` }).click();
  const frame = (await library.locator("iframe").elementHandle())!;
  await library.getByRole("button", { name: "新增影片" }).click();
  await library
    .getByRole("textbox", { name: "YouTube 網址" })
    .fill("https://youtu.be/a0000000001");
  await library
    .getByRole("textbox", { name: "名稱", exact: true })
    .fill("虛構 A 頁草稿");
  const other = await page.context().newPage();
  const errors: string[] = [];
  other.on("pageerror", (error) => errors.push(error.message));
  try {
    await other.goto("./");
    await other.getByRole("button", { name: "運動影片", exact: true }).click();
    await other.getByRole("button", { name: "新增影片" }).click();
    await other
      .getByRole("textbox", { name: "YouTube 網址" })
      .fill("https://youtu.be/b0000000001");
    await other
      .getByRole("textbox", { name: "名稱", exact: true })
      .fill("虛構 B 頁新影片");
    await other.getByRole("button", { name: "加入影片庫" }).click();
    await expect(
      other.getByRole("heading", { name: "虛構 B 頁新影片" }),
    ).toBeVisible();
    await page.bringToFront();
    await expect(library.getByText(/影片清單已在其他分頁變更/)).toBeVisible();
    await expect(
      library.getByRole("textbox", { name: "名稱", exact: true }),
    ).toHaveValue("虛構 A 頁草稿");
    await expect(
      library.getByRole("button", { name: "加入影片庫" }),
    ).toBeDisabled();
    const reload = library.getByRole("button", { name: "重新讀取影片清單" });
    await expect(reload).toBeDisabled();
    expect(
      JSON.parse(
        (await page.evaluate((key) => localStorage.getItem(key), VIDEO_KEY))!,
      ).custom,
    ).toHaveLength(2);
    await expectNoOverflow(page);
    await library.getByRole("button", { name: "取消", exact: true }).click();
    await expect(reload).toBeEnabled();
    expect((await reload.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await reload.click();
    await expect(
      library.getByRole("heading", { name: "虛構 B 頁新影片" }),
    ).toBeVisible();
    await expect(library.getByRole("searchbox")).toHaveValue("虛構");
    expect(
      await library
        .locator("iframe")
        .evaluate((node, original) => node === original, frame),
    ).toBe(true);
    await library.getByRole("button", { name: "新增影片" }).click();
    await library
      .getByRole("textbox", { name: "YouTube 網址" })
      .fill("https://youtu.be/a0000000001");
    await library
      .getByRole("textbox", { name: "名稱", exact: true })
      .fill("虛構 A 頁新影片");
    await library.getByRole("button", { name: "加入影片庫" }).click();
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      VIDEO_KEY,
    );
    expect(stored.custom.map((v: { title: string }) => v.title)).toEqual([
      first.title,
      "虛構 B 頁新影片",
      "虛構 A 頁新影片",
    ]);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
    ).toBe(healthRaw);
    await page.context().setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "運動影片", exact: true }).click();
    await expect(library.getByRole("article")).toHaveCount(3);
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  } finally {
    await other.close();
  }
});

test("影片庫搜尋、長度與收藏可組合，分批保留播放並可離線查找與完整備份", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const custom = Array.from({ length: 25 }, (_, index) => ({
    id: `fictional-video-${index}`,
    youtubeId: `F${String(index).padStart(10, "0")}`,
    title: `虛構 YOGA 練習 ${index + 1}`,
    category: index % 2 ? "居家徒手" : "瑜伽",
    ...(index % 3 === 2 ? {} : { minutes: index % 3 === 0 ? 10 : 20 }),
  }));
  const library = {
    version: 1,
    custom,
    hidden: BUILT_IN_VIDEOS.map((video) => video.id),
  };
  const raw = JSON.stringify(library);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: VIDEO_KEY,
    raw,
  });
  const healthRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  const offlineNotice = page.getByRole("button", {
    name: "關閉離線通知",
    exact: true,
  });
  if (await offlineNotice.isVisible()) await offlineNotice.click();
  const catalog = page.locator(".video-library");
  const search = catalog.getByRole("searchbox", { name: "搜尋運動影片" });
  const length = catalog.getByRole("combobox", { name: "影片長度" });
  const rows = catalog.getByRole("article");
  await expect(rows).toHaveCount(12);
  await catalog.getByRole("button", { name: "再顯示 12 部影片" }).click();
  await expect(rows).toHaveCount(24);
  await expect(
    catalog.getByRole("heading", { name: "虛構 YOGA 練習 13", exact: true }),
  ).toBeFocused();
  await catalog.getByRole("button", { name: "再顯示 1 部影片" }).click();
  await expect(rows).toHaveCount(25);
  await search.fill("ｙｏｇａ　練習");
  await expect(rows).toHaveCount(12);
  await length.selectOption("10");
  await expect(rows).toHaveCount(9);
  await catalog.getByRole("button", { name: /^瑜伽/ }).click();
  await expect(rows).toHaveCount(5);
  const title = "虛構 YOGA 練習 25";
  await catalog.getByRole("button", { name: `收藏影片：${title}` }).click();
  const favorites = catalog.getByRole("button", {
    name: "只看我的收藏",
    exact: true,
  });
  await favorites.click();
  await expect(favorites).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveCount(1);
  await expect(
    catalog.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await catalog.getByRole("button", { name: "清除影片篩選" }).click();
  await expect(search).toBeFocused();
  await expect(rows).toHaveCount(12);
  const fields = await search.evaluate((element) => ({
    font: parseFloat(getComputedStyle(element).fontSize),
    height: element.getBoundingClientRect().height,
  }));
  expect(fields.font).toBeGreaterThanOrEqual(16);
  expect(fields.height).toBeGreaterThanOrEqual(44);
  expect((await length.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectNoOverflow(page);
  await catalog.getByRole("button", { name: `播放：${title}` }).click();
  const iframe = catalog.locator("iframe");
  const originalFrame = (await iframe.elementHandle())!;
  await expect(iframe).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/F0000000024/,
  );
  await search.fill("不存在的虛構影片");
  await expect(rows).toHaveCount(0);
  expect(
    await iframe.evaluate((node, original) => node === original, originalFrame),
  ).toBe(true);
  await catalog.getByRole("button", { name: "看過一次", exact: true }).click();
  await catalog
    .getByRole("button", { name: "完成，記錄這次運動", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await expect(
    form.getByRole("combobox", { name: "運動類型", exact: true }),
  ).toHaveValue("yoga");
  await expect(form.getByLabel("分鐘數", { exact: true })).toHaveValue("10");
  await expect(
    form.getByRole("textbox", { name: "備註", exact: true }),
  ).toHaveValue(/虛構 YOGA 練習 25/);
  await form.getByRole("button", { name: "關閉", exact: true }).click();
  await page.context().setOffline(true);
  await catalog.getByRole("button", { name: "清除影片篩選" }).click();
  await length.selectOption("unknown");
  await expect(rows).toHaveCount(8);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), VIDEO_KEY),
  ).toBe(raw);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(healthRaw);
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "設定與備份", exact: true }).click();
  const downloadReady = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "匯出 JSON 備份", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloadReady).path())!, "utf8"),
  );
  expect(backup.videoLibrary.custom).toEqual(custom);
  expect(backup.workouts).toEqual(fixtureData.workouts);
  await page.reload();
  await page.getByRole("button", { name: "運動影片", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(length).toHaveValue("all");
  await expect(rows).toHaveCount(12);
  await expectNoOverflow(page);
});

test("跨日回前景更新今日與本週統計，保留表單草稿並以新日期開新紀錄", async ({
  page,
}) => {
  await page.goto("./");
  const stored = {
    ...fixtureData,
    metrics: fixtureData.metrics.map((metric, index) =>
      index === 0 ? { ...metric, steps: 1234 } : metric,
    ),
  };
  const raw = JSON.stringify(stored);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw,
  });
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const heading = page.locator(".title-row .eyebrow");
  const steps = page
    .locator(".stat")
    .filter({ has: page.getByText("今日步數", { exact: true }) });
  const week = page
    .locator(".stat")
    .filter({ has: page.getByText("本週運動", { exact: true }) })
    .locator(".stat-value");
  await expect(heading).toContainText("11月7日");
  await expect(steps).toContainText("1,234");
  await expect(week).toHaveText(/575\s*分鐘/);
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  let form = page.getByRole("dialog");
  await form.getByLabel("備註", { exact: true }).fill("虛構跨日運動草稿");
  await form.getByLabel("分鐘數", { exact: true }).fill("31");
  await page.context().setOffline(true);
  await page.clock.setFixedTime(new Date("2026-11-08T04:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(heading).toContainText("11月8日");
  await expect(steps).not.toContainText("1,234");
  await expect(form.getByLabel("日期", { exact: true })).toHaveValue(TODAY);
  await expect(form.getByLabel("備註", { exact: true })).toHaveValue(
    "虛構跨日運動草稿",
  );
  await expect(form.getByLabel("分鐘數", { exact: true })).toHaveValue("31");
  await expectNoOverflow(page);
  await form.getByRole("button", { name: "關閉", exact: true }).click();
  const offlineNotice = page.getByRole("button", {
    name: "關閉離線通知",
    exact: true,
  });
  if (await offlineNotice.isVisible()) await offlineNotice.click();
  await page.getByRole("button", { name: "記錄健康數據", exact: true }).click();
  form = page.getByRole("dialog");
  await expect(form.getByLabel("日期", { exact: true })).toHaveValue(
    "2026-11-08",
  );
  await form.getByLabel("體重（kg）", { exact: true }).fill("60.5");
  await page.clock.setFixedTime(new Date("2026-11-09T04:00:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(heading).toContainText("11月9日");
  await expect(week).toHaveText(/0\s*分鐘/);
  await expect(week.locator("..")).toContainText("課表 0/3 完成");
  await expect(form.getByLabel("日期", { exact: true })).toHaveValue(
    "2026-11-08",
  );
  await expect(form.getByLabel("日期", { exact: true })).toHaveAttribute(
    "max",
    "2026-11-09",
  );
  await expect(form.getByLabel("體重（kg）", { exact: true })).toHaveValue(
    "60.5",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(raw);
  await expectNoOverflow(page);
  await form.getByRole("button", { name: "關閉", exact: true }).click();
  await page.getByRole("button", { name: "記錄運動", exact: true }).click();
  form = page.getByRole("dialog");
  await expect(form.getByLabel("日期", { exact: true })).toHaveValue(
    "2026-11-09",
  );
  await form.getByLabel("備註", { exact: true }).fill("虛構週一新紀錄");
  await form.getByRole("button", { name: /儲存紀錄/ }).click();
  await expect(form).toHaveCount(0);
  await expect(week).toHaveText(/30\s*分鐘/);
  await expect(week.locator("..")).toContainText("課表 1/3 完成");
  const saved = await readData(page);
  expect(saved.metrics).toEqual(stored.metrics);
  expect(saved.workouts).toHaveLength(5);
  expect(
    saved.workouts.some(
      (workout) =>
        workout.date === "2026-11-09" && workout.note === "虛構週一新紀錄",
    ),
  ).toBe(true);
  await expectNoOverflow(page);
});

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
