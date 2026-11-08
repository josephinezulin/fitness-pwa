// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoLibrary } from "./VideoLibrary";
import {
  BUILT_IN_VIDEOS,
  storeLibrary,
  VIDEO_KEY,
  type VideoLibrary as Library,
} from "./videos";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("confirm", () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const video = {
  id: "cloud-video-1",
  youtubeId: "v7AYKMP6rOE",
  title: "雲端自己的影片",
  category: "瑜伽" as const,
  minutes: 20,
};
const hideBuiltIns = () =>
  storeLibrary(localStorage, {
    version: 1,
    custom: [],
    hidden: BUILT_IN_VIDEOS.map((video) => video.id),
  });
const catalog = () =>
  Array.from({ length: 25 }, (_, index) => ({
    ...video,
    id: `fixture-${index}`,
    youtubeId: `F${String(index).padStart(10, "0")}`,
    title: `虛構影片 ${index + 1}`,
  }));
const search = () => screen.getByRole("searchbox", { name: "搜尋運動影片" });
const length = () => screen.getByRole("combobox", { name: "影片長度" });

it("edits a local custom video in place and can clear its optional duration", () => {
  storeLibrary(localStorage, { version: 1, custom: [video], hidden: [] });
  render(<VideoLibrary online={false} />);
  fireEvent.click(
    screen.getByRole("button", { name: `編輯影片：${video.title}` }),
  );
  expect(screen.getByRole("textbox", { name: "YouTube 網址" })).toHaveProperty(
    "value",
    `https://www.youtube.com/watch?v=${video.youtubeId}`,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
    target: { value: "虛構編輯後影片" },
  });
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "長度（分鐘，選填）" }),
    { target: { value: "" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "儲存影片" }));
  const saved = JSON.parse(localStorage.getItem(VIDEO_KEY)!);
  expect(saved.custom).toEqual([
    {
      id: video.id,
      youtubeId: video.youtubeId,
      title: "虛構編輯後影片",
      category: video.category,
    },
  ]);
  expect(screen.getByRole("heading", { name: "虛構編輯後影片" })).toBeTruthy();
});

it("cancels local edits without writes and never offers built-in editing", () => {
  storeLibrary(localStorage, { version: 1, custom: [video], hidden: [] });
  const raw = localStorage.getItem(VIDEO_KEY);
  render(<VideoLibrary online />);
  expect(screen.getAllByRole("button", { name: /^編輯影片：/ })).toHaveLength(
    1,
  );
  fireEvent.click(
    screen.getByRole("button", { name: `編輯影片：${video.title}` }),
  );
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "YouTube 網址" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
    target: { value: "未儲存修改" },
  });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(localStorage.getItem(VIDEO_KEY)).toBe(raw);
});

it("shows and focuses an edited local video outside the first batch without reordering records", () => {
  const custom = catalog();
  storeLibrary(localStorage, {
    version: 1,
    custom,
    hidden: BUILT_IN_VIDEOS.map((v) => v.id),
  });
  render(<VideoLibrary online />);
  fireEvent.change(search(), { target: { value: custom[0].youtubeId } });
  fireEvent.click(
    screen.getByRole("button", { name: `編輯影片：${custom[0].title}` }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
    target: { value: "虛構更新最舊影片" },
  });
  fireEvent.click(screen.getByRole("button", { name: "儲存影片" }));
  expect(screen.getAllByRole("article")).toHaveLength(25);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "虛構更新最舊影片" }),
  );
  const saved = JSON.parse(localStorage.getItem(VIDEO_KEY)!);
  expect(saved.custom.map((v: { id: string }) => v.id)).toEqual(
    custom.map((v) => v.id),
  );
});

it("keeps a failed or stale local edit draft without replacing data or changing the current player", () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 0),
  );
  storeLibrary(localStorage, { version: 1, custom: [video], hidden: [] });
  render(<VideoLibrary online />);
  fireEvent.click(screen.getByRole("button", { name: `播放：${video.title}` }));
  const frame = screen.getByTitle(video.title);
  fireEvent.click(
    screen.getByRole("button", { name: `編輯影片：${video.title}` }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube 網址" }), {
    target: { value: "invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "儲存影片" }));
  expect(screen.getByText(/無法辨識 YouTube/)).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube 網址" }), {
    target: { value: video.youtubeId },
  });
  const other = {
    version: 1 as const,
    custom: [video, { ...video, id: "other", youtubeId: "N0000000001" }],
    hidden: [],
  };
  storeLibrary(localStorage, other);
  const raw = localStorage.getItem(VIDEO_KEY);
  fireEvent.click(screen.getByRole("button", { name: "儲存影片" }));
  expect(localStorage.getItem(VIDEO_KEY)).toBe(raw);
  expect(screen.getByRole("button", { name: "儲存影片" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByTitle(video.title)).toBe(frame);
});

const fillLocalDraft = () => {
  fireEvent.click(screen.getByRole("button", { name: "新增影片" }));
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube 網址" }), {
    target: { value: "https://youtu.be/local000001" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
    target: { value: "虛構 A 頁草稿" },
  });
};

