# 同步開發進度與待驗收事項

## 已完成的程式與本機測試

- Google OAuth token flow、Picker 選擇自己的檔案、私人檔案與 schema 閘門。
- 通過閘門後可在首頁、趨勢、運動紀錄中唯讀查看雲端資料；必須由使用者明確選擇切換。
- 體重／體脂取當日最後一筆未刪除樣本；心率明確標記當日樣本算術平均；步數使用該日 canonical 總量，不與舊總數相加。
- 雲端檢視禁止新增、還原或刪除；本機模式的 CRUD 不受影響。切回本機不會上傳任何資料。
- 本機資料維持原 key，雲端每日摘要快取使用 subject + spreadsheetId 分區。Token 與非白名單欄位不寫入快取／備份。
- 登出／授權到期返回本機資料、清除當前雲端檢視；導航切頁不卸載登入元件。重新載入不自動展示帳號快取，需再次登入並選檔。雲端摘要快取是同源 localStorage，不是加密保管庫。
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
- 捷徑健康資料上傳與 Apps Script ingestion deployment。

私人表結構通過驗收不等於瀏覽器 OAuth／Picker／跨來源存取已通過；不能因 ChatGPT 的 Drive connector 能讀寫，就略過實際 PWA 身分驗證。

## 需要使用者完成的外部設定

1. GitHub repository 的 Settings → Pages → Source 設為 GitHub Actions。目前已嘗試使用現有授權啟用，但 GitHub 回傳 `Resource not accessible by integration`，需要 repository 擁有者操作。設定完成後可由開發流程重跑部署與檢查結果。
2. 按 `docs/google-setup.md` 建立／設定 Google Cloud 專案、啟用 Sheets／Drive／Picker API、建立 Web OAuth client、設定實際 Pages origin、測試使用者，以及受網站與 API 限制的 Picker API Key。
3. 在 PWA 輸入公開 client ID / API Key / 專案編號，親自完成 Google 授權。不要提供 Client Secret、access token 或私鑰。
4. 以私人副本測試讀取、拒絕授權、取消選檔、帳號切換、Token 過期與 iPhone Safari 主畫面模式。

完成真實讀取閘門後，接著實作並測試寫入與離線 outbox，再部署捷徑 API。`docs/shortcuts.md` 定義七天回掃及手動補同步，但現階段尚無可用的健康上傳端點。

## 備份範圍

本機模式匯出本機日摘要及運動紀錄；雲端唯讀模式匯出目前投影的每日摘要，檔名及按鈕明確標示。它不包含 HealthMetrics 的所有原始樣本、SyncLogs 或完整試算表結構，因此不是整份 Google Sheets 的完整備份。完整雲端備份需保留原表副本或之後另行實作原始資料匯出。
