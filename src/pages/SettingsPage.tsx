import type { ReactNode } from "react";
import { Download, Upload } from "lucide-react";
import { HealthSyncCard } from "../HealthSyncCard";
import type { HealthSyncSummary } from "../health-sync-status";
/** Always mounted: hiding this page must not reset the Google session. */
export function SettingsPage({
  visible,
  cloud,
  workoutCount,
  metricCount,
  children,
  onExport,
  onRestore,
  onDemo,
  healthSync,
  timezone,
  readAt,
  online,
}: {
  visible: boolean;
  cloud: boolean;
  workoutCount: number;
  metricCount: number;
  children: ReactNode;
  onExport: () => void;
  onRestore: (file?: File) => Promise<void>;
  onDemo: () => void;
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
        <label className="secondary file-label">
          <Upload size={18} />
          還原 JSON 備份
          <input
            type="file"
            disabled={cloud}
            accept="application/json,.json"
            onChange={(e) => {
              void onRestore(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <p className="tiny muted">
          目前：{workoutCount} 筆運動，{metricCount} 筆健康摘要
        </p>
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
      <section className="card">
        <h2>整合進度</h2>
        <p className="guide">
          第一階段：本機 PWA
          <br />
          第二階段：Google 登入、選檔及私人雲端同步
          <br />
          第三階段：Apple 健康與 iOS 捷徑（待部署及實機驗收）
        </p>
        <span className="pill">運動、課表與影片支援私人雲端同步</span>
      </section>
      <section className="card">
        <h2>試用示範資料</h2>
        <p className="guide">
          載入 14 天虛構健康摘要，預覽趨勢與課表。會取代目前資料，請先備份。
        </p>
        <button className="secondary" disabled={cloud} onClick={onDemo}>
          載入示範資料
        </button>
      </section>
    </div>
  );
}
