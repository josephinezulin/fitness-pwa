import React, { useState } from "react";
import {
  ArrowUpRight,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
  Star,
} from "lucide-react";
import {
  VIDEO_CATEGORIES,
  addVideo,
  embedUrl,
  readLibrary,
  parseYouTubeId,
  validateLibrary,
  removeVideo,
  storeLibrary,
  thumbnailUrl,
  visibleVideos,
  watchUrl,
  type Video,
  type VideoCategory,
  type VideoLibrary as Library,
} from "./videos";
import type { SheetVideo } from "./model";
import { seenCount, type Preferences } from "./preferences";
import { searchVideos, VIDEO_LENGTHS, type VideoLength } from "./video-search";

const VIDEO_BATCH = 12;

export function VideoLibrary({
  online,
  initialCategory = "全部",
  sheetVideos,
  cloud = false,
  canEditCloud = false,
  onSaveVideo,
  onDeleteVideo,
  preferences,
  onToggleFavorite,
  onMarkSeen,
  onRecord,
  canRecord = false,
  onDraftChange,
}: {
  online: boolean;
  initialCategory?: VideoCategory | "全部";
  /** Present only in cloud view; undefined when the spreadsheet has no Videos tab. */
  sheetVideos?: SheetVideo[];
  cloud?: boolean;
  canEditCloud?: boolean;
  onSaveVideo?: (video: SheetVideo) => boolean;
  onDeleteVideo?: (id: string) => boolean;
  preferences?: Preferences;
  onToggleFavorite?: (id: string) => boolean;
  onMarkSeen?: (id: string) => boolean;
  onRecord?: (video: Video, countWatch: boolean) => void;
  canRecord?: boolean;
  onDraftChange?: (open: boolean) => void;
}) {
  const [lib, setLib] = useState<Library>(() => readLibrary(localStorage));
  const [category, setCategory] = useState<VideoCategory | "全部">(
    initialCategory,
  );
  const [playing, setPlaying] = useState<Video | null>(null);
  const [adding, setAdding] = useState(false);
  React.useLayoutEffect(() => {
    onDraftChange?.(adding);
    return () => onDraftChange?.(false);
  }, [adding, onDraftChange]);
  const [editing, setEditing] = useState<Video | null>(null);
  const [error, setError] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [length, setLength] = useState<VideoLength>("all");
  const [shown, setShown] = useState(VIDEO_BATCH);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const pendingFocus = React.useRef<string | null>(null);
  const listId = `video-results-${React.useId().replace(/:/g, "")}`;
  const [markedThisPlay, setMarkedThisPlay] = useState(false);
  const playerRef = React.useRef<HTMLDivElement>(null);
  const resetBatch = () => {
    pendingFocus.current = null;
    setShown(VIDEO_BATCH);
  };
  React.useEffect(() => {
    setCategory(initialCategory);
    resetBatch();
  }, [initialCategory]);
  React.useEffect(() => {
    pendingFocus.current = null;
  });

  const all = visibleVideos(cloud ? { ...lib, custom: [] } : lib, sheetVideos);
  const available = favoritesOnly
    ? all.filter((x) => preferences?.favorites.includes(x.youtubeId))
    : all;
  const matching = searchVideos(available, query, length);
  const list =
    category === "全部"
      ? matching
      : matching.filter((x) => x.category === category);
  const visible = list.slice(0, shown);
  const filtered =
    query !== "" || length !== "all" || category !== "全部" || favoritesOnly;
  const counts = new Map<string, number>();
  for (const x of matching)
    counts.set(x.category, (counts.get(x.category) || 0) + 1);

  function persist(next: Library) {
    try {
      storeLibrary(localStorage, next);
      setLib(next);
      setError("");
      return true;
    } catch (e) {
      setError("影片清單儲存失敗：" + (e as Error).message);
      return false;
    }
  }
  function play(video: Video) {
    setPlaying(video);
    setMarkedThisPlay(false);
    requestAnimationFrame(() =>
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <section className="card video-library">
      <div className="section-head">
        <div>
          <span className="eyebrow">跟著影片一起動</span>
          <h2>運動影片庫</h2>
        </div>
        <button
          className="text-button"
          disabled={cloud && (!canEditCloud || !sheetVideos)}
          onClick={() => {
            setEditing(null);
            setAdding((a) => !a);
          }}
        >
          {adding ? "取消" : "新增影片"}{" "}
          {adding ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>
      {!online && (
        <p className="notice">
          目前離線，曾載入的部分縮圖可保留；影片需要網路連線才能播放。
        </p>
      )}
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      {adding && (
        <form
          key={editing?.id || "new"}
          className="video-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            try {
              const minutes = Number(form.get("minutes")) || undefined;
              const input = {
                url: String(form.get("url")),
                title: String(form.get("title")),
                category: form.get("category") as VideoCategory,
                minutes,
              };
              const next = cloud
                ? validateLibrary({
                    version: 1,
                    hidden: [],
                    custom: [
                      {
                        id: editing?.sheetRecordId || crypto.randomUUID(),
                        youtubeId: parseYouTubeId(input.url),
                        title: input.title.trim() || "我的運動影片",
                        category: input.category,
                        ...(minutes ? { minutes } : {}),
                      },
                    ],
                  })
                : addVideo(lib, input);
              if (
                cloud &&
                (sheetVideos || []).some(
                  (v) =>
                    v.youtubeId === next.custom[0].youtubeId &&
                    v.id !== editing?.sheetRecordId,
                )
              )
                throw Error("這部影片已在你的試算表中。");
              const saved = cloud
                ? onSaveVideo?.({
                    ...next.custom.at(-1)!,
                    ...(editing ? { id: editing.sheetRecordId! } : {}),
                  })
                : persist(next);
              if (saved) {
                setAdding(false);
                setEditing(null);
                setCategory(form.get("category") as VideoCategory);
                setQuery("");
                setLength("all");
                setFavoritesOnly(false);
                resetBatch();
              }
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label>
            YouTube 網址
            <input
              name="url"
              required
              inputMode="url"
              placeholder="https://youtu.be/…"
              defaultValue={editing ? watchUrl(editing.youtubeId) : ""}
            />
          </label>
          <label>
            名稱
            <input
              name="title"
              maxLength={200}
              placeholder="例：20 分鐘核心訓練"
              defaultValue={editing?.title}
            />
          </label>
          <div className="form-row">
            <label>
              分類
              <select
                name="category"
                defaultValue={
                  editing?.category ||
                  (category === "全部" ? "居家徒手" : category)
                }
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              長度（分鐘，選填）
              <input
                name="minutes"
                type="number"
                min="1"
                max="600"
                step="1"
                defaultValue={editing?.minutes}
              />
            </label>
          </div>
          <button
            className="primary"
            type="submit"
            disabled={cloud && !canEditCloud}
          >
            {editing ? "儲存影片" : "加入影片庫"} <Plus size={16} />
          </button>
        </form>
      )}
      <fieldset className="video-filters">
        <legend>尋找運動影片</legend>
        <div className="video-filter-fields">
          <label>
            搜尋運動影片
            <input
              ref={searchRef}
              type="search"
              value={query}
              maxLength={500}
              placeholder="名稱、分類或 YouTube 連結"
              onChange={(event) => {
                setQuery(event.target.value);
                resetBatch();
              }}
            />
          </label>
          <label>
            影片長度
            <select
              value={length}
              onChange={(event) => {
                setLength(event.target.value as VideoLength);
                resetBatch();
              }}
            >
              {VIDEO_LENGTHS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={!filtered}
          onClick={() => {
            setQuery("");
            setLength("all");
            setCategory("全部");
            setFavoritesOnly(false);
            resetBatch();
            searchRef.current?.focus();
          }}
        >
          清除影片篩選
        </button>
      </fieldset>
      <div className="chips" role="tablist" aria-label="影片分類">
        {(["全部", ...VIDEO_CATEGORIES] as const)
          .filter((c) => c === "全部" || c === category || counts.get(c))
          .map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={category === c ? "selected" : ""}
              onClick={() => {
                setCategory(c);
                resetBatch();
              }}
            >
              {c}
              <small>
                {c === "全部" ? matching.length : counts.get(c) || 0}
              </small>
            </button>
          ))}
      </div>
      {onToggleFavorite && (
        <button
          className="text-button"
          aria-pressed={favoritesOnly}
          onClick={() => {
            setFavoritesOnly((v) => !v);
            setCategory("全部");
            resetBatch();
          }}
        >
          <Star size={15} fill={favoritesOnly ? "currentColor" : "none"} />
          只看我的收藏
        </button>
      )}
      {playing && (
        <div className="player" ref={playerRef}>
          <div className="player-frame">
            <iframe
              key={playing.youtubeId}
              src={embedUrl(playing.youtubeId)}
              title={playing.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="player-bar">
            <div className="grow">
              <h3>{playing.title}</h3>
              <p className="tiny muted">
                {playing.category}
                {playing.minutes ? ` · 約 ${playing.minutes} 分鐘` : ""}
                {" · "}若顯示無法嵌入，可改在 YouTube 觀看
              </p>
            </div>
            <a
              className="icon-button"
              href={watchUrl(playing.youtubeId)}
              target="_blank"
              rel="noreferrer"
              aria-label="在 YouTube 開啟"
            >
              <ArrowUpRight size={16} />
            </a>
            <button
              className="icon-button"
              aria-label="關閉播放器"
              onClick={() => setPlaying(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="player-actions">
            {onRecord && (
              <button
                className="primary"
                disabled={!canRecord}
                onClick={() => {
                  onRecord(playing, !markedThisPlay);
                  setPlaying(null);
                }}
              >
                完成，記錄這次運動
              </button>
            )}
            {onMarkSeen && (
              <button
                className="secondary"
                disabled={markedThisPlay}
                onClick={() => {
                  if (onMarkSeen(playing.youtubeId)) setMarkedThisPlay(true);
                }}
              >
                {markedThisPlay ? "本次已標記看過" : "看過一次"}
                {seenCount(preferences, playing.youtubeId)
                  ? `（已標記 ${seenCount(preferences, playing.youtubeId)} 次）`
                  : ""}
              </button>
            )}
          </div>
        </div>
      )}
      <p className="video-results-status" role="status">
        顯示 {visible.length}／{list.length} 部影片 · 影片庫共 {all.length} 部
      </p>
      {list.length ? (
        <div
          className="video-grid"
          id={listId}
          role="region"
          aria-label="影片搜尋結果"
        >
          {visible.map((x) => (
            <article
              key={x.id}
              className={"video-card" + (playing?.id === x.id ? " active" : "")}
            >
              <button
                className="thumb"
                onClick={() => play(x)}
                aria-label={`播放：${x.title}`}
              >
                <img
                  src={thumbnailUrl(x.youtubeId)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="play">
                  <Play size={18} />
                </span>
                {x.minutes && <span className="length">{x.minutes} 分</span>}
              </button>
              <div className="video-meta">
                <div className="grow">
                  <h3
                    tabIndex={-1}
                    ref={(node) => {
                      if (node && pendingFocus.current === x.id) {
                        pendingFocus.current = null;
                        node.focus();
                      }
                    }}
                  >
                    {x.title}
                  </h3>
                  <p>
                    {x.category}
                    {x.fromSheet ? " · 試算表" : x.builtIn ? "" : " · 我的影片"}
                    {seenCount(preferences, x.youtubeId)
                      ? ` · 看過 ${seenCount(preferences, x.youtubeId)} 次`
                      : ""}
                  </p>
                </div>
                {onToggleFavorite && (
                  <button
                    className="icon-button"
                    aria-label={`收藏影片：${x.title}`}
                    aria-pressed={
                      preferences?.favorites.includes(x.youtubeId) || false
                    }
                    onClick={() => onToggleFavorite(x.youtubeId)}
                  >
                    <Star
                      size={16}
                      fill={
                        preferences?.favorites.includes(x.youtubeId)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                )}
                {x.fromSheet && (
                  <button
                    className="icon-button"
                    disabled={!canEditCloud}
                    aria-label={`編輯影片：${x.title}`}
                    onClick={() => {
                      setEditing(x);
                      setAdding(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {(!x.fromSheet || cloud) && (
                  <button
                    className="icon-button"
                    aria-label={`從清單移除：${x.title}`}
                    disabled={x.fromSheet && !canEditCloud}
                    onClick={() => {
                      if (confirm(`從影片庫移除「${x.title}」？`)) {
                        const saved = x.fromSheet
                          ? onDeleteVideo?.(x.sheetRecordId!)
                          : persist(removeVideo(lib, x.id));
                        if (saved && playing?.id === x.id) setPlaying(null);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          {query.trim() || length !== "all" || category !== "全部"
            ? "沒有符合條件的影片，試試其他關鍵字或清除篩選。"
            : favoritesOnly
              ? "還沒有符合分類的收藏，點影片旁的星星加入收藏。"
              : "這個分類還沒有影片，點「新增影片」貼上網址。"}
        </div>
      )}
      {visible.length < list.length && (
        <button
          type="button"
          className="secondary video-more"
          aria-controls={listId}
          onClick={() => {
            pendingFocus.current = list[visible.length].id;
            setShown((count) => count + VIDEO_BATCH);
          }}
        >
          再顯示 {Math.min(VIDEO_BATCH, list.length - visible.length)} 部影片
        </button>
      )}
      <p className="tiny muted">
        影片直接在頁面內播放（YouTube 隱私強化模式）。
        {cloud
          ? sheetVideos
            ? `試算表 Videos 分頁共 ${sheetVideos.length} 部影片，新增與編輯會同步到私人試算表。`
            : "試算表尚無 Videos 分頁，可執行升級腳本加入，影片就會跟著帳號走。"
          : ""}
        {cloud
          ? "尚未同步的修改會先保留在此裝置；"
          : "App 內新增的影片存於此裝置；"}
        {lib.hidden.length > 0 && (
          <>
            已隱藏 {lib.hidden.length} 部內建影片，
            <button
              className="inline-link"
              onClick={() => persist({ ...lib, hidden: [] })}
            >
              <RotateCcw size={11} /> 還原內建影片
            </button>
            。
          </>
        )}
        JSON 備份會一併包含自訂影片。
        {preferences && " 收藏與觀看標記儲存在此裝置，依帳號及試算表分開保存。"}
      </p>
    </section>
  );
}
