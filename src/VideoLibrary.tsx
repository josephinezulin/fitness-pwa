import React, { useState } from "react";
import { ArrowUpRight, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  VIDEO_CATEGORIES,
  addVideo,
  embedUrl,
  readLibrary,
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

export function VideoLibrary({
  online,
  initialCategory = "全部",
  sheetVideos,
  cloud = false,
}: {
  online: boolean;
  initialCategory?: VideoCategory | "全部";
  /** Present only in cloud view; undefined when the spreadsheet has no Videos tab. */
  sheetVideos?: SheetVideo[];
  cloud?: boolean;
}) {
  const [lib, setLib] = useState<Library>(() => readLibrary(localStorage));
  const [category, setCategory] = useState<VideoCategory | "全部">(
    initialCategory,
  );
  const [playing, setPlaying] = useState<Video | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const playerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setCategory(initialCategory), [initialCategory]);

  const all = visibleVideos(lib, sheetVideos);
  const list =
    category === "全部" ? all : all.filter((x) => x.category === category);
  const counts = new Map<string, number>();
  for (const x of all)
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
        <button className="text-button" onClick={() => setAdding((a) => !a)}>
          {adding ? "取消" : "新增影片"}{" "}
          {adding ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>
      {!online && (
        <p className="notice">目前離線，影片需要網路連線才能播放。</p>
      )}
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      {adding && (
        <form
          className="video-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            try {
              const minutes = Number(form.get("minutes")) || undefined;
              const next = addVideo(lib, {
                url: String(form.get("url")),
                title: String(form.get("title")),
                category: form.get("category") as VideoCategory,
                minutes,
              });
              if (persist(next)) {
                setAdding(false);
                setCategory(form.get("category") as VideoCategory);
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
            />
          </label>
          <label>
            名稱
            <input
              name="title"
              maxLength={200}
              placeholder="例：20 分鐘核心訓練"
            />
          </label>
          <div className="form-row">
            <label>
              分類
              <select
                name="category"
                defaultValue={category === "全部" ? "居家徒手" : category}
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              長度（分鐘，選填）
              <input name="minutes" type="number" min="1" max="600" step="1" />
            </label>
          </div>
          <button className="primary" type="submit">
            加入影片庫 <Plus size={16} />
          </button>
        </form>
      )}
      <div className="chips" role="tablist" aria-label="影片分類">
        {(["全部", ...VIDEO_CATEGORIES] as const)
          .filter((c) => c === "全部" || counts.get(c))
          .map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
              <small>{c === "全部" ? all.length : counts.get(c)}</small>
            </button>
          ))}
      </div>
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
        </div>
      )}
      {list.length ? (
        <div className="video-grid">
          {list.map((x) => (
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
                  <h3>{x.title}</h3>
                  <p>
                    {x.category}
                    {x.fromSheet ? " · 試算表" : x.builtIn ? "" : " · 我的影片"}
                  </p>
                </div>
                {!x.fromSheet && (
                  <button
                    className="icon-button"
                    aria-label={`從清單移除：${x.title}`}
                    onClick={() => {
                      if (confirm(`從影片庫移除「${x.title}」？`)) {
                        if (playing?.id === x.id) setPlaying(null);
                        persist(removeVideo(lib, x.id));
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
          這個分類還沒有影片，點「新增影片」貼上網址。
        </div>
      )}
      <p className="tiny muted">
        影片直接在頁面內播放（YouTube 隱私強化模式）。
        {cloud
          ? sheetVideos
            ? `已讀取試算表 Videos 分頁 ${sheetVideos.length} 部影片（請在試算表中增刪）。`
            : "試算表尚無 Videos 分頁，可執行升級腳本加入，影片就會跟著帳號走。"
          : ""}
        App 內新增的影片存於此裝置；
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
      </p>
    </section>
  );
}
