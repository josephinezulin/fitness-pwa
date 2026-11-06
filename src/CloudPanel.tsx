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
  readConfig,
  revoke,
  storeConfig,
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
import { TAB_NAMES } from "./sheet-schema";
export function CloudPanel({
  onUseSnapshot,
  onDisconnect,
}: {
  onUseSnapshot: (identity: CloudIdentity, data: Data) => void;
  onDisconnect: () => void;
}) {
  const [config, setConfig] = useState(readConfig);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<GoogleSession | null>(null);
  const [inspection, setInspection] = useState<SheetInspection | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [configurationOpen, setConfigurationOpen] = useState(!config.clientId);
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
  async function setup(c: GoogleConfig) {
    const version = ++epoch.current;
    setReady(false);
    setBusy("載入 Google 元件");
    setNotice("");
    try {
      storeConfig(c);
      await prepareGoogle();
      if (valid(version)) {
        setReady(true);
        setConfigurationOpen(false);
      }
    } catch (error) {
      if (valid(version)) setNotice((error as Error).message);
    } finally {
      if (valid(version)) setBusy("");
    }
  }
  function signIn() {
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
    if (!session) return;
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
      <details
        open={configurationOpen}
        onToggle={(event) => setConfigurationOpen(event.currentTarget.open)}
      >
        <summary>Google 專案設定</summary>
        <p className="tiny muted">
          需先建立自己的 Google Cloud 專案並啟用
          API。以下都是可公開的應用識別設定，不是登入
          Token。請依專案說明設定來源限制，勿填入 Client Secret 或服務帳戶金鑰。
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const next = {
              clientId: String(form.get("clientId")).trim(),
              apiKey: String(form.get("apiKey")).trim(),
              projectNumber: String(form.get("projectNumber")).trim(),
            };
            setConfig(next);
            void setup(next);
          }}
        >
          <label>
            OAuth Web Client ID
            <input
              name="clientId"
              autoComplete="off"
              defaultValue={config.clientId}
              required
              disabled={!!session || !!busy}
              placeholder="…apps.googleusercontent.com"
            />
          </label>
          <label>
            受網站與 API 限制的 API Key
            <input
              name="apiKey"
              autoComplete="off"
              defaultValue={config.apiKey}
              required
              disabled={!!session || !!busy}
              placeholder="AIza…"
            />
          </label>
          <label>
            Google Cloud 專案編號
            <input
              name="projectNumber"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={config.projectNumber}
              required
              disabled={!!session || !!busy}
              placeholder="數字編號，不是專案名稱"
            />
          </label>
          <button className="secondary" disabled={!!session || !!busy}>
            儲存設定並載入連線元件
          </button>
        </form>
      </details>
      {!session ? (
        <div className="cloud-actions">
          {!ready && (
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => void setup(config)}
            >
              載入 Google 連線元件
            </button>
          )}
          <button
            className="primary"
            disabled={!ready || !!busy}
            onClick={signIn}
          >
            登入 Google 並授權選定檔案
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
                reset("已登出。所有登入 Token 已從本次連線狀態移除。");
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