it("refuses a stale local video save before any storage event can arrive", () => {
  render(<VideoLibrary online />);
  fillLocalDraft();
  const other: Library = { version: 1, custom: [video], hidden: [] };
  storeLibrary(localStorage, other);
  const raw = localStorage.getItem(VIDEO_KEY);
  fireEvent.click(screen.getByRole("button", { name: "加入影片庫" }));
  expect(localStorage.getItem(VIDEO_KEY)).toBe(raw);
  expect(screen.getByRole("textbox", { name: "名稱" })).toHaveProperty(
    "value",
    "虛構 A 頁草稿",
  );
  expect(screen.getByText(/影片清單已在其他分頁變更/)).toBeTruthy();
});

it("does not overwrite an unreadable video library with the empty fallback", () => {
  localStorage.setItem(VIDEO_KEY, "{fictional-invalid");
  render(<VideoLibrary online />);
  expect(screen.getByRole("button", { name: "新增影片" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(localStorage.getItem(VIDEO_KEY)).toBe("{fictional-invalid");
  expect(screen.getByText(/無法讀取影片清單/)).toBeTruthy();
});

it("keeps the draft, filters and player until explicit reload, with local mutations blocked", () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 0),
  );
  storeLibrary(localStorage, { version: 1, custom: [video], hidden: [] });
  render(<VideoLibrary online />);
  fireEvent.click(screen.getByRole("button", { name: `播放：${video.title}` }));
  const frame = screen.getByTitle(video.title);
  fireEvent.change(search(), { target: { value: "影片" } });
  fillLocalDraft();
  storeLibrary(localStorage, {
    version: 1,
    custom: [{ ...video, title: "另一頁影片" }],
    hidden: [],
  });
  fireEvent(
    window,
    new StorageEvent("storage", { key: VIDEO_KEY, storageArea: localStorage }),
  );
  const reload = screen.getByRole("button", { name: "重新讀取影片清單" });
  expect(reload).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "加入影片庫" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("textbox", { name: "名稱" })).toHaveProperty(
    "value",
    "虛構 A 頁草稿",
  );
  expect(screen.getByTitle(video.title)).toBe(frame);
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(reload).toHaveProperty("disabled", false);
  fireEvent.click(reload);
  expect(screen.getByRole("heading", { name: "另一頁影片" })).toBeTruthy();
  expect(search()).toHaveProperty("value", "影片");
  expect(screen.getByTitle(video.title)).toBe(frame);
  expect(screen.getByRole("button", { name: "新增影片" })).toHaveProperty(
    "disabled",
    false,
  );
});

it("checks local removal immediately rather than erasing another page's new video", () => {
  storeLibrary(localStorage, { version: 1, custom: [video], hidden: [] });
  render(<VideoLibrary online />);
  storeLibrary(localStorage, {
    version: 1,
    custom: [
      video,
      {
        ...video,
        id: "fictional-b",
        youtubeId: "b0000000001",
        title: "B 影片",
      },
    ],
    hidden: [],
  });
  const raw = localStorage.getItem(VIDEO_KEY);
  fireEvent.click(
    screen.getByRole("button", { name: `從清單移除：${video.title}` }),
  );
  expect(localStorage.getItem(VIDEO_KEY)).toBe(raw);
  expect(screen.getByRole("heading", { name: video.title })).toBeTruthy();
});

it("leaves cloud save and delete callbacks usable when local video storage is blocked", () => {
  const save = vi.fn(() => true),
    remove = vi.fn(() => true);
  localStorage.setItem(VIDEO_KEY, "{fictional-invalid");
  render(
    <VideoLibrary
      online
      cloud
      canEditCloud
      sheetVideos={[video]}
      onSaveVideo={save}
      onDeleteVideo={remove}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: `編輯影片：${video.title}` }),
  );
  fireEvent.click(screen.getByRole("button", { name: "儲存影片" }));
  expect(save).toHaveBeenCalledWith(video);
  fireEvent.click(
    screen.getByRole("button", { name: `從清單移除：${video.title}` }),
  );
  expect(remove).toHaveBeenCalledWith(video.id);
  expect(localStorage.getItem(VIDEO_KEY)).toBe("{fictional-invalid");
});

