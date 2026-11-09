import { useEffect, useRef, useState } from "react";
import {
  emptyLibrary,
  validateLibrary,
  VIDEO_KEY,
  type VideoLibrary,
} from "./videos";

const changedMessage = "影片清單已在其他分頁變更，已暫停本機影片變更。";
const readMessage =
  "無法讀取影片清單，已暫停本機影片變更。請確認瀏覽器儲存權限；若內容無法解讀，可用先前有效的 JSON 備份還原後再試。";

function read() {
  try {
    const raw = localStorage.getItem(VIDEO_KEY);
    return {
      raw,
      library: raw === null ? emptyLibrary : validateLibrary(JSON.parse(raw)),
      error: "",
    };
  } catch {
    return { raw: undefined, library: emptyLibrary, error: readMessage };
  }
}

/** Protect sequential writes from stale pages; Web Storage is not a transaction. */
export function useVideoStorage({
  readOnly = false,
}: { readOnly?: boolean } = {}) {
  const [initial] = useState(read);
  const [library, setLibrary] = useState(initial.library);
  const raw = useRef(initial.raw);
  const blockedRef = useRef(!!initial.error);
  const [blocked, setBlocked] = useState(!!initial.error);
  const [error, setError] = useState(initial.error);

  function block(message: string) {
    blockedRef.current = true;
    setBlocked(true);
    setError(message);
  }

  function check() {
    if (readOnly) {
      const next = read();
      if (next.error) {
        block(next.error);
        return false;
      }
      if (next.raw !== raw.current || blockedRef.current) {
        raw.current = next.raw;
        blockedRef.current = false;
        setBlocked(false);
        setError("");
        setLibrary(next.library);
      }
      return true;
    }
    if (blockedRef.current) return false;
    try {
      if (localStorage.getItem(VIDEO_KEY) === raw.current) return true;
      block(changedMessage);
    } catch {
      block(readMessage);
    }
    return false;
  }

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== VIDEO_KEY) return;
      // Access to window.localStorage itself can throw when storage is denied.
      try {
        if (event.storageArea && event.storageArea !== localStorage) return;
      } catch {
        block(readMessage);
        return;
      }
      check();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", foreground);
    window.addEventListener("pageshow", foreground);
    document.addEventListener("visibilitychange", foreground);
    check();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("pageshow", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [readOnly]);

  function persist(next: VideoLibrary) {
    if (readOnly || !check()) return false;
    try {
      const valid = validateLibrary(next);
      const serialized = JSON.stringify(valid);
      localStorage.setItem(VIDEO_KEY, serialized);
      raw.current = serialized;
      setLibrary(valid);
      setError("");
      return true;
    } catch {
      setError(
        "影片清單儲存失敗，畫面與草稿仍保留。請確認瀏覽器儲存空間後重試。",
      );
      return false;
    }
  }

  function reload() {
    const next = read();
    if (next.error) {
      block(next.error);
      return false;
    }
    raw.current = next.raw;
    blockedRef.current = false;
    setBlocked(false);
    setError("");
    setLibrary(next.library);
    return true;
  }

  return { library, blocked, error, persist, reload };
}
