# Google Sheets 資料模型（設計稿，尚未建立遠端工作表）

所有工作表保持私人；服務端由 Script Properties 保存 SPREADSHEET_ID、OWNER_SUB、裝置憑證摘要與可輪替設定，不將私密資訊寫入 sheet 或前端。時間戳為 UTC ISO 8601；日摘要的 date 為指定 IANA 時區的 YYYY-MM-DD，不從 UTC 截斷。使用者需確認日摘要時區，建議與 iPhone 健康統計一致。

| 工作表 | 欄位 |
| --- | --- |
| HealthMetrics | id, sampleKey, measuredAt, date, timezone, metricType, value, unit, source, deviceId, updatedAt, deletedAt |
| DailySteps | id, date, timezone, totalSteps, source, deviceId, revision, updatedAt |
| WorkoutLogs | id, date, timezone, type, minutes, calories, note, source, revision, updatedAt, deletedAt |
| WorkoutPlans | id, weekday, type, title, minMinutes, maxMinutes, tutorialUrl, active, updatedAt |
| SyncLogs | requestId, deviceId, receivedAt, rangeStart, rangeEnd, status, acceptedCount, rejectedCount, errorCode |

HealthMetrics 使用長表，每筆一個指標；metricType 僅允許 weight / bodyFat / heartRate，標準單位 kg / percent / bpm。原始樣本優先以 Health sample UUID 去重；若捷徑無法取得 UUID，使用裝置 ID + 類型 + 完整量測時間 + 正規化數值雜湊。限制：相同時間同值的不同樣本可能合併，必須在測試記錄註明。

DailySteps 只保存健康服務計算的該日本地時間總數；同日來源以 upsert 取代，不累加。不要把不同來源的原始步數樣本直接相加，以免 Apple Watch/iPhone 重疊。第一版每指標明確固定一個來源優先規則，跨裝置同步前需定義 canonical source。

WorkoutPlans 預設 weekday 採 ISO 1–7：1 / home / 20–30；3 / walk / 30–60；6 / home / 20–30。完成狀態由日期與 WorkoutLogs 推導，不另外儲存布林值。健康趨勢讀取時依日聚合：體重、體脂取當日最後一筆；心率需選擇並標示「靜息心率」或「每日平均心率」，不能混用；步數取 DailySteps。

## 寫入與衝突

服務端先認證、驗證版本與所有欄位，再取得 Script Lock，檢查 requestId 與樣本 key。重試的 requestId 必須回傳既有結果。同步中斷後靠唯一鍵 upsert 修復部分寫入，成功前不記 committed。Sheets 沒有真正多表交易，重試安全不可只依 SyncLogs。

所有前端編輯使用 revision 比對，版本衝突回報而非默默覆蓋；刪除採 tombstone，避免離線資料復活。所有使用者文字以 RAW value 輸入；若 Apps Script setValues 將 `=` 開頭文字當公式，需字串逃逸並做公式注入測試。請求限制 200 筆／256 KB、欄位 allowlist、數值範圍與有效曆日。日誌不記錄原始健康 payload、Token 或簽章。

## 第二階段驗收

授權帳號可 CRUD；其他帳號無法讀取。相同 requestId 重送、部分寫入後重試、兩台 client revision 衝突、跨時區與夏令時間、惡意公式字串皆需測試。完成後再為 PWA 加入同步狀態、離線 outbox 與失敗重試；第一階段沒有假同步按鈕。
