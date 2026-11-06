# 日常動作 · 個人健身追蹤 PWA

繁體中文、iPhone 優先，React + TypeScript + Vite。第一階段為裝置端應用，第二階段已新增可選用的 **Google 登入、選擇私人試算表及只讀格式驗收**；尚未啟用雲端資料同步、Apps Script 或 Apple 健康。首頁預設使用本機資料，也可明確切換為驗收通過的雲端每日摘要唯讀檢視；示範資料需於設定頁手動載入。

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


未來擴充保留「共用 PWA、各自登入 Google、各自複製範本到 Google Drive」模式，詳見 [範本與資料隔離規格](docs/sheets.md#保留-google-範本與各自資料的擴充彈性)。第一版維持單人使用；已實作登入與 Picker 選擇副本的驗收流程；帳號與檔案的摘要快取分區已實作；雲端寫入、離線 outbox 及捷徑部署尚未實作。不支援 OneDrive／Excel。


## Google 連線與 Gemini 範本

- [Google Cloud 手動設定與 Safari 驗收](docs/google-setup.md)
- [給 Gemini 的完整範本建立 Prompt](docs/gemini-template-prompt.md)

連線功能由網站維護者一次設定共用的 OAuth Web Client、受限制的 Picker API Key 及專案編號，存於 `public/google-config.json`。一般使用者只需 Google 登入及選擇自己的檔案，不維護金鑰；私密憑證不寫入 repo。現階段只驗收私人副本，沒有任何雲端寫入操作。真實 OAuth／Picker 需使用者建立專案及授權後測試，尚未宣告通過。

完整進度與尚待外部設定：見 [同步進度](docs/sync-progress.md)。

捷徑上傳端程式已備妥但預設關閉，需使用者部署後實機驗收：[Apps Script 上傳 API 設定](docs/health-ingest-setup.md)。同帳號選擇私人表後，下次登入會自動重新讀取；PWA 雲端寫入仍未啟用。
