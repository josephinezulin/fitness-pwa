/** Tutorial video library. Not health data: kept apart from the workspace so it works in cloud read-only mode too. */
export const VIDEO_CATEGORIES = [
  "暖身",
  "居家徒手",
  "快走／跑步機",
  "跑步",
  "重量訓練",
  "瑜伽",
  "皮拉提斯",
  "伸展放鬆",
  "飛輪／騎車",
  "跳繩",
  "其他",
] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];
export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  category: VideoCategory;
  minutes?: number;
  builtIn?: boolean;
  /** UI IDs are namespaced; this is the original record ID used for cloud writes. */
  sheetRecordId?: string;
  fromSheet?: boolean;
};
export type VideoLibrary = { version: 1; custom: Video[]; hidden: string[] };
export const VIDEO_KEY = "daily-movement-videos-v1";
export const emptyLibrary: VideoLibrary = {
  version: 1,
  custom: [],
  hidden: [],
};

const v = (
  youtubeId: string,
  category: VideoCategory,
  title: string,
  minutes?: number,
): Video => ({
  id: `builtin-${youtubeId}`,
  youtubeId,
  category,
  title,
  minutes,
  builtIn: true,
});
/** Curated starter list; users can hide any of these or add their own. */
export const BUILT_IN_VIDEOS: Video[] = [
  v("jwc5D73hn88", "暖身", "5 分鐘快速暖身｜健身前暖身", 5),
  v("2cx_BwtXokE", "暖身", "5 分鐘暖身｜啟動全身關節（跑步、重訓、有氧）", 5),
  v("-fI2BPfeTHI", "暖身", "跑前暖身 5 分鐘跟著做｜降低跑後疼痛", 5),
  v("Wmnp7qSnbWE", "居家徒手", "【初階】20 分新手全身訓練｜不跳躍、不傷膝", 20),
  v("UMF-BoOd_5A", "居家徒手", "【初階】20 分鐘站立式燃脂｜無跳躍、不傷膝", 20),
  v("Z1u5wYKZ9DQ", "居家徒手", "20 分鐘居家全身徒手訓練｜無跳躍、無裝備", 20),
  v("qMBvQfmRQ1c", "居家徒手", "20 分鐘徒手臀腿訓練｜無跳躍、對膝友善", 20),
  v("GeJcn-2YBW0", "快走／跑步機", "20 分鐘居家走路運動｜低衝擊、新手友善", 20),
  v(
    "M0P64m0SXH4",
    "快走／跑步機",
    "30 分鐘跑步機快走（新手跟練，坡度 1%）",
    30,
  ),
  v("8t2rLG0RL34", "快走／跑步機", "30 分鐘跑步機上坡快走", 30),
  v("A4yoEbyy_ms", "快走／跑步機", "跑步機爬坡快走（三段爬坡至 12%）", 30),
  v("TtbrOIUYtGw", "跑步", "30 分鐘超慢跑｜180 BPM｜含暖身與伸展", 30),
  v("kXddU6wz3Qo", "跑步", "跑步機超慢跑｜180 BPM 30 分鐘", 30),
  v("HgWitrJSpHY", "跑步", "30 分鐘跑步機走跑間歇（坡度 1–9%）", 30),
  v("rfUSBVFDTnY", "重量訓練", "20 分鐘全身啞鈴訓練（全站姿）", 20),
  v("WSwPpxnfFvg", "重量訓練", "25 分鐘居家全身訓練｜可持啞鈴、膝蓋友善", 25),
  v("GY1JhB9BEkk", "重量訓練", "30 分鐘新手全身啞鈴訓練（含替代動作）", 30),
  v("v7AYKMP6rOE", "瑜伽", "Yoga For Complete Beginners｜20 分鐘新手瑜伽", 20),
  v("GnHTeHAZQhM", "瑜伽", "Morning Yoga for Beginners｜溫和晨間瑜伽", 20),
  v("v7SN-d4qXx0", "瑜伽", "Bedtime Yoga｜睡前放鬆瑜伽", 20),
  v("RtLBFh9rPmw", "皮拉提斯", "20 分鐘新手全身皮拉提斯（居家墊上）", 20),
  v("7t_jx6_9fyc", "皮拉提斯", "20 分鐘 BASI 皮拉提斯全身墊上動作", 20),
  v("4AfbzGBo8aI", "伸展放鬆", "10 分鐘全身伸展｜開髖、拉筋、提升活動度", 10),
  v("RqxODBtCfhc", "伸展放鬆", "10 分鐘打開身體｜髖關節、腿後側、下背", 10),
  v("dzhNuh2KW7Y", "伸展放鬆", "10 Min Full Body Stretch｜運動後收操", 10),
  v("jeEWXhraU90", "飛輪／騎車", "20 分鐘新手飛輪課", 20),
  v("1l0HduR1G7M", "飛輪／騎車", "Beginner Rhythm Ride｜飛輪基本姿勢", 20),
  v("JuNh_yb-DiI", "跳繩", "10 分鐘新手跳繩跟練", 10),
  v("s7cz9AMmR7A", "跳繩", "10 分鐘新手跳繩（無繩也可做）", 10),
];

