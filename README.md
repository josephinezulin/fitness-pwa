# 日常動作 · 個人健身追蹤 PWA

繁體中文、iPhone 優先，React + TypeScript + Vite。第一階段為裝置端應用，**尚未連接 Google Sheets、Apps Script 或 Apple 健康**。沒有發送健康資料的網路程式碼，示範資料需於設定頁手動載入。

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

此工作環境沒有綁定 GitHub repository，未替你推送或發布。前端程式碼是公開資產，禁止放入健康資料或私密憑證。測試資料使用虛構數值。

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
