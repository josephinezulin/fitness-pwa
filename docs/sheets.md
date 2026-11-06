# Google Sheets 資料模型（設計稿，尚未建立遠端工作表）

每位使用者的資料試算表及所有工作表保持私人；捷徑寫入服務端由各自的 Script Properties 保存 SPREADSHEET_ID、OWNER_SUB、裝置憑證摘要與可輪替設定，不將私密資訊寫入 sheet 或前端。PWA 的目標 spreadsheetId 由使用者授權選擇，不能硬編碼成開發者共用的資料表。時間戳為 UTC ISO 8601；日摘要的 date 為指定 IANA 時區的 YYYY-MM-DD，不從 UTC 截斷。使用者需確認日摘要時區，建議與 iPhone 健康統計一致。

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

## 保留 Google 範本與各自資料的擴充彈性

使用者已確認只使用 Google Drive／Google Sheets，不整合 OneDrive／Excel。第一版仍為單人應用；以下為第二階段的設計約束。已新增登入、選表與只讀格式驗收；多使用者健康資料分區及同步仍待實作。

### 預期流程

1. 開發者提供唯讀 Google Sheets 範本，使用者透過「建立副本」複製到自己的 Google Drive，保留為原生 Google Sheets。
2. 公開範本只含五張工作表的欄名、預設課表、教學連結與明確標記的虛構範例；不得包含真實健康資料、綁定的裝置憑證、同步日誌或已授權的 Apps Script 部署資訊。
3. 使用者在共同的 PWA 網址完成 Google 登入與授權，透過 Google Picker 選擇自己的私人副本。不能以檔名自動猜測或選取開發者的表。
4. 驗證五張工作表、必要欄位與 schemaVersion。版本標記固定為試算表層級的 developerMetadata `fitnessSchemaVersion=1`、visibility=DOCUMENT，不新增第六張工作表。格式不符時停止同步，不自動覆蓋既有檔案。
5. 前端只對當次授權選定的檔案存取。OAuth client ID 可由全體共用；各人的 access token 與目標檔案不共用。`drive.file` 配合 Picker 的可行性仍須實測。

### 隔離與切換

- 使用者檔案設定與本機健康資料應以 Google 帳號穩定識別碼及 spreadsheetId 分區，不能沿用第一階段單一 localStorage key 當作所有帳號共用資料。
- 第一階段本機資料沒有 Google 擁有者資訊。首次連線時需由使用者明確選擇是否匯入，不能自動上傳到第一個登入帳號。
- 登出、切換帳號或切換試算表時清除記憶體中的 access token、取消待執行請求，隱藏上一個帳號資料；舊回應不得寫回目前畫面。待同步資料必須保留原帳號／檔案歸屬。
- 所有 Sheets API 讀寫共用資料存取層，UI 不持有固定開發者 spreadsheetId；範本 ID 與實際資料檔案 ID 分開處理。
- 只填入 Sheet ID 不代表授權，實際存取仍由 Google OAuth 與該檔案權限控制。不要求使用者公開自己的副本。

### iOS 捷徑另外設定

複製 Sheets 範本不會自動建立個人自動化、授予 Apple 健康權限、完成 Apps Script 部署或產生安全憑證。未來使用者仍需為自己的檔案設定獨立 Apps Script 部署及裝置憑證，或另行設計並審查可隔離多使用者的服務；不得把開發者的個人捷徑端點與憑證放進公開範本。

### 開放他人使用前驗收

以兩個測試 Google 帳號各自複製範本，確認 A 的授權與副本不可讓 B 存取；測試登出、切換帳號、離線待同步、錯選試算表及權限撤銷。公開給其他帳號前另需檢查 OAuth consent screen 發布狀態、測試使用者限制與當時 Google 要求的應用驗證；不能將測試模式視為所有人可用。


## 可執行驗收契約

`src/sheet-schema.ts` 為目前欄位與型別的程式契約。Gemini Prompt 必須與它一致。資料格不允許公式、額外欄位或變更欄名；初始範本預期筆數為 0 / 0 / 0 / 3 / 0。Google 連線驗收流程見 `docs/google-setup.md`。此階段不寫入任何資料。
