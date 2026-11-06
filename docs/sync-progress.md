# 同步開發進度與待驗收事項

## 已完成的程式與本機測試

- Google OAuth token flow、Picker 選擇自己的檔案、私人檔案與 schema 閘門。
- 通過閘門後可在首頁、趨勢、運動紀錄中唯讀查看雲端資料；首次必須由使用者明確選擇切換。選擇後依帳號記住檔案，下次登入自動重讀；返回前景／恢復網路會節流更新，亦可手動重讀。
- 體重／體脂取當日最後一筆未刪除樣本；心率明確標記當日樣本算術平均；步數使用該日 canonical 總量，不與舊總數相加。
- 雲端檢視禁止新增、還原或刪除；本機模式的 CRUD 不受影響。切回本機不會上傳任何資料。
- 本機資料維持原 key，雲端每日摘要快取使用 subject + spreadsheetId 分區。Token 與非白名單欄位不寫入快取／備份。
- 登出／授權到期返回本機資料、清除當前雲端檢視；導航切頁不卸載登入元件。重新載入不自動展示帳號快取，需再次登入；同帳號已記住的檔案會重新驗證及讀取，不直接信任舊快取。雲端摘要快取是同源 localStorage，不是加密保管庫。
- 混合時區資料先拒絕，不把不同曆日靜默混算。

## 已完成但未連接寫入端的純邏輯

`src/sync-rules.ts`：

- 相同 sampleKey 且內容一致時去重；不同樣本同一天仍保留；識別碼相同而內容衝突則停止。
- 步數快照按 computedAt 判定先後；較晚到達的舊快照不能覆蓋新值。健康服務較新的修正可以降低總量。
- 運動編輯以 base / local / remote 三份資料規劃，回報 revision 衝突與刪除，不自動復活 tombstone；手動改表卻未更新 revision 也會比較內容。

這些只產生計畫，不發送寫入請求。呼叫者須先以共同 schema 驗證資料。未來寫入端必須在實際提交時重新檢查 revision；Sheets API 的一般讀後寫本身不是原子 compare-and-swap，不能用前端的預檢假裝已解決多人競爭。Apps Script 與瀏覽器同時寫入前，仍需確立協調策略。

## 目前仍關閉

- PWA 對 Sheets 的新增、修改、刪除與自動同步。
- 本機紀錄自動匯入雲端。
- 捷徑健康資料上傳與 Apps Script ingestion deployment。Apps Script 程式及 mock 測試已備妥，但預設關閉且尚未部署，見 docs/health-ingest-setup.md。

使用者已回報本人裝置的 Google 登入與選檔格式驗收通過；其他帳號隔離、過期、拒絕授權與完整 iPhone 情境仍待測試。不能因單一成功路徑而宣告所有驗收通過。

## 需要使用者完成的外部設定

1. GitHub repository 的 Settings → Pages → Source 設為 GitHub Actions。已由使用者完成設定，並已部署成功及驗證首頁、資產、manifest、圖示與 Service Worker 回傳 HTTP 200。
2. 按 `docs/google-setup.md` 建立／設定 Google Cloud 專案、啟用 Sheets／Drive／Picker API、建立 Web OAuth client、設定實際 Pages origin、測試使用者，以及受網站與 API 限制的 Picker API Key。
3. 由維護者將公開 client ID / API Key / 專案編號存入 public/google-config.json 後部署；一般使用者只需親自完成 Google 授權。不要提供 Client Secret、access token 或私鑰。
4. 以私人副本測試讀取、拒絕授權、取消選檔、帳號切換、Token 過期與 iPhone Safari 主畫面模式。

完成真實讀取閘門後，接著實作並測試寫入與離線 outbox，再部署捷徑 API。`docs/shortcuts.md` 定義七天回掃及手動補同步，但現階段尚無可用的健康上傳端點；待使用者將已備妥的 HealthIngest.gs 部署至私人 Apps Script 專案後才能測試原生捷徑 POST。

## 備份範圍

本機模式匯出本機日摘要及運動紀錄；雲端唯讀模式匯出目前投影的每日摘要，檔名及按鈕明確標示。它不包含 HealthMetrics 的所有原始樣本、SyncLogs 或完整試算表結構，因此不是整份 Google Sheets 的完整備份。完整雲端備份需保留原表副本或之後另行實作原始資料匯出。

## 介面與離線更新補強

- 首頁雲端摘要列可直接「更新資料」，更新失敗時明確保留上次摘要與讀取時間；格式變更也不當作已更新。
- Google 授權到期會清除目前雲端檢視並在首頁提示，取消登入後遲到的回應不再讀取帳號資料或切換畫面。
- PWA 新版本就緒時提供明確更新按鈕；表單開啟時停用更新以免重載丟失草稿。離線就緒提示只指介面，不宣稱健康資料已同步。
- 雲端的今日步數、課表週次與趨勢範圍依試算表時區計算；裝置時區不同時不混淆曆日。
- 新增 DOM 介面測試，覆蓋取消登入、登出後換帳號、遲到回應、返回本機時的更新競爭及授權過期；仍需 iPhone Safari 實機驗收。
- `scripts/check_ingest_endpoint.py` 可在取得實際 /exec 網址後，使用 GET、空 POST 與錯誤 Token 驗證拒絕路徑。它不接受真實 Token、不發送健康資料，也不能取代授權寫入驗收。
