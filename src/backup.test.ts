import { describe, expect, it } from "vitest";
import { makeBackup, parseBackup } from "./backup";
import { emptyLibrary } from "./videos";
const video = {
  id: "v1",
  youtubeId: "v7AYKMP6rOE",
  title: "我的影片",
  category: "瑜伽" as const,
  minutes: 20,
};
const data = {
  version: 1 as const,
  workouts: [],
  metrics: [],
  videos: [video],
};
describe("JSON backup compatibility", () => {
  it("round trips both cloud videos and the device video library", () => {
    const library = { ...emptyLibrary, custom: [video] };
    const result = parseBackup(
      JSON.parse(JSON.stringify(makeBackup(data, library))),
    );
    expect(result.data.videos).toEqual([video]);
    expect(result.library?.custom).toEqual([video]);
  });
  it("restores earlier exports which placed the device library in videos", () => {
    const result = parseBackup({
      version: 1,
      workouts: [],
      metrics: [],
      videos: { ...emptyLibrary, custom: [video] },
    });
    expect(result.data.videos).toBeUndefined();
    expect(result.library?.custom).toEqual([video]);
  });
  it("rejects a malformed library rather than silently losing its contents", () => {
    expect(() =>
      parseBackup({ ...data, videoLibrary: { version: 1, custom: "bad" } }),
    ).toThrow();
  });
});
