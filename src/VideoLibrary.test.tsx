// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoLibrary } from "./VideoLibrary";
import { storeLibrary } from "./videos";
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
  category: "瑜伽",
  minutes: 20,
};
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
