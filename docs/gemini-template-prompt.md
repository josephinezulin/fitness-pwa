# 給 Gemini 的 Google Sheets 範本建立 Prompt

複製以下整段給 Gemini。這次只建立「沒有真實健康資料」的私人範本，先不要公開，也不要建立 API 或捷徑。完成後把試算表網址和 Gemini 的完成報告交回驗收；不要提供任何 Token。

```text
請幫我建立「日常動作 PWA 範本 v1」原生 Google Sheets，供個人健身追蹤 PWA 使用，未來讓別人建立副本到自己的 Google Drive。

這是程式讀寫的資料範本，請嚴格保持以下結構，不要自行翻譯英文欄名、改名、加欄、加說明列、加入統計公式或額外工作表。不使用 Excel、OneDrive、資料庫或任何公開健康資料 API。

如果你有能力直接在我的 Google Drive 建立，請建立全新檔案，不要修改任何既有檔案。若你無法完成中繼資料等必要設定，請改為提供一份可直接貼到 Google Apps Script 執行的完整程式碼，入口函式叫 createFitnessTemplate；由它建立全新檔案並記錄網址。不要只給操作建議，也不要宣稱尚未執行的動作已完成。

一、整個檔案
- 名稱：日常動作 PWA 範本 v1。
- 初始時區 Asia/Taipei、地區台灣；這是範本預設值，未來使用者可以依自己的時區調整。
- 檔案保持私人，不設定 anyone、公開連結或邀請其他人。
- 正好五張工作表，名稱、順序及第一列欄名如下。每張保留 1000 列，欄數必須剛好等於所列欄位數；刪除多餘空白欄。所有標題在第 1 列，資料從第 2 列開始，凍結第 1 列，不合併儲存格。
- 必須新增一筆「試算表層級」developer metadata：key=fitnessSchemaVersion，value=1，visibility=DOCUMENT。不是工作表層級，也不是儲存格內容、註解或名為設定的第六張表。
- 若提供 Apps Script，可使用 spreadsheet.addDeveloperMetadata('fitnessSchemaVersion', '1', SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT)。必須在你建立的全新 spreadsheet 上操作。

二、五張表的欄名（依序，不含中文說明）

HealthMetrics：
id,sampleKey,measuredAt,date,timezone,metricType,value,unit,source,deviceId,updatedAt,deletedAt

DailySteps：
id,date,timezone,totalSteps,source,deviceId,revision,updatedAt

WorkoutLogs：
id,date,timezone,type,minutes,calories,note,source,revision,updatedAt,deletedAt

WorkoutPlans：
id,weekday,type,title,minMinutes,maxMinutes,tutorialUrl,active,updatedAt

SyncLogs：
requestId,deviceId,receivedAt,rangeStart,rangeEnd,status,acceptedCount,rejectedCount,errorCode

三、資料格式
- ID、sampleKey、date、時戳、timezone、type、unit、source、deviceId、note、status、errorCode、title、tutorialUrl 一律保存為文字，不要讓 Sheets 自動轉成日期序號或公式。
- date 採 YYYY-MM-DD；時戳 measuredAt / updatedAt / deletedAt / receivedAt / rangeStart / rangeEnd 採 UTC ISO 8601，例如 2026-11-06T00:00:00Z。不要輸入無時區的時間文字。
- timezone 使用 IANA 名稱，例如 Asia/Taipei。
- 數值欄位保存成真正數字，不含單位文字；active 保存成真正的布林值，可使用核取方塊，不要存成文字 "TRUE"。
- HealthMetrics.metricType 僅 weight / bodyFat / heartRate，對應 unit 為 kg / percent / bpm；value 範圍依序為 1–500、0–100、20–250。體脂率 23% 存 value=23、unit=percent，不是 0.23 或 2300。
- DailySteps.totalSteps 為 0–200000 整數；每個時區同一天只有一筆 canonical 總步數，不把 iPhone 與 Apple Watch 重疊來源直接加總。
- WorkoutLogs.type 為 home / walk / other；minutes 為 1–1440 整數；calories 為 0–20000 數字；note 可空白，最多 2000 字。
- revision 為從 1 開始的正整數。deletedAt 留白代表未刪除，刪除時寫 UTC 時戳。
- WorkoutPlans.weekday 採 ISO 1–7（週一到週日）；minMinutes、maxMinutes 為正整數，且 min 不大於 max。tutorialUrl 只能是 HTTPS 的 youtube.com、www.youtube.com 或 youtu.be 連結，沒有時留白。
- SyncLogs.status 僅 committed / failed / partial；acceptedCount、rejectedCount 為非負整數；errorCode 留白或簡短錯誤代碼，不存健康內容或憑證。
- 可加入下拉選單、數值驗證與欄名註解，但不能改變 API 的欄位名稱、位置或儲存型別。資料區一律純值，不使用公式。

四、唯一預填資料：WorkoutPlans 的三筆預設課表
請用相同欄位順序填入下列資料，updatedAt 使用建立當下的 UTC ISO 8601 文字：
1. id=home-mon，weekday=1，type=home，title=居家徒手訓練，minMinutes=20，maxMinutes=30，tutorialUrl=https://www.youtube.com/results?search_query=初學者+徒手全身訓練+低衝擊+20分鐘，active=true。
2. id=walk-wed，weekday=3，type=walk，title=健身房上坡快走，minMinutes=30，maxMinutes=60，tutorialUrl 留白，active=true。
3. id=home-sat，weekday=6，type=home，title=居家徒手訓練，minMinutes=20，maxMinutes=30，tutorialUrl 與週一相同，active=true。

HealthMetrics、DailySteps、WorkoutLogs、SyncLogs 只保留標題，資料列完全空白。不加虛構健康紀錄、空白佔位紀錄或同步結果，不含真實個資、Email、Google Token、Client Secret、服務帳戶私鑰或個人的 Apps Script 部署網址。

五、視覺
標題列使用深綠底白字、字體清楚；適當欄寬、交錯列底色與篩選器即可。不要加入儀表板、圖表或裝飾性說明列。

六、完成報告與自我驗收
請回報實際完成與尚待手動執行的部分，逐項列出：
- 原生 Google Sheets 網址（若尚未建立，不要編造網址）。
- 五張工作表名稱、欄數與首列欄名。
- 每張資料筆數：依序 0、0、0、3、0。
- 三筆課表的 weekday / type / minMinutes / maxMinutes / active，以及 active 是否為布林型別。
- 檔案層級的 fitnessSchemaVersion=1 與 DOCUMENT visibility 是否已建立。
- 時區、共用權限是否維持私人、有無公式或額外欄列。
- 若只能提供 Apps Script：附完整程式碼、執行 createFitnessTemplate 的步驟、所需授權說明，以及執行後如何取得網址。程式不得包含 doGet / doPost、網路發送、API 部署或更改分享權限的操作。

本次不建立 Google Cloud 專案、不產生任何私密 Token、不啟用健康資料 API；OAuth 設定與同步程式由另一個開發流程負責。
```
