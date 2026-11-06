import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { Download, X } from "lucide-react";
export function PwaUpdate({ blocked }: { blocked: boolean }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const apply = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let active = true;
    apply.current = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        if (active) setUpdateReady(true);
      },
      onOfflineReady: () => {
        if (active) setOfflineReady(true);
      },
      onRegisterError: () => {
        if (active) setError("離線介面暫時未能準備完成，連網功能仍可使用。");
      },
    });
    return () => {
      active = false;
      apply.current = null;
    };
  }, []);
  async function update() {
    if (blocked || updating || !apply.current) return;
    setUpdating(true);
    setError("");
    try {
      await apply.current(true);
    } catch {
      setError("更新未完成，請確認網路後重試。");
    } finally {
      setUpdating(false);
    }
  }
  if (!updateReady && !offlineReady && !error) return null;
  return (
    <div className="notice pwa-update" role="status">
      <Download size={17} />
      <span>
        {error || (updateReady ? "新版本已就緒。" : "離線介面已準備好。")}
        {updateReady && blocked ? " 請先儲存或關閉目前表單，再更新。" : ""}
      </span>
      {updateReady && (
        <button
          className="secondary"
          disabled={blocked || updating}
          onClick={() => void update()}
        >
          {updating ? "更新中…" : "更新版本"}
        </button>
      )}
      {!updateReady && (
        <button
          aria-label="關閉離線通知"
          onClick={() => {
            setOfflineReady(false);
            setError("");
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
