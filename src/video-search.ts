import { parseYouTubeId, type Video } from "./videos";

export const VIDEO_LENGTHS = [
  { value: "all", label: "不限長度" },
  { value: "10", label: "10 分鐘內" },
  { value: "20", label: "20 分鐘內" },
  { value: "30", label: "30 分鐘內" },
  { value: "unknown", label: "未標示長度" },
] as const;
export type VideoLength = (typeof VIDEO_LENGTHS)[number]["value"];
const normalize = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("zh-TW");

/** Local filtering only: retain original order, objects and ownership metadata. */
export function searchVideos(
  videos: readonly Video[],
  query: string,
  length: VideoLength,
): Video[] {
  const clean = query.normalize("NFKC").trim();
  const youtubeId = parseYouTubeId(clean);
  const url = youtubeId && /^https?:\/\//i.test(clean);
  const words = normalize(clean).split(/\s+/).filter(Boolean);
  return videos.filter((video) => {
    if (
      length === "unknown"
        ? video.minutes !== undefined
        : length !== "all" &&
          (video.minutes === undefined || video.minutes > Number(length))
    )
      return false;
    if (youtubeId && video.youtubeId === youtubeId) return true;
    if (url) return false;
    const text = normalize(
      `${video.title} ${video.category} ${video.minutes === undefined ? "未標示長度" : `${video.minutes} 分鐘`}`,
    );
    return words.every((word) => text.includes(word));
  });
}
