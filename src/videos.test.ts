import { describe, it, expect } from "vitest";
import {
  BUILT_IN_VIDEOS,
  addVideo,
  editVideo,
  emptyLibrary,
  parseYouTubeId,
  removeVideo,
  validateLibrary,
  visibleVideos,
  embedUrl,
} from "./videos";

describe("影片庫", () => {
  const fixture = () => ({
    version: 1 as const,
    custom: [
      {
        id: "first",
        youtubeId: "F0000000001",
        title: "虛構第一部",
        category: "瑜伽" as const,
        minutes: 20,
      },
      {
        id: "second",
        youtubeId: "F0000000002",
        title: "虛構第二部",
        category: "瑜伽" as const,
      },
    ],
    hidden: [BUILT_IN_VIDEOS[0].id],
  });
  it("編輯保留原 ID、順序與隱藏清單，不修改來源，空白長度可清除", () => {
    const lib = fixture(),
      raw = JSON.stringify(lib);
    const next = editVideo(lib, "first", {
      url: lib.custom[0].youtubeId,
      title: " 更新名稱 ",
      category: "其他",
    });
    expect(next.custom.map((v) => v.id)).toEqual(["first", "second"]);
    expect(next.custom[0]).toEqual({
      id: "first",
      youtubeId: "F0000000001",
      title: "更新名稱",
      category: "其他",
    });
    expect(next.custom[1]).toEqual(lib.custom[1]);
    expect(next.hidden).toEqual(lib.hidden);
    expect(JSON.stringify(lib)).toBe(raw);
  });
  it("可換成合法新連結，拒絕其他自訂或未隱藏內建影片的重複連結", () => {
    const lib = fixture();
    expect(
      editVideo(lib, "first", {
        url: "https://youtu.be/N0000000001",
        title: "",
        category: "暖身",
        minutes: 1,
      }).custom[0],
    ).toMatchObject({
      id: "first",
      youtubeId: "N0000000001",
      title: "我的運動影片",
      minutes: 1,
    });
    for (const url of [lib.custom[1].youtubeId, BUILT_IN_VIDEOS[1].youtubeId])
      expect(() =>
        editVideo(lib, "first", { url, title: "重複", category: "其他" }),
      ).toThrow("已在清單");
    expect(
      editVideo(lib, "first", {
        url: BUILT_IN_VIDEOS[0].youtubeId,
        title: "已隱藏內建的個人版本",
        category: "其他",
      }).custom[0].youtubeId,
    ).toBe(BUILT_IN_VIDEOS[0].youtubeId);
  });
  it("既有同網址可改資料，不會因舊備份與內建影片重疊而拒絕", () => {
    const lib = fixture();
    lib.custom[0].youtubeId = BUILT_IN_VIDEOS[1].youtubeId;
    expect(
      editVideo(lib, "first", {
        url: lib.custom[0].youtubeId,
        title: "新名稱",
        category: "其他",
      }).custom[0].title,
    ).toBe("新名稱");
  });
  it("拒絕編輯內建或不存在的紀錄，拒絕錯誤網址與不合法長度", () => {
    const lib = fixture();
    const input = {
      url: lib.custom[0].youtubeId,
      title: "測試",
      category: "瑜伽" as const,
    };
    for (const id of ["missing", BUILT_IN_VIDEOS[0].id])
      expect(() => editVideo(lib, id, input)).toThrow("找不到");
    expect(() =>
      editVideo(lib, "first", { ...input, url: "https://example.com" }),
    ).toThrow("無法辨識");
    for (const minutes of [0, -1, 1.5, 601, NaN])
      expect(() => editVideo(lib, "first", { ...input, minutes })).toThrow(
        "格式錯誤",
      );
    expect(
      editVideo(lib, "first", { ...input, minutes: 600 }).custom[0].minutes,
    ).toBe(600);
  });
  it("解析常見 YouTube 網址格式", () => {
    const id = "v7AYKMP6rOE";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}&t=30s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      id,
    ])
      expect(parseYouTubeId(url)).toBe(id);
    for (const bad of [
      "https://example.com/watch?v=v7AYKMP6rOE",
      "https://www.youtube.com/results?search_query=yoga",
      "javascript:alert(1)",
      "not a url",
    ])
      expect(parseYouTubeId(bad)).toBeNull();
  });
  it("內建影片 ID 格式正確且不重複", () => {
    const ids = BUILT_IN_VIDEOS.map((v) => v.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[\w-]{11}$/.test(id))).toBe(true);
  });
  it("嵌入使用隱私強化網域", () =>
    expect(embedUrl("v7AYKMP6rOE")).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/v7AYKMP6rOE\?/,
    ));
  it("新增、拒絕重複、移除自訂與隱藏內建", () => {
    let lib = addVideo(
      emptyLibrary,
      {
        url: "https://youtu.be/abcdefghijk",
        title: " 核心 ",
        category: "其他",
        minutes: 15,
      },
      () => "mine",
    );
    expect(visibleVideos(lib)[0]).toMatchObject({
      id: "mine",
      title: "核心",
      minutes: 15,
    });
    expect(() =>
      addVideo(lib, { url: "abcdefghijk", title: "", category: "其他" }),
    ).toThrow("已在清單");
    expect(() =>
      addVideo(lib, {
        url: BUILT_IN_VIDEOS[0].youtubeId,
        title: "",
        category: "暖身",
      }),
    ).toThrow();
    lib = removeVideo(lib, "mine");
    expect(lib.custom).toEqual([]);
    lib = removeVideo(lib, BUILT_IN_VIDEOS[0].id);
    expect(visibleVideos(lib).length).toBe(BUILT_IN_VIDEOS.length - 1);
  });
  it("驗證備份內的影片清單", () => {
    expect(validateLibrary(JSON.parse(JSON.stringify(emptyLibrary)))).toEqual(
      emptyLibrary,
    );
    expect(() =>
      validateLibrary({
        version: 1,
        hidden: [],
        custom: [{ id: "a", youtubeId: "bad", title: "x", category: "暖身" }],
      }),
    ).toThrow();
    expect(() =>
      validateLibrary({
        version: 1,
        hidden: [],
        custom: [
          { id: "a", youtubeId: "abcdefghijk", title: "x", category: "跳舞" },
        ],
      }),
    ).toThrow();
  });
});
