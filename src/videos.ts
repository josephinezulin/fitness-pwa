/** Tutorial video library. Not health data: kept apart from the workspace so it works in cloud read-only mode too. */
export const VIDEO_CATEGORIES = [
  "床上運動",
  "坐姿運動",
  "減脂燃脂",
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
/** Short, low-effort categories used for the home page "nothing scheduled" suggestion. */
export const LIGHT_CATEGORIES: readonly VideoCategory[] = [
  "床上運動",
  "伸展放鬆",
  "坐姿運動",
];
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];
export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  category: VideoCategory;
  minutes?: number;
  builtIn?: boolean;
  /** Set only for built-in videos taught in Simplified Chinese. */
  simplified?: boolean;
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
  simplified = false,
): Video => ({
  id: `builtin-${youtubeId}`,
  youtubeId,
  category,
  title,
  minutes,
  builtIn: true,
  ...(simplified ? { simplified: true } : {}),
});
const SC = true;
/** Curated starter list (mostly Traditional Chinese); users can hide any of these or add their own. */
export const BUILT_IN_VIDEOS: Video[] = [
  // 床上運動
  v("4KaPtQLW7Tw", "床上運動", "床上運動｜4 分鐘燃脂、瘦全身", 4),
  v("6EDuWA56UwM", "床上運動", "瘦小腹 5 分鐘床上運動", 5),
  v("scevnZd5gyo", "床上運動", "5 分鐘早晨拉伸｜床上全身放鬆", 5),
  v("Si0LTuVCva0", "床上運動", "床上小運動｜簡單 5 招瘦全身"),
  v("rqTK1zqqpOY", "床上運動", "懶人床上運動｜翹臀與腹肌"),
  v("4b94Ko9_Vkw", "床上運動", "躺在床上練腹肌"),
  v("OqhDMWjLTqc", "床上運動", "躺床可練的核心訓練", 10),
  v("FnvmlKzSyMU", "床上運動", "醫師教你躺床就能做的核心訓練", 10),
  v("R_z0Px5FMBc", "床上運動", "十種臀橋變化，全程躺著"),
  v("SQLPfhS0Sk4", "床上運動", "十分鐘躺姿髖部與臀腿肌力", 10),
  v("6vkGEXsTrNY", "床上運動", "躺著練橋式｜改善久坐腰痛"),
  v("NoPG0MeI62E", "床上運動", "躺著訓練核心與腿力"),
  v("OVCNG4ZbnCE", "床上運動", "起床、睡前的肌筋膜動態伸展"),
  v("ladfE0xXm50", "床上運動", "20 分鐘睡前瑜珈｜可在床上做", 20),
  v("f4ff_yBqptQ", "床上運動", "15 分鐘睡前瑜伽｜全程躺著", 15),
  v("sxifT8ncKCU", "床上運動", "簡單睡前瑜珈｜安定自律神經", 8),
  v("Jp7040Ob-zA", "床上運動", "睡前舒緩運動｜床上或墊上"),
  v("m_tb0vGEpG4", "床上運動", "15 分鐘床上運動｜瘦腿提臀", 15, SC),
  v("opKm3fyrWz8", "床上運動", "床上運動第 2 彈｜5 分鐘燃脂", 5, SC),
  v("my-2Ji8BDCU", "床上運動", "睡前躺床運動｜10 分鐘瘦腿瘦腰", 10, SC),
  v("mISlfSZIS78", "床上運動", "清晨 5 分鐘拉伸", 5, SC),
  v("kjgUgaKUqXo", "床上運動", "15 分鐘晚間瑜伽", 15, SC),
  v("6vXDkG4hgVI", "床上運動", "15 分鐘睡前床上陰瑜伽", 15, SC),
  // 坐姿運動
  v("SfuEXk51yRs", "坐姿運動", "十分鐘椅子瑜珈", 10),
  v("VPa-SA0dAw0", "坐姿運動", "10 分鐘坐姿伸展｜久坐放鬆", 10),
  v("7rZITKjjZYg", "坐姿運動", "10 分鐘坐姿柔軟操", 10),
  v("a3iguKFPl90", "坐姿運動", "坐姿有氧｜坐著練心肺", 10),
  v("VaH4gfvgr5c", "坐姿運動", "坐著做超慢跑 150bpm", 10),
  // 減脂燃脂
  v("PLqkCglqr5E", "減脂燃脂", "10 分鐘低難度有氧舞蹈", 10),
  v("2dhLux5VkBY", "減脂燃脂", "15 分鐘有氧燃脂｜K-POP 節奏、全站立", 15),
  v("ntCOSg6E7nU", "減脂燃脂", "【初階】15 分鐘無跳躍全身燃脂", 15),
  v("lKQ4RARYesY", "減脂燃脂", "15 分鐘簡易循環有氧舞蹈", 15),
  v("tXLPKCt_c3g", "減脂燃脂", "20 分鐘減脂韻律操｜全站立", 20),
  v("LmrKejHOaG4", "減脂燃脂", "20 分鐘站立式全身燃脂｜不跳躍", 20),
  v("oHqgYrpf6pI", "減脂燃脂", "20 分鐘居家全身燃脂課表", 20),
  v("OooRvDf9Pm8", "減脂燃脂", "【中階】20 分鐘燃脂 HIIT", 20),
  v("-6er2bZ0QJs", "減脂燃脂", "【初階】25 分鐘全身燃脂｜無跳躍", 25),
  v("56A-3qmJFjs", "減脂燃脂", "30 分鐘站立式燃脂｜不傷膝", 30),
  v("fIe_q2wSGHc", "減脂燃脂", "20 分鐘無跳動有氧燃脂", 20, SC),
  v("sf4V6lrRs4I", "減脂燃脂", "20 分鐘全程站立燃脂有氧", 20, SC),
  // 暖身
  v("jwc5D73hn88", "暖身", "5 分鐘快速暖身", 5),
  v("2cx_BwtXokE", "暖身", "5 分鐘暖身｜啟動全身關節", 5),
  v("-fI2BPfeTHI", "暖身", "跑前暖身 5 分鐘", 5),
  v("6kiCiYAIGHQ", "暖身", "上半身暖身｜重訓前 4 招", 5),
  // 居家徒手
  v("Wmnp7qSnbWE", "居家徒手", "【初階】20 分新手全身訓練｜不傷膝", 20),
  v("UMF-BoOd_5A", "居家徒手", "【初階】20 分鐘站立式燃脂", 20),
  v("Alt4IBW5I6s", "居家徒手", "【初階】20 分鐘瘦腰腹｜全程站立", 20),
  v("csUIfpDQMno", "居家徒手", "【初階】30 分鐘無跳躍 HIIT", 30),
  v("Z1u5wYKZ9DQ", "居家徒手", "20 分鐘居家全身徒手訓練", 20),
  v("qMBvQfmRQ1c", "居家徒手", "20 分鐘徒手臀腿訓練", 20),
  v("tERf66tnWS4", "居家徒手", "15 分鐘腿部運動", 15),
  // 快走／跑步機
  v("GeJcn-2YBW0", "快走／跑步機", "20 分鐘居家走路運動", 20),
  v("_VekjuQ3Z7c", "快走／跑步機", "原地走路 10 分鐘", 10),
  v("LToadLp3uCo", "快走／跑步機", "健身房跑步機簡介｜上坡快走、間歇"),
  v("q8X0PlnDFxI", "快走／跑步機", "跑步機走路也能燃脂"),
  v("z64MdJOVK_s", "快走／跑步機", "國手教你跑步機上下坡"),
  // 跑步
  v("TLCTEUL_-Cs", "跑步", "20 分鐘超慢跑｜初階 180BPM", 20),
  v("TtbrOIUYtGw", "跑步", "30 分鐘超慢跑｜含暖身伸展", 30),
  v("kXddU6wz3Qo", "跑步", "跑步機超慢跑 30 分鐘", 30),
  v("YQGfUEv2ewo", "跑步", "節拍超慢跑 180bpm 30 分鐘", 30),
  v("mefKVeD9Gb0", "跑步", "跑步機間歇訓練"),
  // 重量訓練
  v("l4OAWAiDd8I", "重量訓練", "【初階】10 分鐘啞鈴全身", 10),
  v("lU2VUYN-5bQ", "重量訓練", "10 分鐘初階無跳躍啞鈴全身", 10),
  v("WSwPpxnfFvg", "重量訓練", "25 分鐘全身訓練｜可持啞鈴", 25),
  v("iq_oyMFkrAI", "重量訓練", "居家啞鈴 18 動作與三天課表"),
  // 瑜伽
  v("XKlqbwVTAsk", "瑜伽", "哈達瑜伽｜20 分鐘初學者", 20),
  v("kM_o-C8IXP0", "瑜伽", "20 分鐘學會拜日式", 20),
  v("DDjJKQ8Hbl4", "瑜伽", "下班後瑜伽 10 分鐘", 10),
  // 皮拉提斯
  v("XsxEwgxzrL0", "皮拉提斯", "15 分鐘新手 18 式｜核心與下肢", 15),
  v("BzUBFJ1Q6Wo", "皮拉提斯", "15 分鐘 20 式｜喚醒核心", 15),
  v("Og46GlsIVXg", "皮拉提斯", "20 分鐘新手 24 式", 20),
  v("5dReS4zm4ng", "皮拉提斯", "20 分鐘全身 Level 1", 20),
  v("6laqRz2heUg", "皮拉提斯", "20 分鐘上肢訓練", 20),
  v("Dc1zuUIcCkM", "皮拉提斯", "20 分鐘核心與下腹", 20),
  v("KtYCt2bOZOM", "皮拉提斯", "30 分鐘初學者｜核心與下半身", 30),
  // 伸展放鬆
  v("4AfbzGBo8aI", "伸展放鬆", "10 分鐘全身伸展｜開髖、拉筋", 10),
  v("RqxODBtCfhc", "伸展放鬆", "10 分鐘打開身體｜髖、腿後、下背", 10),
  v("thYCbxEBdrw", "伸展放鬆", "10 分鐘睡前拉伸", 10),
  v("KUYuT0OYj_4", "伸展放鬆", "10 分鐘睡前皮拉提斯", 10),
  v("DVJuWf212T0", "伸展放鬆", "睡前放鬆伸展"),
  // 飛輪／騎車
  v("_yHFIM8IDUo", "飛輪／騎車", "10 分鐘飛輪｜新手", 10),
  v("0dyWm7yR-IM", "飛輪／騎車", "26 分鐘飛輪燃脂間歇", 26),
  v("4kBz0awTqSI", "飛輪／騎車", "基礎有氧｜單車飛輪"),
  // 跳繩
  v("2nUJS6WOVxo", "跳繩", "初學者跳繩｜正確姿勢 5 關鍵"),
  v("GzyCO_IQO1A", "跳繩", "跳繩不傷膝｜4 分鐘跟練", 4),
  v("Hg9tdz_5Dnw", "跳繩", "從側甩開始｜15 分鐘入門", 15),
  v("n96JYmyvzvo", "跳繩", "15 分鐘初學者跳繩跟練", 15),
  v("Ry1sbxNNWG0", "跳繩", "跳繩新手必看"),
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
/** Replace a custom record in place; built-ins and source order are unchanged. */
export function editVideo(
  lib: VideoLibrary,
  id: string,
  input: Parameters<typeof addVideo>[1],
): VideoLibrary {
  const current = lib.custom.find((video) => video.id === id);
  if (!current) throw Error("找不到這部自訂影片，請重新讀取影片清單。");
  const youtubeId = parseYouTubeId(input.url);
  if (!youtubeId) throw Error("無法辨識 YouTube 網址，請貼上影片連結。");
  if (
    youtubeId !== current.youtubeId &&
    visibleVideos({
      ...lib,
      custom: lib.custom.filter((video) => video.id !== id),
    }).some((video) => video.youtubeId === youtubeId)
  )
    throw Error("這部影片已在清單中。");
  const replacement: Video = {
    id,
    youtubeId,
    title: input.title.trim() || "我的運動影片",
    category: input.category,
    ...(input.minutes !== undefined ? { minutes: input.minutes } : {}),
  };
  return validateLibrary({
    ...lib,
    custom: lib.custom.map((video) => (video.id === id ? replacement : video)),
  });
}
export function removeVideo(lib: VideoLibrary, id: string): VideoLibrary {
  if (lib.custom.some((x) => x.id === id))
    return { ...lib, custom: lib.custom.filter((x) => x.id !== id) };
  return { ...lib, hidden: [...new Set([...lib.hidden, id])] };
}