const ID = /^[\w-]{11}$/;
/** Accepts watch, youtu.be, shorts, embed, live and m. URLs, or a bare 11-char ID. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] || null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, value] = url.pathname.split("/");
    if (kind === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(kind)) id = value;
  }
  return id && ID.test(id) ? id : null;
}
export const embedUrl = (youtubeId: string) =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
export const watchUrl = (youtubeId: string) =>
  `https://www.youtube.com/watch?v=${youtubeId}`;
export const thumbnailUrl = (youtubeId: string) =>
  `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

const isCategory = (c: unknown): c is VideoCategory =>
  VIDEO_CATEGORIES.includes(c as VideoCategory);
export function validateLibrary(raw: unknown): VideoLibrary {
  const lib = raw as VideoLibrary;
  if (
    !lib ||
    lib.version !== 1 ||
    !Array.isArray(lib.custom) ||
    !Array.isArray(lib.hidden) ||
    lib.custom.length > 1000 ||
    lib.hidden.length > 1000
  )
    throw Error("影片清單格式錯誤");
  const ids = new Set<string>();
  const custom = lib.custom.map((x) => {
    if (
      !x ||
      typeof x.id !== "string" ||
      !x.id ||
      ids.has(x.id) ||
      typeof x.youtubeId !== "string" ||
      !ID.test(x.youtubeId) ||
      typeof x.title !== "string" ||
      !x.title.trim() ||
      x.title.length > 200 ||
      !isCategory(x.category) ||
      (x.minutes !== undefined &&
        !(
          typeof x.minutes === "number" &&
          Number.isInteger(x.minutes) &&
          x.minutes >= 1 &&
          x.minutes <= 600
        ))
    )
      throw Error("影片資料格式錯誤");
    ids.add(x.id);
    const video: Video = {
      id: x.id,
      youtubeId: x.youtubeId,
      title: x.title.trim(),
      category: x.category,
    };
    if (x.minutes !== undefined) video.minutes = x.minutes;
    return video;
  });
  if (lib.hidden.some((h) => typeof h !== "string"))
    throw Error("影片清單格式錯誤");
  return { version: 1, custom, hidden: [...new Set(lib.hidden)] };
}
export function readLibrary(storage: Pick<Storage, "getItem">): VideoLibrary {
  try {
    const saved = storage.getItem(VIDEO_KEY);
    return saved ? validateLibrary(JSON.parse(saved)) : emptyLibrary;
  } catch {
    return emptyLibrary;
  }
}
export function storeLibrary(
  storage: Pick<Storage, "setItem">,
  lib: VideoLibrary,
) {
  storage.setItem(VIDEO_KEY, JSON.stringify(validateLibrary(lib)));
}
/** Visible list: spreadsheet videos, the user's own (newest first), then non-hidden built-ins; one entry per YouTube ID. */
export function visibleVideos(
  lib: VideoLibrary,
  sheet: {
    id: string;
    youtubeId: string;
    title: string;
    category: string;
    minutes?: number;
  }[] = [],
): Video[] {
  const hidden = new Set(lib.hidden);
  const seen = new Set<string>();
  const fromSheet: Video[] = sheet.map((x) => ({
    id: `sheet-${x.id}`,
    sheetRecordId: x.id,
    youtubeId: x.youtubeId,
    title: x.title,
    category: (isCategory(x.category) ? x.category : "其他") as VideoCategory,
    ...(x.minutes !== undefined ? { minutes: x.minutes } : {}),
    fromSheet: true,
  }));
  return [
    ...fromSheet,
    ...[...lib.custom].reverse(),
    ...BUILT_IN_VIDEOS.filter((x) => !hidden.has(x.id)),
  ].filter((x) => !seen.has(x.youtubeId) && !!seen.add(x.youtubeId));
}
export function addVideo(
  lib: VideoLibrary,
  input: {
    url: string;
    title: string;
    category: VideoCategory;
    minutes?: number;
  },
  makeId: () => string = () => crypto.randomUUID(),
): VideoLibrary {
  const youtubeId = parseYouTubeId(input.url);
  if (!youtubeId) throw Error("無法辨識 YouTube 網址，請貼上影片連結。");
  if (visibleVideos(lib).some((x) => x.youtubeId === youtubeId))
    throw Error("這部影片已在清單中。");
  const video: Video = {
    id: makeId(),
    youtubeId,
    title: input.title.trim() || "我的運動影片",
    category: input.category,
  };
  if (input.minutes) video.minutes = input.minutes;
  return validateLibrary({ ...lib, custom: [...lib.custom, video] });
}
export function removeVideo(lib: VideoLibrary, id: string): VideoLibrary {
  if (lib.custom.some((x) => x.id === id))
    return { ...lib, custom: lib.custom.filter((x) => x.id !== id) };
  return { ...lib, hidden: [...new Set([...lib.hidden, id])] };
}
