// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { TodayCard, suggestVideo } from "./HomeCards";
import {
  BUILT_IN_VIDEOS,
  storeLibrary,
  VIDEO_KEY,
  type Video,
} from "../videos";
const local: Video = {
  id: "fictional-home-local",
  youtubeId: "aaaaaaaaaaa",
  title: "虛構自訂推薦",
  category: "床上運動",
  minutes: 5,
};
const sheet = {
  ...local,
  id: "fictional-sheet-home",
  youtubeId: "bbbbbbbbbbb",
  title: "虛構試算表推薦",
};
const p = {
  plans: [],
  workouts: [],
  viewToday: "2026-11-07",
  days: [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ],
  canEdit: true,
  seen: {},
  onCheck: () => {},
  onUncheck: () => {},
  onVideoDone: () => {},
};
beforeEach(() => {
  localStorage.clear();
  storeLibrary(localStorage, {
    version: 1,
    custom: [local],
    hidden: BUILT_IN_VIDEOS.map((v) => v.id),
  });
});
afterEach(cleanup);
it("suggests eligible custom videos and preserves category, duration, hidden and watched rules", () => {
  expect(suggestVideo(p.viewToday, 0, {}, ["床上運動"], [], [local])).toEqual(
    local,
  );
  expect(
    suggestVideo(p.viewToday, 0, {}, ["床上運動"], [local.id], [local]),
  ).toBeNull();
  expect(
    suggestVideo(
      p.viewToday,
      0,
      {},
      ["床上運動"],
      [],
      [{ ...local, minutes: 11 }],
    ),
  ).toBeNull();
  expect(
    suggestVideo(
      p.viewToday,
      0,
      { [local.youtubeId]: 1 },
      ["床上運動"],
      [],
      [local, sheet],
    ),
  ).toEqual(sheet);
});
it("uses this device library in local mode and excludes it from the private spreadsheet view", () => {
  const view = render(<TodayCard {...p} sheetVideos={[sheet]} />);
  expect(
    screen.getByRole("button", { name: "播放：虛構自訂推薦" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "播放：虛構試算表推薦" }),
  ).toBeNull();
  view.rerender(<TodayCard {...p} cloud sheetVideos={[sheet]} />);
  expect(
    screen.getByRole("button", { name: "播放：虛構試算表推薦" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "播放：虛構自訂推薦" }),
  ).toBeNull();
});
it("refreshes readonly candidates while retaining the video already playing until an explicit change", () => {
  render(<TodayCard {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "播放：虛構自訂推薦" }));
  const frame = screen.getByTitle(local.title);
  storeLibrary(localStorage, {
    version: 1,
    custom: [sheet],
    hidden: BUILT_IN_VIDEOS.map((v) => v.id),
  });
  const raw = localStorage.getItem(VIDEO_KEY);
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: VIDEO_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  expect(screen.getByTitle(local.title)).toBe(frame);
  expect(localStorage.getItem(VIDEO_KEY)).toBe(raw);
  fireEvent.click(screen.getByRole("button", { name: "換一個" }));
  expect(screen.queryByTitle(local.title)).toBeNull();
  expect(
    screen.getByRole("button", { name: "播放：虛構試算表推薦" }),
  ).toBeTruthy();
});
