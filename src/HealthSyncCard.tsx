import { HeartPulse, ExternalLink } from "lucide-react";
import type { HealthSyncSummary } from "./health-sync-status";

export function HealthSyncCard({
  cloud,
  summary,
  timezone,
  readAt,
  online,
}: {
  cloud: boolean;
  summary: HealthSyncSummary | null;
  timezone?: string;
  readAt?: string;
  online: boolean;
}) {
  const format = (value: string) =>
    new Date(value).toLocaleString("zh-TW", { timeZone: timezone });
  const latest = summary?.latest,
    success = summary?.lastSuccess;
  const label = !cloud
    ? "尚未連線"
    : !summary
      ? "待更新資料"
      : !latest
        ? "尚無同步紀錄"
        : latest.status === "committed"
          ? "最近批次已完成"
          : latest.status === "partial"
            ? "最近批次未確認完成"
            : "最近批次失敗";
  return (
    <section className="card health-sync-card" aria-label="Apple 健康同步狀態">
      <div className="section-head">
        <h2>
          <HeartPulse size={20} />
          Apple 健康同步
        </h2>
      </div>
      <p
        className="health-sync-state"
        data-status={cloud && summary ? latest?.status : "unknown"}
        aria-live="polite"
      >
        {label}
      </p>
      {!cloud ? (
        <p className="guide">
          登入 Google 並使用自己的私人試算表後，就能查看捷徑的同步紀錄。
        </p>
      ) : !summary ? (
        <p className="guide">
          目前沒有可用的同步紀錄資訊，無法確認捷徑的同步結果。請在連線並登入後更新資料。
        </p>
      ) : !latest ? (
        <p className="guide">
          這份試算表還沒有同步紀錄。若已設定捷徑，請先在 iPhone
          解鎖後手動執行，再更新資料。
        </p>
      ) : (
        <>
          <dl>
            <dt>上次成功批次</dt>
            <dd>
              {success ? (
                <time dateTime={success.receivedAt}>
                  {format(success.receivedAt)}
                </time>
              ) : (
                "尚無成功批次"
              )}
            </dd>
            {latest.status !== "committed" && (
              <>
                <dt>最近批次收到時間</dt>
                <dd>
                  <time dateTime={latest.receivedAt}>
                    {format(latest.receivedAt)}
                  </time>
                </dd>
              </>
            )}
          </dl>
          {latest.status === "committed" ? (
            <p className="guide">
              本批已處理 {latest.acceptedCount.toLocaleString("zh-TW")}{" "}
              筆輸入，包含重複或舊快照；這不是本次新增的筆數，也不代表所有健康資料都已同步。
              {latest.rejectedCount > 0
                ? `另有 ${latest.rejectedCount} 筆未接受，請檢查捷徑回應。`
                : ""}
            </p>
          ) : (
            <p className="guide">
              {latest.status === "partial"
                ? "這批可能仍在處理，或中途停止；目前不能視為成功。"
                : "這批沒有完成同步。"}
              若持續不變，請解鎖 iPhone 手動重試，並檢查捷徑回應。
            </p>
          )}
        </>
      )}
      {cloud && readAt && (
        <p className="tiny muted">
          試算表最後讀取：{format(readAt)}（{timezone}）。
          {!online
            ? "目前離線，尚未重新確認。"
            : "結果以這次讀取到的紀錄為準。"}
        </p>
      )}
      <p className="tiny muted">
        批次時間是伺服器收件時間，不代表量測時間。PWA
        讀取試算表的時間與捷徑上傳時間不同；未授權或驗證失敗的請求可能不會留下同步紀錄。
      </p>
      <a
        className="text-button"
        href="https://github.com/josephinezulin/fitness-pwa/blob/main/docs/health-ingest-setup.md"
        target="_blank"
        rel="noopener noreferrer"
      >
        查看捷徑同步設定說明 <ExternalLink size={14} />
      </a>
    </section>
  );
}
