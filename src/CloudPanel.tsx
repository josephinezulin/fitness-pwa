import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  LoaderCircle,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  chooseSpreadsheet,
  login,
  prepareGoogle,
  revoke,
  type GoogleConfig,
  type GoogleSession,
} from "./google";
import {
  GoogleAccessError,
  inspectSpreadsheet,
  type SheetInspection,
} from "./sheets";
import type { Data } from "./model";
import type { CloudIdentity } from "./workspace";
import { loadSiteConfig } from "./site-config";
import { TAB_NAMES } from "./sheet-schema";
export function CloudPanel({
  onUseSnapshot,
  onDisconnect,
  visible,
}: {
  onUseSnapshot: (identity: CloudIdentity, data: Data) => void;
  onDisconnect: () => void;
  visible: boolean;
}) {
  const [config, setConfig] = useState<GoogleConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<GoogleSession | null>(null);
  const [inspection, setInspection] = useState<SheetInspection | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const epoch = useRef(0);
  const request = useRef<AbortController | null>(null);
  const currentSession = useRef<GoogleSession | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      epoch.current++;
      request.current?.abort();
    };
  }, []);
  const reset = (message = "") => {
    epoch.current++;
    request.current?.abort();
    currentSession.current = null;
    setSession(null);
    setInspection(null);
    setBusy("");
    setNotice(message);
    onDisconnect();
  };
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => reset("Google 授權已過期，請重新登入。"),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  const valid = (version: number) =>
    active.current && version === epoch.current;
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    let cancelled = false;
    setConfigLoaded(false);
    loadSiteConfig(
      new URL("google-config.json", document.baseURI),
      controller.signal,
    )
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        if (!cancelled) {
          setConfig(null);
          setNotice("暫時無法確認 Google 連線，請稍後重試。");
        }
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setConfigLoaded(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [retry]);
  useEffect(() => {
    if (!visible || !config || ready) return;
    let cancelled = false;
    setBusy("準備 Google 登入");
    prepareGoogle()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled)
          setNotice("Google 登入暫時無法使用，請檢查網路後重試。");
      })
      .finally(() => {
        if (!cancelled) setBusy("");
      });
    return () => {
      cancelled = true;
    };
  }, [visible, config, retry]);
  function signIn() {
    if (!config || !ready) return;
    const version = ++epoch.current;
    setBusy("等待 Google 登入");
    setNotice("");
    // Invoke synchronously within the click, preserving Safari's popup permission.
    login(config)
      .then((next) => {
        if (!valid(version)) return;
        currentSession.current = next;
        setSession(next);
        setInspection(null);
      })
      .catch((error) => {
        if (valid(version)) setNotice((error as Error).message);
      })
      .finally(() => {
        if (valid(version)) setBusy("");
      });
  }
  async function pick() {
    if (!session || !config) return;
    const version = ++epoch.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setInspection(null);
    setNotice("");
    setBusy("選擇與檢查試算表");
    try {
      const selected = await chooseSpreadsheet(
        config,
        session,
        controller.signal,
      );
      if (!selected || !valid(version)) return;
      const result = await inspectSpreadsheet(
        selected.id,
        session,
        controller.signal,
      );
      if (valid(version)) setInspection(result);
    } catch (error) {
      if (!valid(version)) return;
      if (error instanceof GoogleAccessError && error.status === 401) {
        reset(error.message);
        return;
      }
      setNotice(
        (error as Error).name === "AbortError"
          ? "讀取逾時或已取消，請稍後重試。"
          : (error as Error).message,
      );
    } finally {
      if (valid(version)) setBusy("");
    }
  }
  return (
    <section className="card cloud-panel">
      <div className="section-head">
        <h2>
          <ShieldCheck size={19} />
          Google 試算表連線
        </h2>
        <span className="pill">連線驗收階段</span>
      </div>
      <p className="guide">
        先檢查你自己的私人試算表副本。這一步只讀取與驗證格式，不會上傳本機健康資料，也不會修改試算表。通過後可選擇在首頁唯讀查看雲端資料，本機紀錄不會自動上傳或混入。
      </p>
      {configLoaded && !config && (
        <p className="tiny muted">
          Google 連線準備中，目前可使用本機紀錄與 JSON
          備份。開放連線後，你只需登入並選擇自己的試算表。
        </p>
      )}
      {!configLoaded && (
        <p className="tiny muted" role="status">
          正在確認 Google 連線狀態…
        </p>
      )}
      {!session ? (
        <div className="cloud-actions">
          <button
            className="primary"
            disabled={!config || !ready || !!busy}
            onClick={signIn}
          >
            使用 Google 登入
          </button>
          {busy && (
            <button
              className="text-button"
              onClick={() => reset("已取消連線操作。")}
            >
              取消
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="connected-account">
            <Check size={16} />
            <span>{session.email}</span>
            <button
              className="text-button"
              onClick={() => {
                const previous = currentSession.current;
                reset("已登出 Google。");
                if (previous) revoke(previous);
              }}
            >
              <LogOut size={15} />
              登出
            </button>
          </div>
          <button
            className="secondary"
            disabled={!!busy}
            onClick={() => void pick()}
          >
            選擇自己的副本並驗收
          </button>
          <p className="tiny muted">
            只要求存取你選定的檔案，不要求存取整個 Google
            Drive。授權會過期，重新開啟 PWA 需要再次登入。
          </p>
        </>
      )}
      {!session && !busy && (!config || !ready) && configLoaded && (
        <button
          className="text-button"
          onClick={() => {
            setNotice("");
            setRetry((n) => n + 1);
          }}
        >
          重新檢查連線
        </button>
      )}
      {busy && (
        <p className="cloud-status" role="status">
          <LoaderCircle size={16} />
          {busy}…
        </p>
      )}
      {notice && (
        <p className="cloud-error" role="status">
          {notice}
        </p>
      )}
      {inspection && (
        <div className="inspection" role="status">
          <h3>{inspection.report.ok ? "格式檢查通過" : "格式尚未符合需求"}</h3>
          <p className="tiny">
            {inspection.title} · {inspection.timezone}
          </p>
          <ul>
            {TAB_NAMES.map((tab) => (
              <li key={tab}>
                {tab}：{inspection.report.counts[tab]} 筆
              </li>
            ))}
          </ul>
          {!!inspection.report.errors.length && (
            <ul className="cloud-error">
              {inspection.report.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
          {inspection.report.ok && inspection.data && session && (
            <button
              className="secondary"
              onClick={() => {
                onUseSnapshot(
                  {
                    subject: session.subject,
                    spreadsheetId: inspection.id,
                    title: inspection.title,
                    timezone: inspection.timezone,
                    checkedAt: inspection.checkedAt,
                  },
                  inspection.data!,
                );
                setNotice("已切換為雲端唯讀檢視，可前往首頁與健康趨勢查看。");
              }}
            >
              在首頁查看這份雲端資料
            </button>
          )}
          <a
            className="text-button"
            href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(inspection.id)}/edit`}
            target="_blank"
            rel="noreferrer"
          >
            開啟已選擇的試算表 <ExternalLink size={14} />
          </a>
          <p className="tiny muted">
            通過僅代表目前版本及資料格式相容；不代表已啟用同步、iOS 捷徑或完成
            Safari 跨裝置測試。
          </p>
        </div>
      )}
    </section>
  );
}
