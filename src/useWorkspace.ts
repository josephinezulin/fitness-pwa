import { useState } from "react";
import { validate, type Data } from "./model";
import {
  LOCAL_KEY,
  readLocal,
  storeSnapshot,
  type CloudIdentity,
} from "./workspace";
export function useWorkspace() {
  const [initial] = useState(() => readLocal(localStorage));
  const [data, setData] = useState(initial.data);
  const [cloud, setCloud] = useState<CloudIdentity | null>(null);
  const [storageError, setStorageError] = useState(initial.error);
  function save(next: Data) {
    if (cloud)
      throw Error(
        "目前為雲端唯讀檢視。請先切回本機，雲端寫入將在登入與同步實機驗收後啟用。",
      );
    if (storageError)
      throw Error(
        "本機資料讀取失敗，為保護原始資料暫停寫入。請先處理儲存錯誤。",
      );
    const safe = validate(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
    setData(safe);
  }
  function activateCloud(identity: CloudIdentity, next: Data) {
    const safe = validate(next);
    // Keep display usable if iOS storage is full; no false claim of offline persistence.
    try {
      storeSnapshot(localStorage, identity, safe);
      setStorageError("");
    } catch {
      setStorageError(
        "雲端資料已讀取，但本機快取無法儲存；重新開啟後需再次連線。",
      );
    }
    setCloud(identity);
    setData(safe);
  }
  function disconnectCloud() {
    const local = readLocal(localStorage);
    setCloud(null);
    setData(local.data);
    setStorageError(local.error);
  }
  return { data, cloud, storageError, save, activateCloud, disconnectCloud };
}