it("reads the full catalog in batches and focuses the first newly revealed title", () => {
  hideBuiltIns();
  const videos = catalog();
  const raw = JSON.stringify(localStorage);
  render(<VideoLibrary online sheetVideos={videos} cloud />);
  expect(screen.getAllByRole("article")).toHaveLength(12);
  expect(screen.getByRole("status").textContent).toMatch(/12\s*／\s*25/);
  fireEvent.click(screen.getByRole("button", { name: "再顯示 12 部影片" }));
  expect(screen.getAllByRole("article")).toHaveLength(24);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "虛構影片 13" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "再顯示 1 部影片" }));
  expect(screen.getAllByRole("article")).toHaveLength(25);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "虛構影片 25" }),
  );
  expect(JSON.stringify(localStorage)).toBe(raw);
  fireEvent.change(search(), { target: { value: "虛構" } });
  expect(screen.getAllByRole("article")).toHaveLength(12);
});

it("combines category, query, duration and favorites without modifying any stored data", () => {
  hideBuiltIns();
  const videos = [
    {
      ...video,
      id: "first",
      youtubeId: "a0000000001",
      title: "YOGA 低衝擊",
      minutes: 10,
    },
    {
      ...video,
      id: "second",
      youtubeId: "b0000000002",
      title: "Yoga 進階",
      minutes: 30,
    },
    {
      ...video,
      id: "third",
      youtubeId: "c0000000003",
      title: "Yoga 居家",
      category: "居家徒手",
      minutes: 10,
    },
  ];
  const raw = JSON.stringify(localStorage);
  const toggle = vi.fn(() => true);
  render(
    <VideoLibrary
      online={false}
      cloud
      sheetVideos={videos}
      onToggleFavorite={toggle}
      preferences={{
        version: 1,
        weeklyGoal: 150,
        favorites: [videos[1].youtubeId],
        seen: {},
      }}
    />,
  );
  fireEvent.change(search(), { target: { value: "ＹＯＧＡ" } });
  fireEvent.click(screen.getByRole("tab", { name: /^瑜伽/ }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
  fireEvent.change(length(), { target: { value: "20" } });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: videos[0].title })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "只看我的收藏" }));
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  fireEvent.change(length(), { target: { value: "all" } });
  expect(screen.getByRole("heading", { name: videos[1].title })).toBeTruthy();
  expect(toggle).not.toHaveBeenCalled();
  expect(JSON.stringify(localStorage)).toBe(raw);
});

it("keeps an empty selected category available and clears all filters back to the search field", () => {
  hideBuiltIns();
  render(
    <VideoLibrary online cloud sheetVideos={[video]} initialCategory="瑜伽" />,
  );
  fireEvent.change(search(), { target: { value: "不存在" } });
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  const category = screen.getByRole("tab", { name: /^瑜伽/ });
  expect(category.getAttribute("aria-selected")).toBe("true");
  expect(category.textContent).toContain("0");
  fireEvent.click(screen.getByRole("button", { name: "清除影片篩選" }));
  expect((search() as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(search());
  expect(screen.getAllByRole("article")).toHaveLength(1);
});

it("retains the iframe and explicit watch state while search hides the playing video", () => {
  hideBuiltIns();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 0),
  );
  const seen = vi.fn(() => true),
    record = vi.fn();
  render(
    <VideoLibrary
      online
      cloud
      sheetVideos={[video]}
      canRecord
      onRecord={record}
      onMarkSeen={seen}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: `播放：${video.title}` }));
  const iframe = screen.getByTitle(video.title);
  fireEvent.click(screen.getByRole("button", { name: "看過一次" }));
  fireEvent.change(search(), { target: { value: "不存在" } });
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect(screen.getByTitle(video.title)).toBe(iframe);
  expect(seen).toHaveBeenCalledTimes(1);
  expect(record).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "完成，記錄這次運動" }));
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      sheetRecordId: video.id,
      youtubeId: video.youtubeId,
    }),
    false,
  );
});

