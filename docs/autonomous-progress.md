# 自動接續開發

使用者授權持續開發、測試、修正與依交接文件部署；只有真正需要本人登入、帳號設定或 iPhone 實機操作時才回報待辦。不要繞過平台核准、用量限制或降低健康資料安全要求。

## 目前落點

- 階段 0、C、D、E1–E5 程式已合併部署；本人 OAuth 寫入、YouTube、VoiceOver 與 iOS 健康捷徑仍保留實機待驗收，不把 HTTP／DOM／Chrome 測試當作 iPhone 結果。
- 最新已驗證部署為 PR #10，main `6116d0f707c1f9fe171a8049fe1774a05a0fd5c4`，PR CI 42329220864、Pages 42329299794 成功。新版資產 HTTP 200，另以 390px Chromium 開啟正式站確認每日表格、無溢位及零未捕捉錯誤。Actions Node 24 的 PR #9 亦已完成，不用重做。
- 本輪優先使用者回報：把綁定試算表的常駐長資訊列收進右上角頭像，保留待同步／失敗提醒；見 stage-e-progress.md 的 E6。這輪沒有開始部署健康上傳 API 或修改使用者試算表。主要功能缺口仍是安全 Apps Script 部署＋iOS 捷徑同步與 iPhone 端到端驗收。

## 先前檢查點（歷程）

- 已讀 `docs/handoff-codex.md`，從階段 0 開始。
- 基準：98 項 Vitest、6 項 Python 測試通過，正式建置成功。
- PR #1 已合併，main 合併提交 `4fab158aaf4879883edeabf4022e2fdaad017044`；PR CI 與 Pages 部署成功，首頁及新版 JS／CSS 均 HTTP 200。
- 分支 `feature/exercise-videos-treadmill` 已快轉到合併提交；接續修改前先檢查工作目錄與遠端更新，保護其他工作階段的修改。
- iPhone YouTube 試播、真實 Apps Script 升級與私人副本端對端驗收仍未完成；不可把 mock 或 HTTP 測試稱為實機驗收。
- 優先修復使用者回報的手機表單問題：欄位至少 16px，避免 iOS 聚焦自動放大；日期、雙欄表單及跑步機分段可縮窄，不以禁止縮放或隱藏頁面溢位處理。
- 此修復的 98 項 Vitest、6 項 Python 測試及正式建置通過；仍須 iPhone Safari／主畫面 PWA 確認日期欄位、鍵盤聚焦、分段輸入及手動縮放。
- 手機表單修復已在 PR #2 合併並部署，main 提交 `e38a12594fc46d498f3f73faa2cda3c03e7c4a5b`，Pages 建置與部署皆成功。
- 階段 C 的分段比較與衝突規劃已完成，完整 103 項 Vitest、6 項 Python 測試及建置通過；其餘雲端寫入工作見 `docs/stage-c-progress.md`，已接上雲端運動／影片寫入與 outbox；完整更新狀態見階段 C 文件。

## 下一步

1. 階段 0 部署已完成；保留尚未完成的實機驗收清單，見 `docs/stage-0-report.md`。
2. 階段 C 程式與部署已完成；先查有無新的實機回報，再開始階段 D。尚待使用者的實機驗收清單見階段 C 文件，不重複建立登入／欄位。
3. Sheets `spreadsheets.batchUpdate` 官方支援同一請求內原子更新，應把父運動及子分段放在同一請求；文件需解釋這比先後兩次寫入可靠。寫前重讀不等於跨裝置原子版本鎖，不可聲稱完全解決同時修改。
4. 再做階段 D、E 的使用體驗優化。每個階段執行交接文件中的完整檢查並記錄實際結果；適當分段提交、開 PR，通過後合併。

## 接續規則

- 先讀本檔與交接文件，再看 `git status`、分支、最近提交及未完成 PR。
- 若其他工作階段仍在開發或有來源不明的未提交修改，不覆蓋、不清除，不啟動重疊的寫入工作。
- 有可用環境才實際執行；環境、帳號或平台限制阻擋時記錄原因，不假造成功、不持續空轉。
- 不保存 OAuth Token、私密金鑰或真實健康資料到 GitHub。Google / GitHub 技術架構與私有試算表要求保持一致。
- 測試使用虛構資料。不得為排程新增網站執行時的計時器或 GitHub Actions 空轉輪詢。

## 排程狀態

已建立「接續健身 PWA 開發」每小時條件檢查排程，時區 Asia/Taipei。平台回傳成功且啟用；執行環境採繼承設定，回傳的環境詳情為未知。這不保證用量限制後能立即執行，也不代表能自行切換模型或繞過核准。每次實際執行仍須確認環境與工作狀態。

## 最新階段 C 檢查點

