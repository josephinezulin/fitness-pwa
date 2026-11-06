import { describe, it, expect } from "vitest";
import {
  BUILT_IN_VIDEOS,
  addVideo,
  emptyLibrary,
  parseYouTubeId,
  removeVideo,
  validateLibrary,
  visibleVideos,
  embedUrl,
} from "./videos";

describe("影片庫", () => {
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
