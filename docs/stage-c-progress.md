# 階段 C：雲端寫入進度

## 已完成：跑步機分段衝突規劃

`planWorkoutChanges` 現在比較每段分鐘、速度、坡度及順序。只修改速度或坡度不會再被當作「沒有變更」；遠端手動改分段卻未增加 revision 時，也會阻止本機其他修改直接覆蓋該紀錄。

規劃輸出保留獨立的分段快照，不帶入非合約欄位；讀回內容相同但陣列物件不同的資料不會被重複寫入，新增／移除分段也能辨識。

新增 5 項回歸測試；完整檢查為 103 項 Vitest、6 項 Python 測試通過，正式建置成功。這項變更只影響純函式規劃，雲端介面仍為唯讀，尚未宣稱真實 OAuth 寫入或離線補同步完成。

## 待完成

- 安全讀取寫入快照及 Sheets API 寫入層。
- 帳號與試算表隔離的離線 outbox、重試與衝突處理介面。
- 運動與影片的雲端 CRUD，登入過期、切換帳號／檔案時的取消處理。
- 真實私人測試副本與 iPhone Safari／主畫面 PWA 驗收。

## 寫入設計依據

使用同一個 `spreadsheets.batchUpdate` 將主運動、舊分段 tombstone 與新分段一起更新，避免兩個獨立請求的中間狀態。Google 官方說明同一請求的子更新會一併原子套用，且支援 `drive.file`；這不提供跨裝置 revision 的 compare-and-swap。寫前重讀及衝突提示仍有必要，不得宣稱完全解決同時修改。

官方文件：https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate

待確認：文字以 RAW 或 typed `stringValue` 寫入的安全策略與前端公式拒絕規則必須一致。不可用會改變使用者原文、無法辨識原始前導 apostrophe 的不明確編解碼方式。