it("keeps the current batch during data refresh but resets it for a new requested category", () => {
  hideBuiltIns();
  const videos = catalog();
  const { rerender } = render(
    <VideoLibrary online cloud sheetVideos={videos} />,
  );
  fireEvent.change(search(), { target: { value: "虛構" } });
  fireEvent.click(screen.getByRole("button", { name: "再顯示 12 部影片" }));
  rerender(
    <VideoLibrary
      online
      cloud
      sheetVideos={[
        ...videos,
        { ...video, id: "new", youtubeId: "N0000000001", title: "虛構更新" },
      ]}
    />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(24);
  expect((search() as HTMLInputElement).value).toBe("虛構");
  rerender(
    <VideoLibrary online cloud sheetVideos={videos} initialCategory="瑜伽" />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(12);
});

it("retains an add-video draft during search and reveals a successfully saved video", () => {
  hideBuiltIns();
  render(<VideoLibrary online={false} />);
  fireEvent.click(screen.getByRole("button", { name: "新增影片" }));
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube 網址" }), {
    target: { value: "https://youtu.be/new00000001" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
    target: { value: "虛構新增影片" },
  });
  fireEvent.change(search(), { target: { value: "找不到的片名" } });
  fireEvent.change(length(), { target: { value: "unknown" } });
  expect(
    (screen.getByRole("textbox", { name: "名稱" }) as HTMLInputElement).value,
  ).toBe("虛構新增影片");
  fireEvent.click(screen.getByRole("button", { name: "加入影片庫" }));
  expect(screen.getByRole("heading", { name: "虛構新增影片" })).toBeTruthy();
  expect((search() as HTMLInputElement).value).toBe("");
  expect((length() as HTMLSelectElement).value).toBe("all");
});
it("finds a video by title without enabling cloud edits or changing the stored library", () => {
  storeLibrary(localStorage, {
    version: 1,
    custom: [],
    hidden: BUILT_IN_VIDEOS.map((video) => video.id),
  });
  const before = JSON.stringify(localStorage);
  render(
    <VideoLibrary
      online={false}
      cloud
      sheetVideos={[
        video,
        {
          ...video,
          id: "fictional-other",
          youtubeId: "aaaaaaaaaaa",
          title: "虛構居家訓練",
        },
      ]}
    />,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "搜尋運動影片" }), {
    target: { value: "自己的" },
  });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: video.title })).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: `編輯影片：${video.title}`,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(JSON.stringify(localStorage)).toBe(before);
});
describe("cloud video ownership", () => {
  it("keeps another local library out of the cloud account view", () => {
    storeLibrary(localStorage, {
      version: 1,
      hidden: [],
      custom: [
        {
          id: "local1",
          youtubeId: "aaaaaaaaaaa",
          title: "本機私有影片",
          category: "其他",
        },
      ],
    });
    render(<VideoLibrary online cloud canEditCloud sheetVideos={[video]} />);
    expect(screen.queryByText("本機私有影片")).toBeNull();
    expect(screen.getByText("雲端自己的影片")).toBeTruthy();
  });
  it("edits a sheet video through the cloud callback without writing the local library", () => {
    const save = vi.fn(() => true);
    render(
      <VideoLibrary
        online
        cloud
        canEditCloud
        sheetVideos={[video]}
        onSaveVideo={save}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "編輯影片：雲端自己的影片" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "名稱" }), {
      target: { value: "更新名稱" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存影片" }));
    expect(save).toHaveBeenCalledWith({ ...video, title: "更新名稱" });
    expect(localStorage.length).toBe(0);
  });
  it("deletes only through the cloud callback and blocks editing in a follower tab", () => {
    const remove = vi.fn(() => true);
    const { rerender } = render(
      <VideoLibrary
        online
        cloud
        canEditCloud
        sheetVideos={[video]}
        onDeleteVideo={remove}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "從清單移除：雲端自己的影片" }),
    );
    expect(remove).toHaveBeenCalledWith(video.id);
    rerender(
      <VideoLibrary
        online
        cloud
        canEditCloud={false}
        sheetVideos={[video]}
        onDeleteVideo={remove}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "編輯影片：雲端自己的影片",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

it("filters favorites by YouTube ID and requires an explicit action before recording or counting a watch", () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 0),
  );
  const toggle = vi.fn(() => true),
    seen = vi.fn(() => true),
    record = vi.fn();
  render(
    <VideoLibrary
      online
      cloud
      canEditCloud
      canRecord
      sheetVideos={[video]}
      preferences={{
        version: 1,
        weeklyGoal: 150,
        favorites: [video.youtubeId],
        seen: { [video.youtubeId]: 2 },
      }}
      onToggleFavorite={toggle}
      onMarkSeen={seen}
      onRecord={record}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "只看我的收藏" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  const favorite = screen.getByRole("button", {
    name: "收藏影片：雲端自己的影片",
  });
  expect(favorite.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(favorite);
  expect(toggle).toHaveBeenCalledWith(video.youtubeId);
  fireEvent.click(screen.getByRole("button", { name: "播放：雲端自己的影片" }));
  expect(record).not.toHaveBeenCalled();
  expect(seen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "完成，記錄這次運動" }));
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      youtubeId: video.youtubeId,
      minutes: 20,
      category: "瑜伽",
    }),
    true,
  );
  expect(seen).not.toHaveBeenCalled();
  expect(screen.queryByTitle(video.title)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "播放：雲端自己的影片" }));
  fireEvent.click(screen.getByRole("button", { name: /看過一次/ }));
  fireEvent.click(screen.getByRole("button", { name: "完成，記錄這次運動" }));
  expect(seen).toHaveBeenCalledTimes(1);
  expect(record.mock.calls[1][1]).toBe(false);
});
