import { useEffect, useId, useRef, useState } from "react";
import {
  RefreshCw,
  Settings,
  LogOut,
  Cloud,
  CloudOff,
  HardDrive,
  ChartNoAxesCombined,
} from "lucide-react";
import type { CloudIdentity } from "./workspace";

/** Presentational disclosure only: sessions and account selection stay in CloudPanel/workspace. */
export function AccountMenu({
  cloud,
  online,
  readBusy,
  syncBusy,
  pendingCount,
  issue,
  contextKey,
  onRefresh,
  onSettings,
  onTrends,
  onLocal,
}: {
  cloud: CloudIdentity | null;
  online: boolean;
  readBusy: boolean;
  syncBusy: boolean;
  pendingCount: number;
  issue: boolean;
  contextKey: string;
  onRefresh: () => void;
  onSettings: () => void;
  onTrends?: () => void;
  onLocal: () => void;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === contextKey;
  const attention = issue || pendingCount > 0 || !online;
  const close = (focus = false) => {
    setOpenFor(null);
    if (focus)
      (opener.current?.isConnected ? opener.current : trigger.current)?.focus();
  };
  useEffect(() => setOpenFor(null), [contextKey]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenFor(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenFor(null);
        (opener.current?.isConnected
          ? opener.current
          : trigger.current
        )?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  const status = cloud
    ? issue
      ? "同步需要注意"
      : syncBusy
        ? "正在同步修改…"
        : readBusy
          ? "正在更新資料…"
          : pendingCount
            ? `${pendingCount} 筆修改待同步`
            : online
              ? "已連線私人試算表"
              : "離線顯示先前資料"
    : online
      ? "本機模式"
      : "離線模式";
  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          close();
      }}
    >
      {!online && (
        <button
          className="icon-button round offline-button"
          aria-label="離線說明"
          aria-expanded={open}
          aria-controls={id}
          onClick={(event) => {
            opener.current = event.currentTarget;
            setOpenFor(contextKey);
          }}
        >
          <CloudOff size={18} aria-hidden="true" />
        </button>
      )}
      <button
        className="avatar"
        ref={trigger}
        aria-label="帳號與同步設定"
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          opener.current = event.currentTarget;
          setOpenFor(open ? null : contextKey);
        }}
      >
        <span aria-hidden="true">我</span>
        <i
          className={`account-dot ${attention ? "attention" : cloud ? "connected" : "local"}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <section className="account-panel" id={id} aria-label="帳號與同步">
          <div className="account-heading">
            {cloud ? <Cloud size={18} /> : <HardDrive size={18} />}
            <strong>帳號與資料</strong>
          </div>
          <p className="account-status">{status}</p>
          {!online && (
            <p className="account-help" role="note" aria-label="離線模式說明">
              {cloud
                ? "目前顯示上次讀取的資料。運動、課表與影片修改會保留在此裝置，恢復網路並有有效 Google 授權後補同步。"
                : "目前離線，仍可查看、記錄與備份此瀏覽器的資料。雲端同步與影片播放需要網路。"}
            </p>
          )}
          {cloud ? (
            <>
              <h2>{cloud.title}</h2>
              <dl>
                <dt>資料時區</dt>
                <dd>{cloud.timezone}</dd>
                <dt>最後讀取</dt>
                <dd>
                  {new Date(cloud.checkedAt).toLocaleString("zh-TW", {
                    timeZone: cloud.timezone,
                  })}
                </dd>
              </dl>
              <button
                disabled={readBusy || syncBusy || !online}
                onClick={onRefresh}
              >
                <RefreshCw size={16} />
                {readBusy ? "更新中…" : "更新資料"}
              </button>
            </>
          ) : (
            <p className="account-help">資料存在這支手機</p>
          )}
          {onTrends && (
            <button
              onClick={() => {
                close(true);
                onTrends();
              }}
            >
              <ChartNoAxesCombined size={16} />
              健康趨勢
            </button>
          )}
          <button
            onClick={() => {
              close(true);
              onSettings();
            }}
          >
            <Settings size={16} />
            設定與備份
          </button>
          {cloud && (
            <button
              className="account-local"
              onClick={() => {
                close(true);
                onLocal();
              }}
            >
              <LogOut size={16} />
              切回本機
            </button>
          )}
        </section>
      )}
    </div>
  );
}
