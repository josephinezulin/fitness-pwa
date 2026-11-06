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
