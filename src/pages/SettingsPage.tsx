import { useRef, useState, type ReactNode } from "react";
import { Download, Upload } from "lucide-react";
import { HealthSyncCard } from "../HealthSyncCard";
import type { HealthSyncSummary } from "../health-sync-status";
import type { LocalRecovery } from "../workspace";
/** Always mounted: hiding this page must not reset the Google session. */
export function SettingsPage({
  visible,
  cloud,
  localWritable,
  localRecovery,
  recoveryBlocked,
  onExportOriginal,
  onRepair,
  workoutCount,
  metricCount,
  children,
  onExport,
  onRestore,
  restoring,
  onCancelRestore,
  healthSync,
  timezone,
  readAt,
  online,
}: {
  visible: boolean;
  cloud: boolean;
  localWritable: boolean;
  localRecovery: LocalRecovery | null;
  recoveryBlocked: boolean;
  onExportOriginal: (source: LocalRecovery) => boolean;
  onRepair: (file: File | undefined, source: LocalRecovery) => Promise<void>;
  workoutCount: number;
  metricCount: number;
  children: ReactNode;
  onExport: () => void;
  onRestore: (file?: File) => Promise<void>;
  restoring: boolean;
  onCancelRestore: () => void;
  healthSync: HealthSyncSummary | null;
  timezone?: string;
  readAt?: string;
  online: boolean;
}) {
  return (
    <div
      className="settings-grid"
      style={{ display: visible ? "grid" : "none" }}
    >
      {children}
      <HealthSyncCard
        cloud={cloud}
        summary={healthSync}
        timezone={timezone}
        readAt={readAt}
        online={online}
      />
      <section className="card">
        <h2>資料與備份</h2>
        <p className="guide">
          本機紀錄存於此瀏覽器；可另外連線查看私人 Sheets
          的每日摘要，並同步運動、課表及影片修改。清除網站資料或更換裝置前，請先匯出備份。備份含個人健康資料，請妥善保存。
        </p>
        <button className="secondary" onClick={onExport}>
          <Download size={18} />
          {cloud ? "匯出雲端每日摘要 JSON" : "匯出 JSON 備份"}
        </button>
        <label
          className="secondary file-label"
          aria-disabled={cloud || !localWritable || restoring}
        >
          <Upload size={18} />
          還原 JSON 備份
          <input
            type="file"
            disabled={cloud || !localWritable || restoring}
            accept="application/json,.json"
            onChange={(e) => {
              void onRestore(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {restoring && (
          <div className="notice" role="status">
            <span>正在讀取並檢查備份…</span>
            <button
              type="button"
              className="secondary"
              onClick={onCancelRestore}
            >
              取消讀取
            </button>
          </div>
        )}
        <p className="tiny muted">
          目前：{workoutCount} 筆運動，{metricCount} 筆健康摘要
        </p>
        {!cloud && localRecovery && (
          <LocalRecoveryPanel
            source={localRecovery}
            blocked={recoveryBlocked || restoring}
            onExport={onExportOriginal}
            onRestore={onRepair}
          />
        )}
      </section>
      <section className="card">
        <h2>加入 iPhone 主畫面</h2>
        <ol className="guide">
          <li>以 Safari 開啟 GitHub Pages 網址。</li>
          <li>點選「分享」→「加入主畫面」。</li>
          <li>首次連網開啟後，即可離線使用。</li>
        </ol>
        <p className="tiny muted">
          離線模式支援介面、紀錄與備份。影片播放與雲端同步需要網路。裝置儲存空間不足時，iOS
          可能清除網站資料。
        </p>
      </section>
    </div>
  );
}

function LocalRecoveryPanel({
  source,
  blocked,
  onExport,
  onRestore,
}: {
  source: LocalRecovery;
  blocked: boolean;
  onExport: (source: LocalRecovery) => boolean;
  onRestore: (file: File | undefined, source: LocalRecovery) => Promise<void>;
}) {
  const [downloadedFor, setDownloadedFor] = useState<LocalRecovery | null>(
    null,
  );
  const [acknowledgedFor, setAcknowledgedFor] = useState<LocalRecovery | null>(
    null,
  );
  const downloaded = downloadedFor === source;
  const ready = downloaded && acknowledgedFor === source && !blocked;
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div className="notice local-recovery">
      <h3>以備份修復本機資料</h3>
      <p>
        先另存目前無法讀取的原始內容，再選擇之前有效的 JSON
        備份。選檔後會請你確認取代。
      </p>
      <button
        className="secondary"
        disabled={blocked}
        onClick={() => {
          if (!blocked && onExport(source)) setDownloadedFor(source);
        }}
      >
        <Download size={18} />
        下載待修復原始檔案
      </button>
      <p className="tiny">
        下載按鈕只會提出下載要求，請至「檔案」確認已保存。原始檔案含完整儲存內容，請私下保管；它不是可直接還原的備份。
      </p>
      <label className="recovery-confirm">
        <input
          type="checkbox"
          disabled={!downloaded || blocked}
          checked={acknowledgedFor === source}
          onChange={(event) =>
            setAcknowledgedFor(event.target.checked ? source : null)
          }
        />
        我已確認原始檔案保存在自己的裝置
      </label>
      <button
        type="button"
        className="secondary"
        disabled={!ready}
        onClick={() => fileInput.current?.click()}
      >
        <Upload size={18} />
        選擇有效備份來修復
      </button>
      <input
        ref={fileInput}
        hidden
        aria-label="選擇有效備份來修復"
        type="file"
        accept="application/json,.json"
        disabled={!ready}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (ready) void onRestore(file, source);
        }}
      />
    </div>
  );
}