- 已實作 typed cell 讀寫、運動／分段原子 CRUD、影片 CRUD、outbox、重試／衝突、Web Locks、帳號切換取消，以及舊備份相容。
- 已直接升級使用者授權的私人原表，升級前私人原生副本已驗證；獨立私人 QA 副本已實際建立／修改虛構運動、兩段分段及影片，原生純文字與批次失敗未套用已讀回。私人檔案 ID 不寫 repo。
- 階段 C 的 PR #4 已合併為 `7f8b1bb9be99d9de84c00e59a4c79de91226ebbc`；CI 與 Pages 部署成功，首頁與新版 JS／CSS HTTP 200，部署 JS 已包含新同步介面。完整檢查通過：141 項 Vitest、6 項 Python、正式建置與 diff 檢查。iPhone OAuth 寫入／試播仍待實機驗收。
- 自動排程訊息若在此工作階段進行時到達，視為繼續同一任務，不另外啟動重疊工作。

- 已以實際 Pages origin 對 Google Sheets batchUpdate URL 發送不含 Token 的 OPTIONS：HTTP 200，Allow-Origin 符合，允許 POST 與 authorization,content-type。這僅驗證預檢，不取代本人 OAuth 寫入驗收。

## 最新階段 D 檢查點

- 已加入跑步機範本、配速、分段提示、ACSM／MET 估算、影片預填記錄、收藏／觀看、可設每週分鐘目標與八週趨勢。新偏好依帳號／檔案分區，包含於 JSON 備份，未新增 Sheet 分頁或 OAuth scope。
- 詳見 docs/stage-d-progress.md、docs/energy-estimates.md。完成本輪完整檢查、PR、CI 及部署後，接續階段 E；不要重做已上線的 C，也不能把未完成的 iPhone 實機驗收寫成通過。

- 階段 D 的 PR #6 已合併為 `d837651ed2ca7876f0620c4b4555816f01298f86`；CI／Pages 部署成功，首頁及新 JS／CSS HTTP 200，部署 JS 已含跑步機範本、熱量及收藏功能。164 項 Vitest、6 項 Python 與建置通過，實機驗收仍待確認。

## 最新階段 E 檢查點

- E1 已實作受限的公開 YouTube 縮圖 runtime cache：24 張、14 天、quota 時可清除，不能快取登入／健康／Sheet／Apps Script 請求。完整 167 項 Vitest、6 項 Python、正式建置與 diff 檢查通過。
- E1 當時尚未完成頁面拆分與自訂課表，後續完成情況見下方 E2／E3 檢查點。

- E1 的 PR #7 已合併與部署，main `3542d7adbcf90ce73f0407550e0b3b11405d8c31`，Pages run 42306449542 成功；已 HTTP 讀回新版資產及縮圖 Service Worker。
- E2／E3 已完成頁面拆分、自訂課表投影及新增／編輯／停用、私人雲端 outbox／衝突、空課表與舊備份相容，以及帳號切換草稿保護。186 項 Vitest、6 項 Python、正式建置與 diff 檢查通過；詳見 docs/stage-e-progress.md。未修改使用者健康資料或實際課表，沒有新增 Google 授權或欄位。
- PR #8 已合併為 `ddd1f6c9b00fe20bd061183cc47adb2ec2ed56c5`。PR CI run 42313396460、Pages run 42313475934 成功；正式首頁、新 JS／CSS／Service Worker HTTP 200，JS 含課表管理及衝突規則，SW 已預快取新資產並保留縮圖邊界。
- E4 的 PR #9 已合併並部署：main `ce28d33564cca7460d21b88ba3e6784c97f1742b`，PR CI run 42313922331、Pages run 42314061084 成功，正式首頁／JS／CSS／SW HTTP 200，新 annotations 已無舊 Node 20 runtime 提示。官方版本與 Recharts 3 調研見 docs/maintenance.md，圖表套件尚未升級。
- E5 已補健康完整日曆與缺值斷線、單筆資料點、每日／每週數值表、紀錄摘要、鍵盤 Tooltip、篩選狀態及觸控目標。196 項 Vitest、6 項 Python、正式建置與 diff 檢查通過；另以實際 Chromium／Playwright 在 320、390px 直向及 844px 橫向做 45 項檢查通過，含無溢位與離線重載。這不是 Safari／VoiceOver 或 OAuth 實機驗收，也尚未加入瀏覽器 CI。完整結果與待辦見 docs/trend-accessibility.md，PR／部署依 GitHub 最新結果確認。
- E5 的 PR #10 已完成上述部署，後續不要重做趨勢數值清單。本輪 E6 頭像面板完成本機 199 項 Vitest、6 項 Python、建置及 diff 檢查；Chromium 的三種尺寸各 11 項頭像檢查（含虛構雲端元件 fixture）及既有 45 項介面／離線回歸通過。待本輪 PR／Pages 檢查完成再視為上線。
