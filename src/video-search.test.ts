import { expect, it } from "vitest";
import { searchVideos } from "./video-search";
import type { Video } from "./videos";

const videos: Video[] = [
  {
    id: "fixture-one",
    youtubeId: "Aa000000001",
    title: "YOGA 初學者 [低衝擊]",
    category: "瑜伽",
    minutes: 10,
    fromSheet: true,
    sheetRecordId: "fixture-source",
  },
  {
    id: "fixture-two",
    youtubeId: "bb000000002",
    title: "Yoga 臀腿訓練",
    category: "居家徒手",
    minutes: 20,
  },
  {
    id: "fixture-three",
    youtubeId: "cc000000003",
    title: "Beginner123 伸展",
    category: "伸展放鬆",
    minutes: 30,
  },
  {
    id: "fixture-four",
    youtubeId: "dd000000004",
    title: "虛構晨間練習",
    category: "瑜伽",
  },
  {
    id: "fixture-five",
    youtubeId: "ee000000005",
    title: "虛構長課",
    category: "瑜伽",
    minutes: 31,
  },
];
it("normalizes full-width, case and whitespace while requiring all literal search words", () => {
  const rows = searchVideos(videos, "  ＹＯＧＡ　初學者 [低衝擊]  ", "all");
  expect(rows).toEqual([videos[0]]);
  expect(searchVideos(videos, "yoga 不存在", "all")).toEqual([]);
  expect(searchVideos(videos, "瑜伽 10", "all")).toEqual([videos[0]]);
  expect(searchVideos(videos, ".*", "all")).toEqual([]);
});
it("recognizes a YouTube link or exact case-sensitive ID without confusing an eleven-character title word", () => {
  expect(
    searchVideos(videos, "https://youtu.be/Aa000000001?t=10", "all"),
  ).toEqual([videos[0]]);
  expect(
    searchVideos(
      videos,
      "https://www.youtube.com/watch?v=Aa000000001&list=fictional",
      "all",
    ),
  ).toEqual([videos[0]]);
  expect(searchVideos(videos, "Aa000000001", "all")).toEqual([videos[0]]);
  expect(searchVideos(videos, "aa000000001", "all")).toEqual([]);
  expect(searchVideos(videos, "Beginner123", "all")).toEqual([videos[2]]);
});
it.each([
  ["all", [0, 1, 2, 3, 4]],
  ["10", [0]],
  ["20", [0, 1]],
  ["30", [0, 1, 2]],
  ["unknown", [3]],
] as const)(
  "applies the %s duration boundary without treating missing length as zero",
  (length, indexes) => {
    expect(searchVideos(videos, "", length)).toEqual(
      indexes.map((index) => videos[index]),
    );
  },
);
it("retains input order, references and ownership metadata without changing the catalog", () => {
  const before = structuredClone(videos);
  const result = searchVideos(videos, "   ", "all");
  expect(result).toEqual(videos);
  expect(result).not.toBe(videos);
  expect(result[0]).toBe(videos[0]);
  expect(result[0].sheetRecordId).toBe("fixture-source");
  expect(videos).toEqual(before);
  expect(searchVideos(videos, "https://youtu.be/dd000000004", "10")).toEqual(
    [],
  );
});
