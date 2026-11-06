# 日常動作 · 個人健身追蹤 PWA

繁體中文、iPhone 優先，React + TypeScript + Vite。支援本機模式及可選用的 **Google 登入、私人試算表、運動／影片雲端 CRUD 與離線補同步**。健康資料以每日摘要呈現；Apps Script 與 Apple 健康捷徑上傳仍待部署與實機驗收。首頁預設使用本機資料，登入並選擇相容私人副本後可切換為雲端模式。

## 開發

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` 是部署產物。Vite 使用相對 base，可部署到 GitHub Pages 的 repo 子目錄。部署不需要私密 Token 或前端環境變數。

## 部署與手動授權

1. 將本目錄放入你的 GitHub repository 根目錄，推送到 `main`。
2. GitHub → Settings → Pages → Source 選擇 **GitHub Actions**。需有 repository 管理權限；首次可能需核准 `github-pages` environment。
3. Actions 的 Deploy GitHub Pages 執行測試、建置並發布。
4. 以 iPhone Safari 開啟部署 URL，分享 → 加入主畫面。

原始碼 repository：https://github.com/josephinezulin/fitness-pwa 。網站是否可用依 GitHub Pages 設定及 Actions 部署結果確認。前端程式碼是公開資產，禁止放入健康資料或私密憑證。測試資料使用虛構數值。

## 第一階段驗收

- 首次開啟顯示無資料，設定頁載入示範資料後可檢視四個趨勢。
- 新增週一／六居家運動、週三快走，自動打卡；錯誤日期或類型不打卡。同日多筆只算一次。第一版「完成」定義為同日同類型有正分鐘數紀錄，建議時長不作硬性門檻。
- 編輯日期／類型、刪除最後一筆對應紀錄後，課表完成狀態重新計算。
- 新增健康摘要後首頁與圖表更新。最新體重／體脂顯示日期，今日步數只顯示今天，不挪用前日。
- 匯出 JSON；修改資料，再還原備份，資料應一致。錯誤版本、重複 ID、無效日期、超範圍數值不可覆蓋原資料。
- 連網載入一次，關閉再離線開啟：新增、編輯、刪除、切頁應可運作；恢復連網後資料仍在。
- iPhone 375px 寬與橫向、文字縮放、鍵盤與主畫面模式實機檢查。
- 自動化測試覆蓋跨年課表、打卡、還原驗證；正式建置驗證型別與 Service Worker 產出。Safari／iOS 實機測試需使用者執行。

## 資料保存限制

資料存在該來源的 localStorage，PWA cache 只儲存程式介面。iOS 可能回收儲存空間，請定期備份。JSON 為未加密健康資料；避免放在公開 repo 或共享資料夾。本機資料不是應用層加密，依靠 iPhone 裝置鎖及瀏覽器隔離。日期使用裝置本地曆日。

## 後續階段

先閱讀 [安全決策與整合閘門](docs/security.md)、[Sheets 資料模型](docs/sheets.md)、[iOS 捷徑規格](docs/shortcuts.md)。依使用者要求，安全可行性未驗證前不開啟雲端 API。


未來擴充保留「共用 PWA、各自登入 Google、各自複製範本到 Google Drive」模式，詳見 [範本與資料隔離規格](docs/sheets.md#保留-google-範本與各自資料的擴充彈性)。第一版維持單人使用；已實作登入與 Picker 選擇副本的驗收流程；帳號與檔案的摘要快取分區已實作；雲端寫入與離線 outbox 已實作；捷徑部署及 iPhone 端到端寫入仍待驗收。不支援 OneDrive／Excel。


## Google 連線與 Gemini 範本

- [Google Cloud 手動設定與 Safari 驗收](docs/google-setup.md)
- [給 Gemini 的完整範本建立 Prompt](docs/gemini-template-prompt.md)

連線功能由網站維護者一次設定共用的 OAuth Web Client、受限制的 Picker API Key 及專案編號，存於 `public/google-config.json`。一般使用者只需 Google 登入及選擇自己的檔案，不維護金鑰；私密憑證不寫入 repo。格式檢查本身只讀取；進入雲端模式後的運動與影片編輯才會寫入選定副本。使用者已回報登入／選檔驗收通過；新增使用者仍需親自授權，iPhone 寫入情境另行驗收。

完整進度與尚待外部設定：見 [同步進度](docs/sync-progress.md)。

捷徑上傳端程式已備妥但預設關閉，需使用者部署後實機驗收：[Apps Script 上傳 API 設定](docs/health-ingest-setup.md)。同帳號選擇私人表後，下次登入會自動重新讀取；PWA 可同步運動與影片，健康原始資料不由畫面摘要覆蓋。

PWA 新版會顯示更新提示，表單開啟時先保留草稿；雲端摘要列提供手動更新與失敗狀態。測試包含 TypeScript / DOM 介面測試（`npm test`）及未授權端點檢查工具測試（`python3 -m unittest discover -s scripts -p 'test_*.py'`）。

## 運動紀錄與影片庫

- 運動類型：居家徒手、重量訓練、跳繩、上坡快走、跑步、騎車／飛輪、游泳、健行、瑜伽、皮拉提斯、伸展、球類、其他。
- 快走與跑步可勾選「使用跑步機」，逐段記錄分鐘、速度（km/h）、坡度（%）。自動計算總時間、總距離、時間加權平均速度與坡度、最高速／坡、估算爬升（距離×坡度，下坡不計）。運動紀錄頁顯示本週總量。
- 運動影片頁：內建分類教學影片，以 YouTube 隱私強化模式（youtube-nocookie.com）在頁面內嵌播放；可貼上 YouTube 網址新增、移除或隱藏內建影片。清單存於本機（`daily-movement-videos-v1`），JSON 備份會一併匯出與還原。部分影片若被作者關閉嵌入，播放器會提示並提供「在 YouTube 開啟」。
- 雲端（Google Sheets）：已擴充接受全部運動類型，並可選用 `TreadmillSegments`（跑步機分段）與 `Videos`（影片清單）分頁；雲端檢視會顯示分段統計與試算表影片。既有副本執行 `apps-script/UpgradeFitnessTemplate.gs` 即可升級，詳見 [Sheets 資料模型](docs/sheets.md#選用分頁schema-版本仍為-1)。PWA 也可新增、編輯及刪除；待同步與衝突流程見 [階段 C](docs/stage-c-progress.md)。

## 記錄體驗與週進度

- 跑步機可直接套用 20／30 分鐘範本，編輯逐段速度／坡度並查看配速；輸入問題會指出段落與欄位。
- 可用運動日之前最近的體重輔助估算熱量，或自行覆寫估算用體重。只有按套用才改熱量，保留手動／機台數值；計算範圍與粗估限制見 [熱量方法](docs/energy-estimates.md)。
- 影片可收藏、標記看過，完成後先帶入運動草稿，確認才記錄。首頁顯示每週分鐘目標，運動頁可切換八週分鐘／跑步機距離／平均坡度。
- 收藏、觀看標記與週目標存於裝置，依帳號／試算表分區並包含於 JSON 備份；不額外授權或新增 Google Sheets 分頁。實機驗收見 [階段 D](docs/stage-d-progress.md)。

公開影片縮圖採受限的裝置快取，離線時可保留部分曾載入圖片；影片播放仍需網路。快取不含 Google 登入或健康 API，詳見 [階段 E](docs/stage-e-progress.md)。
