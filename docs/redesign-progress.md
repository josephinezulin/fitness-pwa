# 活動環首頁改版交接

使用者於 2026-11-09 指定接續 redesign/ring-dashboard，原 head `935cee6`，原參考退版點 `403e7a2`。目前 main 已前進至 `cdaf990`（PR #39），這輪保留新版首頁、毛玻璃、動畫、分類與個人跑步機範本，同時整合新 main 的安全與資料保護；沒有重設 main。

## P0：合併及部署

- 已解決 App、CloudPanel 及測試的合併衝突，保留首次登入自動選表、選表立即套用及下次登入重讀，以及 E30 重讀套用、E31 運動／E32 影片草稿保護。
- 瀏覽器測試改走新首頁／紀錄／影片導覽及頭像設定入口；Google 登入後首次 Picker 自動開啟，重開則經歡迎頁登入恢復，不增加確認按鈕。
- 單元已通過 404 項 Vitest（42 檔）與 8 項 Python，正式建置成功；完整 87 個 Playwright 案例已通過（4.6 分鐘），包含三種尺寸的兩個下載案例；GitHub CI／Pages 結果完成後追加。
- 已在目前環境的 320px 通過八個重點案例，包含使用者提到的「JSON 備份可下載」及「本機內容損壞另存原始檔案」。仍須在 CI 的指定 Playwright／Chromium 確認，不能用本機結果代替 CI。
- 不改 Google OAuth scope、私人檔案驗證、記憶體 Token、Sheets 原子批次與 outbox，不將測試資料或健康資料公開。

合併後本人需完成：

1. 在自己的 Apps Script 使用新版 apps-script/UpgradeFitnessTemplate.gs，執行 `upgradeFitnessTemplate`，讓 Videos 的驗證清單包含床上運動、坐姿運動、減脂燃脂。不得把私人表改公開，亦不需提供 Token。
2. iPhone Safari／主畫面 PWA 實機確認登入、下次登入自動讀表、YouTube 內嵌播放、毛玻璃與動畫流暢度。Chromium／模擬 Google 測試不等同這些本人驗收。

## P1：接續待辦

- 歡迎頁：登入失敗／取消顯示一行可理解的錯誤並可重試，保留 Safari 使用者點擊觸發登入。
- 離線：頭像旁雲朵斜線可點開說明，移除重複的舊離線提示列。
- 成功動畫：儲存接受後先以勾選 icon 回饋再關閉表單，畫面不加文字；保留輔助閱讀名稱及減少動態效果偏好，不能把待同步誤稱已上傳。
- 今天卡推薦：接續交接所列 suggestVideo 只使用內建影片的缺口，納入目前工作區可見的本機自訂／私人試算表影片，沿用長度、分類、隱藏與觀看過濾，避免跨帳號混入。

## 已保存的其他工作

E33 每週目標舊草稿覆蓋新值的修正已推送至 fix/weekly-goal-conflict `bfc7913`，尚未合併或部署。改版完成後在新 WeeklyGoal 介面接回其畫面與寫前比對，不回復舊首頁；原本機 410／8／90 檢查證據在該分支文件。

官方無障礙依據（2026-11-09 實際讀取）：W3C C39 建議依 prefers-reduced-motion 抑制動態效果；新版沿用 MotionConfig reducedMotion=user，瀏覽器回歸以 reduce 執行。Motion 官網文件請求回覆 403，未將其列為已讀依據。

- https://www.w3.org/WAI/WCAG22/Techniques/css/C39
